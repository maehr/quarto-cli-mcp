import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runQuarto } from '../../src/shell/exec.ts';
import { hasQuarto } from '../support/quarto.ts';

const dirs: string[] = [];

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const options = async () => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), 'quarto-mcp-exec-'));
	dirs.push(cwd);
	return { cwd, timeoutMs: 60_000, maxOutputBytes: 1_048_576 };
};

describe.skipIf(!hasQuarto)('runQuarto', () => {
	it('returns code 0 and the version on stdout', async () => {
		const result = await runQuarto(['--version'], await options());
		expect(result.code).toBe(0);
		expect(result.stdout.trim()).toMatch(/^\d+\.\d+/);
		expect(result.timedOut).toBe(false);
	});

	it('reports a non-zero exit as data, not as a thrown error', async () => {
		const result = await runQuarto(['render', 'does-not-exist.qmd'], await options());
		expect(result.code).not.toBe(0);
		expect(`${result.stdout}${result.stderr}`.length).toBeGreaterThan(0);
	});

	it('truncates output at the byte cap', async () => {
		const result = await runQuarto(['--version'], { ...(await options()), maxOutputBytes: 3 });
		expect(result.stdoutTruncated).toBe(true);
		expect(result.stdout).toContain('[output truncated at 3 bytes]');
	});

	it('kills a run that exceeds the timeout', async () => {
		// `quarto check` is slow enough that a 1 ms budget always expires.
		const result = await runQuarto(['check'], { ...(await options()), timeoutMs: 1 });
		expect(result.timedOut).toBe(true);
	});
});
