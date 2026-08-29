import path from 'node:path';
import { stringify } from 'yaml';
import { z } from 'zod';
import { buildCreateArgs, describeArgError, validateProjectType } from '../core/args.ts';
import type { ServerConfig } from '../core/config.ts';
import type { Metadata } from '../core/defaults.ts';
import { describePathError, validateRelativePath } from '../core/paths.ts';
import type { DefaultsStore } from '../shell/defaults.ts';
import { runQuarto } from '../shell/exec.ts';
import { makeProjectDir, removeDir, writeTextFile } from '../shell/files.ts';
import type { Registry } from '../shell/registry.ts';

/** Quarto owns this file. SPECS.md rejects it in `files` so the two inputs cannot disagree. */
const QUARTO_CONFIG = '_quarto.yml';

/** The server owns this file. Quarto merges it over `_quarto.yml`. */
const QUARTO_METADATA = '_metadata.yml';

export const createProjectInputSchema = z.object({
	type: z.string().default('default').describe('The Quarto project type. Defaults to "default".'),
	config: z
		.record(z.string(), z.unknown())
		.optional()
		.describe('Generic YAML data. When present it replaces the generated _quarto.yml.'),
	metadata: z
		.record(z.string(), z.unknown())
		.optional()
		.describe(
			'Generic YAML data written to _metadata.yml. When present it replaces the stored defaults.',
		),
	useDefaults: z
		.boolean()
		.optional()
		.describe('Write the stored metadata defaults when metadata is absent. Defaults to true.'),
	files: z
		.array(
			z.object({
				path: z.string().describe('A path relative to the project root.'),
				content: z.string().describe('UTF-8 text content.'),
			}),
		)
		.optional()
		.describe('Initial text files to write into the project.'),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export type CreateProjectResult = {
	readonly projectId: string;
};

export class ToolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ToolError';
	}
}

/**
 * Decide what goes into `_metadata.yml`.
 *
 * SPECS.md fixes the order: an explicit `metadata` wins, then the stored defaults, then nothing.
 * The result replaces the defaults. It is never merged with them.
 */
const resolveMetadata = (input: CreateProjectInput, defaults: DefaultsStore): Promise<Metadata> => {
	if (input.metadata !== undefined) {
		return Promise.resolve(input.metadata);
	}
	if (input.useDefaults === false) {
		return Promise.resolve({});
	}
	return defaults.read();
};

export const createProject = async (
	input: CreateProjectInput,
	deps: {
		readonly registry: Registry;
		readonly config: ServerConfig;
		readonly defaults: DefaultsStore;
	},
): Promise<CreateProjectResult> => {
	const type = validateProjectType(input.type);
	if (!type.ok) {
		throw new ToolError(describeArgError(type.error));
	}

	// Validate every path before creating anything, so a bad input costs no filesystem work.
	const files = input.files ?? [];
	for (const file of files) {
		// Only the project root is reserved. A nested `chapters/_metadata.yml` stays legal.
		const normalized = path.normalize(file.path);
		if (normalized === QUARTO_CONFIG) {
			throw new ToolError(
				`"${QUARTO_CONFIG}" is not allowed in files. Use the config parameter instead.`,
			);
		}
		if (normalized === QUARTO_METADATA) {
			throw new ToolError(
				`"${QUARTO_METADATA}" is not allowed in files. Use the metadata parameter instead.`,
			);
		}
	}

	// Read the defaults before creating anything. A malformed defaults file must not leave a
	// temporary directory on disk.
	const metadata = await resolveMetadata(input, deps.defaults);

	const root = await makeProjectDir();
	try {
		const created = await runQuarto(buildCreateArgs(type.value), {
			cwd: root,
			timeoutMs: deps.config.renderTimeoutMs,
			maxOutputBytes: deps.config.maxOutputBytes,
		});
		if (created.code !== 0) {
			throw new ToolError(
				`Quarto could not create the project. ${created.stderr || created.stdout}`.trim(),
			);
		}

		if (input.config !== undefined) {
			// The config is generic YAML data. The server defines no Quarto schema and does not
			// merge with what Quarto generated; SPECS.md requires a replacement.
			await writeTextFile(path.join(root, QUARTO_CONFIG), stringify(input.config));
		}

		if (Object.keys(metadata).length > 0) {
			// Quarto merges `_metadata.yml` over `_quarto.yml`. The server writes one file and
			// never merges YAML itself.
			await writeTextFile(path.join(root, QUARTO_METADATA), stringify(metadata));
		}

		for (const file of files) {
			const target = validateRelativePath(root, file.path);
			if (!target.ok) {
				throw new ToolError(describePathError(target.error));
			}
			await writeTextFile(target.value, file.content);
		}

		return { projectId: deps.registry.add(root).id };
	} catch (cause) {
		// SPECS.md: remove the project directory if project creation fails.
		await removeDir(root);
		throw cause;
	}
};
