import { realpath } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { parseServerConfig } from '../../src/core/config.ts';
import { createRegistry, type ProjectState, type Registry } from '../../src/shell/registry.ts';
import { createProject } from '../../src/tools/create.ts';
import { inspect } from '../../src/tools/inspect.ts';
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

const project = async (): Promise<ProjectState> => {
	const registry = createRegistry();
	registries.push(registry);
	const { projectId } = await createProject(
		{
			type: 'default',
			files: [{ path: 'hello.qmd', content: '---\ntitle: Hello\n---\n\nText.\n' }],
		},
		{ registry, config },
	);
	return registry.get(projectId);
};

describe.skipIf(!hasQuarto)('inspect', () => {
	it('returns the project inspect JSON', async () => {
		const p = await project();
		const result = await inspect({ projectId: p.id }, { project: p, config });

		expect(result).toHaveProperty('quarto');
		expect(result).toHaveProperty('config');
	});

	it('returns Quarto fields unchanged, including its own absolute dir', async () => {
		const p = await project();
		const result = await inspect({ projectId: p.id }, { project: p, config });

		// SPECS.md says the server must not add absolute paths, but Quarto's own output can
		// carry them and must pass through untouched. Compare real paths: on macOS `/var` is a
		// symbolic link to `/private/var`, and Quarto reports the resolved path.
		expect(result.dir).toBe(await realpath(p.root));
	});

	it('inspects one input file', async () => {
		const p = await project();
		const result = await inspect({ projectId: p.id, input: 'hello.qmd' }, { project: p, config });
		expect(typeof result).toBe('object');
		expect(result).not.toBeNull();
	});

	it('reports a Quarto failure as a tool error', async () => {
		const p = await project();
		await expect(
			inspect({ projectId: p.id, input: 'missing.qmd' }, { project: p, config }),
		).rejects.toThrow(/inspect failed/i);
	});
});

describe('inspect path safety', () => {
	const fake: ProjectState = { id: 'x', root: '/tmp/quarto-mcp-nonexistent' };

	it('rejects an input that escapes the project root', async () => {
		await expect(
			inspect({ projectId: 'x', input: '../escape.qmd' }, { project: fake, config }),
		).rejects.toThrow(/outside the project root/);
	});

	it('rejects an absolute input', async () => {
		await expect(
			inspect({ projectId: 'x', input: '/etc/passwd' }, { project: fake, config }),
		).rejects.toThrow(/absolute/);
	});

	it('rejects an option-like input', async () => {
		await expect(
			inspect({ projectId: 'x', input: '--profile' }, { project: fake, config }),
		).rejects.toThrow(/starts with "-"/);
	});
});
