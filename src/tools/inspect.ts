import { z } from 'zod';
import { buildInspectArgs } from '../core/args.ts';
import type { ServerConfig } from '../core/config.ts';
import { describePathError, validateRelativePath } from '../core/paths.ts';
import { runQuarto } from '../shell/exec.ts';
import type { ProjectState } from '../shell/registry.ts';
import { ToolError } from './create.ts';

export const inspectInputSchema = z.object({
	projectId: z.string().describe('The id returned by quarto_create_project.'),
	input: z
		.string()
		.optional()
		.describe('A file relative to the project root. When absent the project is inspected.'),
});

export type InspectInput = z.infer<typeof inspectInputSchema>;

export type InspectResult = Record<string, unknown>;

export const inspect = async (
	input: InspectInput,
	deps: { readonly project: ProjectState; readonly config: ServerConfig },
): Promise<InspectResult> => {
	if (input.input !== undefined) {
		const checked = validateRelativePath(deps.project.root, input.input);
		if (!checked.ok) {
			throw new ToolError(describePathError(checked.error));
		}
	}

	const result = await runQuarto(buildInspectArgs(input.input), {
		cwd: deps.project.root,
		timeoutMs: deps.config.renderTimeoutMs,
		maxOutputBytes: deps.config.maxOutputBytes,
	});

	if (result.code !== 0) {
		throw new ToolError(`Quarto inspect failed. ${result.stderr || result.stdout}`.trim());
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.stdout);
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new ToolError(`Quarto inspect did not return valid JSON. ${detail}`);
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new ToolError('Quarto inspect did not return a JSON object.');
	}

	// SPECS.md: return the parsed JSON without field changes. Quarto's own absolute paths stay.
	return parsed as InspectResult;
};
