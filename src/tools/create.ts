import path from 'node:path';
import { stringify } from 'yaml';
import { z } from 'zod';
import { buildCreateArgs, describeArgError, validateProjectType } from '../core/args.ts';
import type { ServerConfig } from '../core/config.ts';
import { describePathError, validateRelativePath } from '../core/paths.ts';
import { runQuarto } from '../shell/exec.ts';
import { makeProjectDir, removeDir, writeTextFile } from '../shell/files.ts';
import type { Registry } from '../shell/registry.ts';

/** Quarto owns this file. SPECS.md rejects it in `files` so the two inputs cannot disagree. */
const QUARTO_CONFIG = '_quarto.yml';

export const createProjectInputSchema = z.object({
	type: z.string().default('default').describe('The Quarto project type. Defaults to "default".'),
	config: z
		.record(z.string(), z.unknown())
		.optional()
		.describe('Generic YAML data. When present it replaces the generated _quarto.yml.'),
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

export const createProject = async (
	input: CreateProjectInput,
	deps: { readonly registry: Registry; readonly config: ServerConfig },
): Promise<CreateProjectResult> => {
	const type = validateProjectType(input.type);
	if (!type.ok) {
		throw new ToolError(describeArgError(type.error));
	}

	// Validate every path before creating anything, so a bad input costs no filesystem work.
	const files = input.files ?? [];
	for (const file of files) {
		if (path.normalize(file.path) === QUARTO_CONFIG) {
			throw new ToolError(
				`"${QUARTO_CONFIG}" is not allowed in files. Use the config parameter instead.`,
			);
		}
	}

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
