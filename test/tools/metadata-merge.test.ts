import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../../src/core/config.ts';
import type { Metadata } from '../../src/core/defaults.ts';
import { createRegistry, type ProjectState, type Registry } from '../../src/shell/registry.ts';
import { createProject } from '../../src/tools/create.ts';
import { inspect } from '../../src/tools/inspect.ts';
import { render } from '../../src/tools/render.ts';
import { cleanupDefaults, tempDefaultsStore } from '../support/defaults.ts';
import { hasQuarto } from '../support/quarto.ts';

/**
 * These tests measure Quarto, not the server. SPECS.md keeps every YAML merge inside Quarto, so a
 * Quarto upgrade that changes a rule must fail the build and force a documentation change.
 *
 * Measured on Quarto 1.10.18. SPECS.md holds the same table.
 *
 * Caution: `quarto inspect` and a real render disagree about `author`. Every author case therefore
 * asserts the rendered output, which is what a user sees.
 */

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

const ADA = [{ name: 'Ada Lovelace' }];
const GRACE = [{ name: 'Grace Hopper' }];
const ALAN = [{ name: 'Alan Turing' }];

type Case = {
	readonly defaults?: Metadata;
	readonly projectConfig?: Metadata;
	readonly document?: string;
	readonly files?: ReadonlyArray<{ path: string; content: string }>;
};

const doc = (frontMatter = ''): string => `---\ntitle: Hello\n${frontMatter}---\n\nText.\n`;

/** Create a project whose defaults file already holds `defaults`. */
const build = async (input: Case): Promise<ProjectState> => {
	const registry = createRegistry();
	registries.push(registry);
	const defaults = tempDefaultsStore();
	if (input.defaults !== undefined) {
		await defaults.write(input.defaults);
	}

	const { projectId } = await createProject(
		{
			type: 'default',
			...(input.projectConfig === undefined ? {} : { config: input.projectConfig }),
			files: [{ path: 'hello.qmd', content: doc(input.document) }, ...(input.files ?? [])],
		},
		{ registry, config, defaults },
	);
	return registry.get(projectId);
};

type FormatEntry = {
	readonly metadata: Record<string, unknown>;
	readonly pandoc: Record<string, unknown>;
	readonly execute: Record<string, unknown>;
};

/** One format of `quarto inspect`. Quarto splits a document's keys across three groups. */
const inspectFormat = async (project: ProjectState, input: string): Promise<FormatEntry> => {
	const result = await inspect({ projectId: project.id, input }, { project, config });
	const formats = result.formats as Record<string, FormatEntry>;
	const entry = formats.html;
	if (entry === undefined) {
		throw new Error(`Quarto produced no "html" format. It produced: ${Object.keys(formats)}`);
	}
	return entry;
};

const formatNames = async (project: ProjectState, input: string): Promise<string[]> => {
	const result = await inspect({ projectId: project.id, input }, { project, config });
	return Object.keys(result.formats as Record<string, unknown>).sort();
};

/** The names that reach the rendered page. This is the result a user sees. */
const renderedNames = async (project: ProjectState): Promise<string[]> => {
	const result = await render({ projectId: project.id, input: 'hello.qmd' }, { project, config });
	expect(result.success).toBe(true);
	const html = await readFile(path.join(project.root, 'hello.html'), 'utf8');
	return ['Ada Lovelace', 'Grace Hopper', 'Alan Turing'].filter((name) => html.includes(name));
};

