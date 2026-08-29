import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	describeDefaultsError,
	parseDefaults,
	resolveDefaultsPath,
	serializeDefaults,
} from '../../src/core/defaults.ts';

describe('parseDefaults', () => {
	it('reads a mapping', () => {
		const result = parseDefaults('author:\n  - name: Ada Lovelace\nlang: de\n');
		expect(result).toEqual({
			ok: true,
			value: { author: [{ name: 'Ada Lovelace' }], lang: 'de' },
		});
	});

	it('treats an empty document as an empty mapping', () => {
		for (const text of ['', '   ', '# only a comment\n', '---\n', 'null']) {
			expect(parseDefaults(text)).toEqual({ ok: true, value: {} });
		}
	});

	it('rejects invalid YAML', () => {
		const result = parseDefaults('a: [1,\nb: 2\n');
		expect(result).toMatchObject({ ok: false, error: { kind: 'invalid-yaml' } });
	});

	it('rejects a scalar', () => {
		expect(parseDefaults('5')).toEqual({ ok: false, error: { kind: 'not-a-mapping' } });
	});

	it('rejects a sequence', () => {
		expect(parseDefaults('- one\n- two\n')).toEqual({
			ok: false,
			error: { kind: 'not-a-mapping' },
		});
	});
});

describe('serializeDefaults', () => {
	it('writes a header that names the writer', () => {
		const text = serializeDefaults({ lang: 'de' });
		expect(text).toContain('# Managed by quarto-cli-mcp');
		expect(text).toContain('lang: de');
	});

	it('round trips a mapping', () => {
		const metadata = { author: [{ name: 'Ada Lovelace', orcid: '0000-0002-1825-0097' }] };
		expect(parseDefaults(serializeDefaults(metadata))).toEqual({ ok: true, value: metadata });
	});

	it('round trips an empty mapping', () => {
		expect(parseDefaults(serializeDefaults({}))).toEqual({ ok: true, value: {} });
	});
});

describe('resolveDefaultsPath', () => {
	const expected = (...parts: string[]): string => path.join(...parts);

	it('prefers QUARTO_MCP_DEFAULTS_FILE', () => {
		const found = resolveDefaultsPath(
			{ QUARTO_MCP_DEFAULTS_FILE: '/srv/d.yml', XDG_CONFIG_HOME: '/xdg' },
			'/home/u',
		);
		expect(found).toBe('/srv/d.yml');
	});

	it('ignores an empty QUARTO_MCP_DEFAULTS_FILE', () => {
		const found = resolveDefaultsPath(
			{ QUARTO_MCP_DEFAULTS_FILE: '', XDG_CONFIG_HOME: '/xdg' },
			'/home/u',
		);
		expect(found).toBe(expected('/xdg', 'quarto-cli-mcp', 'defaults.yml'));
	});

	it('falls back to XDG_CONFIG_HOME', () => {
		const found = resolveDefaultsPath({ XDG_CONFIG_HOME: '/xdg' }, '/home/u');
		expect(found).toBe(expected('/xdg', 'quarto-cli-mcp', 'defaults.yml'));
	});

	it('ignores an empty XDG_CONFIG_HOME', () => {
		const found = resolveDefaultsPath({ XDG_CONFIG_HOME: '' }, '/home/u');
		expect(found).toBe(expected('/home/u', '.config', 'quarto-cli-mcp', 'defaults.yml'));
	});

	it('falls back to the home directory', () => {
		expect(resolveDefaultsPath({}, '/home/u')).toBe(
			expected('/home/u', '.config', 'quarto-cli-mcp', 'defaults.yml'),
		);
	});
});

describe('describeDefaultsError', () => {
	it('describes invalid YAML and keeps the parser message', () => {
		expect(describeDefaultsError({ kind: 'invalid-yaml', message: 'boom' })).toContain('boom');
	});

	it('describes a document that is not a mapping', () => {
		expect(describeDefaultsError({ kind: 'not-a-mapping' })).toContain('mapping');
	});
});
