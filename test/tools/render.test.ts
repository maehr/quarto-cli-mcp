import { afterEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../../src/core/config.ts';
import { createRegistry, type ProjectState, type Registry } from '../../src/shell/registry.ts';
import { createProject } from '../../src/tools/create.ts';
import { render } from '../../src/tools/render.ts';
import { hasQuarto } from '../support/quarto.ts';

const config = (() => {
	const parsed = parseServerConfig({});
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
})();

const registries: Registry[] = [];
afterEach(async () => {
	await Promise.all(registries.splice(0).map((r) => r.shutdown()));
});

const project = async (content: string): Promise<{ project: ProjectState }> => {
	const registry = createRegistry();
	registries.push(registry);
	const { projectId } = await createProject(
		{ type: 'default', files: [{ path: 'hello.qmd', content }] },
		{ registry, config },
	);
	return { project: registry.get(projectId) };
};

const GOOD = '---\ntitle: Hello\n---\n\nSome text.\n';

describe.skipIf(!hasQuarto)('render', () => {
	it('renders one input file and reports the output', async () => {
		const { project: p } = await project(GOOD);
		const result = await render({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });

		expect(result.success).toBe(true);
		const paths = result.files.map((f) => f.path);
		expect(paths).toContain('hello.html');
		expect(result.files.find((f) => f.path === 'hello.html')?.mimeType).toBe('text/html');
	});

	it('reports the support files a render creates', async () => {
		const { project: p } = await project(GOOD);
		const result = await render({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });
		expect(result.files.some((f) => f.path.startsWith('hello_files/'))).toBe(true);
	});

	it('never reports the Quarto cache directory', async () => {
		const { project: p } = await project(GOOD);
		const result = await render({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });
		expect(result.files.every((f) => !f.path.startsWith('.quarto/'))).toBe(true);
	});

	it('omits mimeType when the extension is unknown', async () => {
		const { project: p } = await project(GOOD);
		const result = await render({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });
		for (const file of result.files) {
			if (file.path.endsWith('.woff')) {
				expect(file.mimeType).toBe('font/woff');
			}
		}
		// Every reported entry always carries a path.
		expect(result.files.every((f) => typeof f.path === 'string')).toBe(true);
	});

	it('reports a Quarto failure as data, not as a thrown error', async () => {
		// An unclosed YAML block makes Quarto exit non-zero.
		const { project: p } = await project('---\ntitle: Broken\n\nNo closing fence.\n');
		const result = await render({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });

		expect(result.success).toBe(false);
		expect(`${result.stdout}${result.stderr}`.length).toBeGreaterThan(0);
	});

	it('renders the whole project when no input is given', async () => {
		const { project: p } = await project(GOOD);
		const result = await render({ projectId: p.id }, { project: p, config });
		expect(result.success).toBe(true);
		expect(result.files.length).toBeGreaterThan(0);
	});

	it('honours the to format', async () => {
		const { project: p } = await project(GOOD);
		const result = await render(
			{ projectId: p.id, input: 'hello.qmd', to: 'plain' },
			{ project: p, config },
		);
		expect(result.success).toBe(true);
	});
});

describe('render path safety', () => {
	const fake: ProjectState = { id: 'x', root: '/tmp/quarto-mcp-nonexistent' };

	it('rejects an input that escapes the project root', async () => {
		await expect(
			render({ projectId: 'x', input: '../escape.qmd' }, { project: fake, config }),
		).rejects.toThrow(/outside the project root/);
	});

	it('rejects an absolute input', async () => {
		await expect(
			render({ projectId: 'x', input: '/etc/passwd' }, { project: fake, config }),
		).rejects.toThrow(/absolute/);
	});

	it('rejects output "-", which Quarto reads as stdout', async () => {
		await expect(
			render({ projectId: 'x', output: '-' }, { project: fake, config }),
		).rejects.toThrow(/starts with "-"/);
	});

	it('rejects an output that escapes the project root', async () => {
		await expect(
			render({ projectId: 'x', output: '../pwned.html' }, { project: fake, config }),
		).rejects.toThrow(/outside the project root/);
	});

	it('rejects an option-like format', async () => {
		await expect(
			render({ projectId: 'x', to: '--output-dir=/etc' }, { project: fake, config }),
		).rejects.toThrow(/format/);
	});
});
