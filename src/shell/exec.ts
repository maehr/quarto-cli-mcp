import { spawn } from 'node:child_process';

/**
 * The Quarto executable is server-controlled. SPECS.md forbids taking an executable path from
 * a client, so the name is a constant and `shell` is always false.
 */
const QUARTO = 'quarto';

export type ExecResult = {
	readonly code: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly timedOut: boolean;
	readonly stdoutTruncated: boolean;
	readonly stderrTruncated: boolean;
};

export type ExecOptions = {
	readonly cwd: string;
	readonly timeoutMs: number;
	readonly maxOutputBytes: number;
};

/** Collect a stream up to a byte cap. Everything past the cap is dropped, not buffered. */
const createSink = (limit: number) => {
	const chunks: Buffer[] = [];
	let size = 0;
	let truncated = false;
	return {
		push(chunk: Buffer): void {
			if (size >= limit) {
				truncated = true;
				return;
			}
			const room = limit - size;
			if (chunk.length > room) {
				chunks.push(chunk.subarray(0, room));
				size = limit;
				truncated = true;
				return;
			}
			chunks.push(chunk);
			size += chunk.length;
		},
		text(): string {
			const body = Buffer.concat(chunks).toString('utf8');
			return truncated ? `${body}\n[output truncated at ${limit} bytes]` : body;
		},
		get truncated(): boolean {
			return truncated;
		},
	};
};

export class QuartoStartError extends Error {
	constructor(cause: Error) {
		super(`Could not start the "${QUARTO}" executable. Is Quarto on PATH? ${cause.message}`);
		this.name = 'QuartoStartError';
	}
}

/**
 * Run Quarto and collect its output.
 *
 * A non-zero exit is not an error here. The caller decides what a non-zero exit means, because
 * `quarto_render` must report it as data while the other tools treat it as a failure.
 */
export const runQuarto = (args: readonly string[], options: ExecOptions): Promise<ExecResult> =>
	new Promise((resolve, reject) => {
		const child = spawn(QUARTO, [...args], {
			cwd: options.cwd,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		const out = createSink(options.maxOutputBytes);
		const errSink = createSink(options.maxOutputBytes);
		let timedOut = false;
		let settled = false;

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGKILL');
		}, options.timeoutMs);
		// A pending timer must not hold the server process open.
		timer.unref?.();

		child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => errSink.push(chunk));

		child.on('error', (cause: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			reject(new QuartoStartError(cause));
		});

		child.on('close', (code, signal) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			resolve({
				code,
				signal,
				stdout: out.text(),
				stderr: errSink.text(),
				timedOut,
				stdoutTruncated: out.truncated,
				stderrTruncated: errSink.truncated,
			});
		});
	});
