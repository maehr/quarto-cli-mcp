import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../src/core/config.ts';
import { createServer } from '../src/server.ts';
import { createRegistry, type Registry } from '../src/shell/registry.ts';
import { cleanupDefaults, tempDefaultsStore } from './support/defaults.ts';
import { hasQuarto } from './support/quarto.ts';

const config = (() => {
	const parsed = parseServerConfig({});
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
})();

const registries: Registry[] = [];
afterEach(async () => {
	await Promise.all(registries.splice(0).map((r) => r.shutdown()));
	cleanupDefaults();
});

const connect = async () => {
	const registry = createRegistry();
	registries.push(registry);
	const defaults = tempDefaultsStore();
	const server = createServer({ registry, config, defaults });
	const client = new Client({ name: 'test', version: '0.0.0' });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return { client, registry, defaults };
};

/** Tool results arrive as a text content block holding JSON. */
const payload = (result: unknown): Record<string, unknown> => {
	const content = (result as { content: { type: string; text: string }[] }).content;
	const first = content[0];
	if (first === undefined) throw new Error('The tool returned no content.');
	return JSON.parse(first.text) as Record<string, unknown>;
};

describe('createServer', () => {
	it('exposes exactly the five tools in SPECS.md', async () => {
		const { client } = await connect();
		const { tools } = await client.listTools();

		expect(tools.map((t) => t.name).sort()).toEqual([
			'quarto_create_project',
			'quarto_defaults_get',
			'quarto_defaults_set',
			'quarto_inspect',
			'quarto_render',
		]);
	});

	it('exposes no out-of-scope tool', async () => {
		const { client } = await connect();
		const { tools } = await client.listTools();
		const names = tools.map((t) => t.name).join(' ');

		for (const forbidden of ['preview', 'serve', 'publish', 'install', 'pandoc', 'typst', 'run']) {
			expect(names).not.toContain(forbidden);
		}
	});

	it('returns empty metadata before anything is stored', async () => {
		const { client, defaults } = await connect();
		const result = payload(await client.callTool({ name: 'quarto_defaults_get', arguments: {} }));
		expect(result).toEqual({ path: defaults.path(), metadata: {} });
	});

	it('reports an unknown projectId as a tool error', async () => {
		const { client } = await connect();
		const result = await client.callTool({
			name: 'quarto_inspect',
			arguments: { projectId: 'nope' },
		});
		expect(result.isError).toBe(true);
	});
});

describe.skipIf(!hasQuarto)('createServer end to end', () => {
	it('creates, inspects, and renders a project', async () => {
		const { client } = await connect();

		const created = payload(
			await client.callTool({
				name: 'quarto_create_project',
				arguments: {
					type: 'default',
					files: [{ path: 'hello.qmd', content: '---\ntitle: Hello\n---\n\nText.\n' }],
				},
			}),
		);
		const projectId = created.projectId as string;
		expect(Object.keys(created)).toEqual(['projectId']);

		const inspected = payload(
			await client.callTool({ name: 'quarto_inspect', arguments: { projectId } }),
		);
		expect(inspected).toHaveProperty('quarto');

		const rendered = payload(
			await client.callTool({
				name: 'quarto_render',
				arguments: { projectId, input: 'hello.qmd' },
			}),
		);
		expect(rendered.success).toBe(true);
		const files = rendered.files as { path: string; mimeType?: string }[];
		expect(files.find((f) => f.path === 'hello.html')?.mimeType).toBe('text/html');
	});

	it('never leaks the project root to a client', async () => {
		const { client, registry } = await connect();
		const created = payload(
			await client.callTool({ name: 'quarto_create_project', arguments: { type: 'default' } }),
		);
		const projectId = created.projectId as string;
		const root = registry.get(projectId).root;

		const rendered = await client.callTool({
			name: 'quarto_render',
			arguments: { projectId, input: 'default.qmd' },
		});
		// Quarto's own stdout may name files, but the server adds no root path of its own.
		expect(JSON.stringify(payload(rendered).files)).not.toContain(root);
	});

	it('rejects a path that escapes the project root', async () => {
		const { client } = await connect();
		const created = payload(
			await client.callTool({ name: 'quarto_create_project', arguments: { type: 'default' } }),
		);
		const result = await client.callTool({
			name: 'quarto_render',
			arguments: { projectId: created.projectId as string, input: '../escape.qmd' },
		});
		expect(result.isError).toBe(true);
	});

	it('remembers the metadata defaults and applies them to a new project', async () => {
		const { client } = await connect();
		const metadata = { author: [{ name: 'Ada Lovelace', orcid: '0000-0002-1825-0097' }] };

		const stored = payload(
			await client.callTool({ name: 'quarto_defaults_set', arguments: { metadata } }),
		);
		expect(stored.metadata).toEqual(metadata);

		const read = payload(await client.callTool({ name: 'quarto_defaults_get', arguments: {} }));
		expect(read.metadata).toEqual(metadata);

		const created = payload(
			await client.callTool({ name: 'quarto_create_project', arguments: { type: 'default' } }),
		);
		const inspected = payload(
			await client.callTool({
				name: 'quarto_inspect',
				arguments: { projectId: created.projectId as string, input: 'default.qmd' },
			}),
		);
		// Quarto merges _metadata.yml itself, so the author reaches the document metadata.
		expect(JSON.stringify(inspected)).toContain('Ada Lovelace');
	});

	it('removes every temporary directory on shutdown', async () => {
		const { client, registry } = await connect();
		const created = payload(
			await client.callTool({ name: 'quarto_create_project', arguments: { type: 'default' } }),
		);
		expect(registry.size()).toBe(1);
		void created;

		await registry.shutdown();
		expect(registry.size()).toBe(0);
	});
});