describe.skipIf(!hasQuarto)('how Quarto merges the metadata defaults', () => {
	describe('precedence for one scalar key', () => {
		it('lets the defaults beat the project config', async () => {
			const project = await build({ defaults: { lang: 'en' }, projectConfig: { lang: 'de' } });

			expect((await inspectFormat(project, 'hello.qmd')).metadata).toMatchObject({ lang: 'en' });
		});

		it('lets a document beat the defaults', async () => {
			const project = await build({
				defaults: { lang: 'en' },
				projectConfig: { lang: 'de' },
				document: 'lang: fr\n',
			});

			expect((await inspectFormat(project, 'hello.qmd')).metadata).toMatchObject({ lang: 'fr' });
		});
	});

	describe('a mapping merges key by key', () => {
		it('keeps a nested key from each level', async () => {
			const project = await build({
				defaults: { execute: { echo: false } },
				projectConfig: { execute: { warning: false } },
			});

			expect((await inspectFormat(project, 'hello.qmd')).execute).toMatchObject({
				echo: false,
				warning: false,
			});
		});
	});

	describe('trap: a format key in the defaults drops the project format', () => {
		it('keeps every option inside one format', async () => {
			const project = await build({
				defaults: { format: { html: { toc: true } } },
				projectConfig: { format: { html: { theme: 'cosmo' } } },
			});
			const entry = await inspectFormat(project, 'hello.qmd');

			// Quarto sorts a known flag into `pandoc` and a variable into `metadata`.
			expect(entry.pandoc).toMatchObject({ toc: true });
			expect(entry.metadata).toMatchObject({ theme: 'cosmo' });
		});

		it('drops a sibling format that only the project config asks for', async () => {
			const project = await build({
				defaults: { format: { html: { toc: true } } },
				projectConfig: { format: { pdf: {} } },
			});

			expect(await formatNames(project, 'hello.qmd')).toEqual(['html']);
		});
	});

	describe('trap: a project config and the defaults concatenate their authors', () => {
		it('renders both authors when the entries differ', async () => {
			const project = await build({ defaults: { author: ADA }, projectConfig: { author: GRACE } });

			expect(await renderedNames(project)).toEqual(['Ada Lovelace', 'Grace Hopper']);
		});

		it('renders one author when the entries are identical', async () => {
			const project = await build({ defaults: { author: ADA }, projectConfig: { author: ADA } });

			expect(await renderedNames(project)).toEqual(['Ada Lovelace']);
		});
	});

	describe('a document author replaces the inherited list', () => {
		it('renders the author of the document only', async () => {
			const project = await build({
				defaults: { author: ADA },
				projectConfig: { author: ALAN },
				document: 'author:\n  - name: Grace Hopper\n',
			});

			expect(await renderedNames(project)).toEqual(['Grace Hopper']);
		});

		it('reports every level in quarto inspect, which the render then narrows', async () => {
			const project = await build({
				defaults: { author: ADA },
				projectConfig: { author: ALAN },
				document: 'author:\n  - name: Grace Hopper\n',
			});

			// Caution: inspect is not the rendered result. It concatenates, lowest level first.
			expect((await inspectFormat(project, 'hello.qmd')).metadata.author).toMatchObject([
				{ name: 'Alan Turing' },
				{ name: 'Ada Lovelace' },
				{ name: 'Grace Hopper' },
			]);
		});
	});

	describe('trap: authors is a different key from author', () => {
		it('does not replace the inherited author, so the page carries both', async () => {
			const project = await build({
				defaults: { author: ADA },
				document: 'authors:\n  - name: Grace Hopper\n',
			});

			expect(await renderedNames(project)).toEqual(['Ada Lovelace', 'Grace Hopper']);
		});

		it('keeps the two keys apart in quarto inspect', async () => {
			const project = await build({
				defaults: { author: ADA },
				document: 'authors:\n  - name: Grace Hopper\n',
			});
			const { metadata } = await inspectFormat(project, 'hello.qmd');

			expect(metadata.author).toMatchObject(ADA);
			expect(metadata.authors).toMatchObject(GRACE);
		});
	});

	describe('limit: the defaults do not reach a subdirectory', () => {
		it('leaves a document in a subdirectory without the defaults', async () => {
			const project = await build({
				defaults: { author: ADA },
				files: [{ path: 'chapters/one.qmd', content: doc() }],
			});

			expect((await inspectFormat(project, 'hello.qmd')).metadata).toHaveProperty('author');
			expect((await inspectFormat(project, 'chapters/one.qmd')).metadata).not.toHaveProperty(
				'author',
			);
		});

		it('applies a nested _metadata.yml to its own subtree', async () => {
			const project = await build({
				files: [
					{ path: 'chapters/_metadata.yml', content: 'lang: fr\n' },
					{ path: 'chapters/one.qmd', content: doc() },
				],
			});

			expect((await inspectFormat(project, 'chapters/one.qmd')).metadata).toMatchObject({
				lang: 'fr',
			});
		});
	});
});
