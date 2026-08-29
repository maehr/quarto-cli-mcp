import { z } from 'zod';
import { buildRenderArgs, describeArgError, validateFormat } from '../core/args.ts';
import type { ServerConfig } from '../core/config.ts';
import { mimeTypeForPath } from '../core/mime.ts';
import { describePathError, validateRelativePath } from '../core/paths.ts';
import { diffSnapshots } from '../core/snapshot.ts';
import { runQuarto } from '../shell/exec.ts';
import { snapshotTree } from '../shell/files.ts';
import type { ProjectState } from '../shell/registry.ts';
import { ToolError } from './create.ts';

export const renderInputSchema = z.object({
	projectId: z.string().describe('The id returned by quarto_create_project.'),
	input: z
		.string()
		.optional()
		.describe('A file relative to the project root. When absent the project is rendered.'),
	to: z.string().optional().describe('An output format, for example "html" or "pdf".'),
	output: z.string().optional().describe('An output file relative to the project root.'),
	execute: z
		.boolean()
		.optional()
		.describe('Execute code in documents. Off by default. This is not a sandbox.'),
});

export type RenderInput = z.infer<typeof renderInputSchema>;

export type RenderedFile = {
	readonly path: string;
	readonly mimeType?: string | undefined;
};

export type RenderResult = {
	readonly success: boolean;
	readonly files: readonly RenderedFile[];
	readonly stdout: string;
	readonly stderr: string;
};

export const render = async (
	input: RenderInput,
	deps: { readonly project: ProjectState; readonly config: ServerConfig },
): Promise<RenderResult> => {
	const root = deps.project.root;

	// Validate before doing any filesystem work.
	if (input.input !== undefined) {
		const checked = validateRelativePath(root, input.input);
		if (!checked.ok) {
			throw new ToolError(describePathError(checked.error));
		}
	}
	if (input.output !== undefined) {
		// This also rejects `-`, which Quarto reads as "write to stdout".
		const checked = validateRelativePath(root, input.output);
		if (!checked.ok) {
			throw new ToolError(describePathError(checked.error));
		}
	}
	if (input.to !== undefined) {
		const checked = validateFormat(input.to);
		if (!checked.ok) {
			throw new ToolError(describeArgError(checked.error));
		}
	}

	const before = await snapshotTree(root);
	const result = await runQuarto(
		buildRenderArgs({
			input: input.input,
			to: input.to,
			output: input.output,
			execute: input.execute,
		}),
		{
			cwd: root,
			timeoutMs: deps.config.renderTimeoutMs,
			maxOutputBytes: deps.config.maxOutputBytes,
		},
	);
	const after = await snapshotTree(root);

	const files: readonly RenderedFile[] = diffSnapshots(before, after).map((filePath) => {
		const mimeType = mimeTypeForPath(filePath);
		// `exactOptionalPropertyTypes` is on, so an unknown type omits the key entirely.
		return mimeType === undefined ? { path: filePath } : { path: filePath, mimeType };
	});

	return {
		// SPECS.md: a non-zero exit is reported as data, not as an MCP tool error.
		success: result.code === 0,
		files,
		stdout: result.stdout,
		stderr: result.timedOut
			? `${result.stderr}\n[render exceeded ${deps.config.renderTimeoutMs} ms and was stopped]`
			: result.stderr,
	};
};
