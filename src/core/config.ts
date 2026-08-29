import { z } from 'zod';
import { err, ok, type Result } from './result.ts';

/**
 * Process limits are server configuration, not MCP tool parameters. SPECS.md is explicit that
 * a client must not be able to raise them.
 */
export const DEFAULT_RENDER_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
export const DEFAULT_MAX_PROJECT_BYTES = 268_435_456;

const byteCount = z.coerce.number().int().positive();

export const serverConfigSchema = z.object({
	renderTimeoutMs: byteCount.default(DEFAULT_RENDER_TIMEOUT_MS),
	maxOutputBytes: byteCount.default(DEFAULT_MAX_OUTPUT_BYTES),
	maxProjectBytes: byteCount.default(DEFAULT_MAX_PROJECT_BYTES),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Read the limits from the environment.
 *
 * An absent variable takes the default. A present but invalid variable is an error, because
 * silently ignoring a misspelled limit would hide a misconfigured server.
 */
export const parseServerConfig = (env: Env): Result<ServerConfig, string> => {
	const parsed = serverConfigSchema.safeParse({
		renderTimeoutMs: env.QUARTO_MCP_RENDER_TIMEOUT_MS,
		maxOutputBytes: env.QUARTO_MCP_MAX_OUTPUT_BYTES,
		maxProjectBytes: env.QUARTO_MCP_MAX_PROJECT_BYTES,
	});
	if (!parsed.success) {
		const detail = parsed.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		return err(`Invalid server configuration. ${detail}`);
	}
	return ok(parsed.data);
};
