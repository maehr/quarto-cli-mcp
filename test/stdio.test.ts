import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';
import { hasQuarto } from './support/quarto.ts';

/** Node strips the types, so the test runs the real entry point without a build. */
const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

const dirs: string[] = [];
const transports: StdioClientTransport[] = [];

afterEach(async () => {
	for (const transport of transports.splice(0)) {
		await transport.close().catch(() => undefined);
	}
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** The temporary projects that the child created. `makeProjectDir` uses this prefix. */
const projects = (tmp: string): string[] =>
	readdirSync(tmp).filter((name) => name.startsWith('quarto-mcp-'));

const waitForEmpty = async (tmp: string, timeoutMs = 10_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (projects(tmp).length > 0 && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
};

/** Start the server over a real pipe, and leave one temporary project behind. */
const startServer = async (): Promise<{ tmp: string; transport: StdioClientTransport }> => {
	const tmp = mkdtempSync(path.join(os.tmpdir(), 'quarto-mcp-stdio-'));
	dirs.push(tmp);

	const transport = new StdioClientTransport({
		command: process.execPath,
		args: ['--experimental-strip-types', entry],
		env: {
			PATH: process.env.PATH ?? '',
			HOME: process.env.HOME ?? '',
			// `makeProjectDir` calls `os.tmpdir()`, which reads this variable.
			TMPDIR: tmp,
			// Caution: no test may read the real `~/.config`.
			QUARTO_MCP_DEFAULTS_FILE: path.join(tmp, 'defaults.yml'),
			QUARTO_MCP_LOG_LEVEL: 'silent',
		},
		stderr: 'ignore',
	});
	transports.push(transport);

	const client = new Client({ name: 'test', version: '0.0.0' });
	await client.connect(transport);
	await client.callTool({ name: 'quarto_create_project', arguments: {} });
	expect(projects(tmp)).toHaveLength(1);

	return { tmp, transport };
};

describe.skipIf(!hasQuarto)('the stdio server', () => {
	it('removes temporary projects when the client closes the pipe', async () => {
		const { tmp, transport } = await startServer();

		const startedAt = Date.now();
		await transport.close();

		expect(projects(tmp)).toEqual([]);
		// The client sends SIGTERM only after it waits 2000 ms. A faster exit proves that the end
		// of stdin removed the project, and not the signal.
		expect(Date.now() - startedAt).toBeLessThan(2000);
	});

	it('removes temporary projects on SIGTERM', async () => {
		const { tmp, transport } = await startServer();
		const { pid } = transport;
		expect(pid).not.toBeNull();

		process.kill(pid as number, 'SIGTERM');
		await waitForEmpty(tmp);

		expect(projects(tmp)).toEqual([]);
	});
});
