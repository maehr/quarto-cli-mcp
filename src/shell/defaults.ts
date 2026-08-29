import { readFile } from 'node:fs/promises';
import {
	type DefaultsError,
	describeDefaultsError,
	type Metadata,
	parseDefaults,
	serializeDefaults,
} from '../core/defaults.ts';
import { writeTextFile } from './files.ts';

export class DefaultsFileError extends Error {
	constructor(filePath: string, error: DefaultsError) {
		super(`The defaults file "${filePath}" is not usable. ${describeDefaultsError(error)}`);
		this.name = 'DefaultsFileError';
	}
}

export type DefaultsStore = {
	/** The resolved file path. A client needs it to edit the file by hand. */
	readonly path: () => string;
	readonly read: () => Promise<Metadata>;
	readonly write: (metadata: Metadata) => Promise<void>;
};

const isMissingFile = (cause: unknown): boolean =>
	cause instanceof Error && (cause as NodeJS.ErrnoException).code === 'ENOENT';

export const createDefaultsStore = (filePath: string): DefaultsStore => {
	// One promise chain serializes access, so a read never sees a half-written file.
	let queue: Promise<unknown> = Promise.resolve();

	const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
		const run = queue.then(task);
		// The queue holds the settled result only. One failure does not poison the next call.
		queue = run.catch(() => undefined);
		return run;
	};

	const read = async (): Promise<Metadata> => {
		let text: string;
		try {
			text = await readFile(filePath, 'utf8');
		} catch (cause) {
			// SPECS.md: an absent file is not an error. It means "no defaults".
			if (isMissingFile(cause)) {
				return {};
			}
			throw cause;
		}
		const parsed = parseDefaults(text);
		if (!parsed.ok) {
			throw new DefaultsFileError(filePath, parsed.error);
		}
		return parsed.value;
	};

	const write = (metadata: Metadata): Promise<void> =>
		// The whole file is replaced. SPECS.md keeps every merge inside Quarto.
		writeTextFile(filePath, serializeDefaults(metadata));

	return {
		path: () => filePath,
		read: () => enqueue(read),
		write: (metadata) => enqueue(() => write(metadata)),
	};
};
