import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { SERVER_VERSION } from '../src/server.ts';

const read = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const packageVersion = (JSON.parse(read('package.json')) as { version: string }).version;

describe('the version number', () => {
	it('reaches the MCP handshake from package.json', () => {
		expect(SERVER_VERSION).toBe(packageVersion);
	});

	// A release edits `CITATION.cff` by hand, so this test guards the one remaining copy.
	it('matches CITATION.cff', () => {
		const citation = parse(read('CITATION.cff')) as { version: unknown };

		expect(String(citation.version)).toBe(packageVersion);
	});

	it('is a SemVer number', () => {
		expect(packageVersion).toMatch(/^\d+\.\d+\.\d+(?:[-+].+)?$/);
	});
});
