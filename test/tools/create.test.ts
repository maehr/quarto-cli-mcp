import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../../src/core/config.ts';
import { createRegistry, type Registry } from '../../src/shell/registry.ts';
import { createProject, ToolError } from '../../src/tools/create.ts';
import { hasQuarto } from '../support/quarto.ts';

const config = (() => {
	const parsed = parseServerConfig({});
	if (!parsed.ok) {
		throw new Error(parsed.error);
	}
	return parsed.value;
})();

const registries: Registry[] = [];
const newRegistry = (): Registry => {
	const registry = createRegistry();
	registries.push(registry);
	return registry;
};

afterEach(async () => {
	await Promise.all(registries.splice(0).map((registry) => registry.shutdown()));
});

/** Reach the private root for assertions only. A client never sees it. */
const rootOf = (registry: Registry, projectId: string): string => registry.get(projectId).root;

describe('createProject input validation', () => {
	it('rejects an option-like project type before touching the filesystem', async () => {
		const registry = newRegistry();
		await expect(createProject({ type: '--no-prompt' }, { registry, config })).rejects.toThrow(
			ToolError,
		);
		expect(registry.size()).toBe(0);
	});

	it('rejects _quarto.yml in files', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '_quarto.yml', content: 'project: {}' }] },
				{ registry, config },
			),
		).rejects.toThrow(/not allowed in files/);
		expect(registry.size()).toBe(0);
	});

	it('rejects _quarto.yml written through a redundant path', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: './_quarto.yml', content: 'x: 1' }] },
				{ registry, config },
			),
		).rejects.toThrow(/not allowed in files/);
	});
});

describe.skipIf(!hasQuarto)('createProject', () => {
	it('creates a project and returns only a projectId', async () => {
		const registry = newRegistry();
		const result = await createProject({ type: 'default' }, { registry, config });

		expect(Object.keys(result)).toEqual(['projectId']);
		expect(result.projectId).toMatch(/^[0-9a-f-]{36}$/);

		const root = rootOf(registry, result.projectId);
		await expect(readFile(`${root}/_quarto.yml`, 'utf8')).resolves.toContain('project');
	});

	it('keeps the generated _quarto.yml when no config is given', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject({ type: 'default' }, { registry, config });
		const yaml = await readFile(`${rootOf(registry, projectId)}/_quarto.yml`, 'utf8');
		expect(yaml).toContain('project');
	});

	it('replaces _quarto.yml with the config, without merging', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject(
			{ type: 'default', config: { project: { title: 'Mine' }, format: { html: {} } } },
			{ registry, config },
		);

		const yaml = await readFile(`${rootOf(registry, projectId)}/_quarto.yml`, 'utf8');
		expect(yaml).toContain('title: Mine');
		expect(yaml).toContain('format');
		// The generated title is gone, which proves a replacement rather than a merge.
		expect(yaml).not.toContain('title: default');
	});

	it('writes the requested files', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject(
			{
				type: 'default',
				files: [
					{ path: 'hello.qmd', content: '---\ntitle: Hello\n---\n\nText.\n' },
					{ path: 'posts/nested.qmd', content: 'Nested.\n' },
				],
			},
			{ registry, config },
		);

		const root = rootOf(registry, projectId);
		await expect(readFile(`${root}/hello.qmd`, 'utf8')).resolves.toContain('title: Hello');
		await expect(readFile(`${root}/posts/nested.qmd`, 'utf8')).resolves.toBe('Nested.\n');
	});

	it('rejects a file path that escapes the project root and leaves nothing behind', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '../escape.qmd', content: 'x' }] },
				{ registry, config },
			),
		).rejects.toThrow(/outside the project root/);
		expect(registry.size()).toBe(0);
	});

	it('rejects an absolute file path', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '/tmp/pwned.qmd', content: 'x' }] },
				{ registry, config },
			),
		).rejects.toThrow(/absolute/);
	});

	it('gives each project a separate root', async () => {
		const registry = newRegistry();
		const a = await createProject({ type: 'default' }, { registry, config });
		const b = await createProject({ type: 'default' }, { registry, config });
		expect(rootOf(registry, a.projectId)).not.toBe(rootOf(registry, b.projectId));
	});
});
