import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MAX_OUTPUT_BYTES,
	DEFAULT_MAX_PROJECT_BYTES,
	DEFAULT_RENDER_TIMEOUT_MS,
	parseServerConfig,
} from '../../src/core/config.ts';

describe('parseServerConfig', () => {
	it('uses the defaults for an empty environment', () => {
		expect(parseServerConfig({})).toEqual({
			ok: true,
			value: {
				renderTimeoutMs: DEFAULT_RENDER_TIMEOUT_MS,
				maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
				maxProjectBytes: DEFAULT_MAX_PROJECT_BYTES,
			},
		});
	});

	it('reads every limit from the environment', () => {
		const result = parseServerConfig({
			QUARTO_MCP_RENDER_TIMEOUT_MS: '5000',
			QUARTO_MCP_MAX_OUTPUT_BYTES: '2048',
			QUARTO_MCP_MAX_PROJECT_BYTES: '4096',
		});
		expect(result).toEqual({
			ok: true,
			value: { renderTimeoutMs: 5000, maxOutputBytes: 2048, maxProjectBytes: 4096 },
		});
	});

	it('overrides one limit and defaults the rest', () => {
		const result = parseServerConfig({ QUARTO_MCP_RENDER_TIMEOUT_MS: '1' });
		expect(result).toEqual({
			ok: true,
			value: {
				renderTimeoutMs: 1,
				maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
				maxProjectBytes: DEFAULT_MAX_PROJECT_BYTES,
			},
		});
	});

	it.each([
		['not-a-number', 'QUARTO_MCP_RENDER_TIMEOUT_MS'],
		['0', 'QUARTO_MCP_RENDER_TIMEOUT_MS'],
		['-1', 'QUARTO_MCP_RENDER_TIMEOUT_MS'],
		['1.5', 'QUARTO_MCP_RENDER_TIMEOUT_MS'],
	])('rejects %s', (value, key) => {
		const result = parseServerConfig({ [key]: value });
		expect(result.ok).toBe(false);
	});

	it('names the offending field in the message', () => {
		const result = parseServerConfig({ QUARTO_MCP_MAX_OUTPUT_BYTES: '-5' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('maxOutputBytes');
		}
	});
});
