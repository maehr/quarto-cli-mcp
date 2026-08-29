import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../../src/core/config.ts';
import type { DefaultsStore } from '../../src/shell/defaults.ts';
import { createRegistry, type Registry } from '../../src/shell/registry.ts';
import { createProject, ToolError } from '../../src/tools/create.ts';
import { cleanupDefaults, tempDefaultsStore } from '../support/defaults.ts';
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

// Every test gets an empty defaults store, so a stored value cannot leak between tests.
let defaults: DefaultsStore;
beforeEach(() => {
	defaults = tempDefaultsStore();
});

afterEach(async () => {
	await Promise.all(registries.splice(0).map((registry) => registry.shutdown()));
	cleanupDefaults();
});

/** Reach the private root for assertions only. A client never sees it. */
const rootOf = (registry: Registry, projectId: string): string => registry.get(projectId).root;

describe('createProject input validation', () => {
	it('rejects an option-like project type before touching the filesystem', async () => {
		const registry = newRegistry();
		await expect(
			createProject({ type: '--no-prompt' }, { registry, config, defaults }),
		).rejects.toThrow(ToolError);
		expect(registry.size()).toBe(0);
	});

	it('rejects _quarto.yml in files', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '_quarto.yml', content: 'project: {}' }] },
				{ registry, config, defaults },
			),
		).rejects.toThrow(/not allowed in files/);
		expect(registry.size()).toBe(0);
	});

	it('rejects _quarto.yml written through a redundant path', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: './_quarto.yml', content: 'x: 1' }] },
				{ registry, config, defaults },
			),
		).rejects.toThrow(/not allowed in files/);
	});

	it('rejects _metadata.yml in files', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '_metadata.yml', content: 'lang: de' }] },
				{ registry, config, defaults },
			),
		).rejects.toThrow(/not allowed in files/);
		expect(registry.size()).toBe(0);
	});

	it('rejects _metadata.yml written through a redundant path', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: './_metadata.yml', content: 'lang: de' }] },
				{ registry, config, defaults },
			),
		).rejects.toThrow(/not allowed in files/);
	});

	it('rejects a malformed defaults file before creating anything', async () => {
		const registry = newRegistry();
		await writeFile(defaults.path(), 'a: [1,\nb: 2\n', 'utf8');
		await expect(
			createProject({ type: 'default' }, { registry, config, defaults }),
		).rejects.toThrow(/defaults file/);
		expect(registry.size()).toBe(0);
	});
});

describe.skipIf(!hasQuarto)('createProject', () => {
	it('creates a project and returns only a projectId', async () => {
		const registry = newRegistry();
		const result = await createProject({ type: 'default' }, { registry, config, defaults });

		expect(Object.keys(result)).toEqual(['projectId']);
		expect(result.projectId).toMatch(/^[0-9a-f-]{36}$/);

		const root = rootOf(registry, result.projectId);
		await expect(readFile(`${root}/_quarto.yml`, 'utf8')).resolves.toContain('project');
	});

	it('keeps the generated _quarto.yml when no config is given', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject({ type: 'default' }, { registry, config, defaults });
		const yaml = await readFile(`${rootOf(registry, projectId)}/_quarto.yml`, 'utf8');
		expect(yaml).toContain('project');
	});

	it('replaces _quarto.yml with the config, without merging', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject(
			{ type: 'default', config: { project: { title: 'Mine' }, format: { html: {} } } },
			{ registry, config, defaults },
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
			{ registry, config, defaults },
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
				{ registry, config, defaults },
			),
		).rejects.toThrow(/outside the project root/);
		expect(registry.size()).toBe(0);
	});

	it('rejects an absolute file path', async () => {
		const registry = newRegistry();
		await expect(
			createProject(
				{ type: 'default', files: [{ path: '/tmp/pwned.qmd', content: 'x' }] },
				{ registry, config, defaults },
			),
		).rejects.toThrow(/absolute/);
	});

	it('writes the stored defaults to _metadata.yml', async () => {
		const registry = newRegistry();
		await defaults.write({ author: [{ name: 'Ada Lovelace', orcid: '0000-0002-1825-0097' }] });

		const { projectId } = await createProject({ type: 'default' }, { registry, config, defaults });
		const root = rootOf(registry, projectId);

		await expect(readFile(`${root}/_metadata.yml`, 'utf8')).resolves.toContain(
			'name: Ada Lovelace',
		);
		// The defaults land in their own file. Quarto merges them, the server does not.
		await expect(readFile(`${root}/_quarto.yml`, 'utf8')).resolves.not.toContain('Ada Lovelace');
	});

	it('writes no _metadata.yml when nothing is stored', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject({ type: 'default' }, { registry, config, defaults });
		await expect(
			readFile(`${rootOf(registry, projectId)}/_metadata.yml`, 'utf8'),
		).rejects.toThrow();
	});

	it('lets metadata replace the stored defaults', async () => {
		const registry = newRegistry();
		await defaults.write({ lang: 'de', author: [{ name: 'Ada Lovelace' }] });

		const { projectId } = await createProject(
			{ type: 'default', metadata: { lang: 'en' } },
			{ registry, config, defaults },
		);

		const yaml = await readFile(`${rootOf(registry, projectId)}/_metadata.yml`, 'utf8');
		expect(yaml).toContain('lang: en');
		// The stored author is gone, which proves a replacement rather than a merge.
		expect(yaml).not.toContain('Ada Lovelace');
	});

	it('writes no _metadata.yml when useDefaults is false', async () => {
		const registry = newRegistry();
		await defaults.write({ lang: 'de' });

		const { projectId } = await createProject(
			{ type: 'default', useDefaults: false },
			{ registry, config, defaults },
		);

		await expect(
			readFile(`${rootOf(registry, projectId)}/_metadata.yml`, 'utf8'),
		).rejects.toThrow();
	});

	it('writes no _metadata.yml for empty metadata', async () => {
		const registry = newRegistry();
		await defaults.write({ lang: 'de' });

		const { projectId } = await createProject(
			{ type: 'default', metadata: {} },
			{ registry, config, defaults },
		);

		await expect(
			readFile(`${rootOf(registry, projectId)}/_metadata.yml`, 'utf8'),
		).rejects.toThrow();
	});

	it('keeps a nested _metadata.yml from files', async () => {
		const registry = newRegistry();
		const { projectId } = await createProject(
			{
				type: 'default',
				files: [{ path: 'chapters/_metadata.yml', content: 'lang: de\n' }],
			},
			{ registry, config, defaults },
		);

		const yaml = await readFile(`${rootOf(registry, projectId)}/chapters/_metadata.yml`, 'utf8');
		expect(yaml).toBe('lang: de\n');
	});

	it('gives each project a separate root', async () => {
		const registry = newRegistry();
		const a = await createProject({ type: 'default' }, { registry, config, defaults });
		const b = await createProject({ type: 'default' }, { registry, config, defaults });
		expect(rootOf(registry, a.projectId)).not.toBe(rootOf(registry, b.projectId));
	});
});
