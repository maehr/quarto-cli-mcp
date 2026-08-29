import { access, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRegistry, UnknownProjectError } from '../../src/shell/registry.ts';

const tempRoot = () => mkdtemp(path.join(os.tmpdir(), 'quarto-mcp-test-'));

const exists = async (dir: string): Promise<boolean> => {
	try {
		await access(dir);
		return true;
	} catch {
		return false;
	}
};

describe('createRegistry', () => {
	it('issues an opaque id and hides the root', async () => {
		const registry = createRegistry();
		const root = await tempRoot();
		const project = registry.add(root);

		expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(project.id).not.toContain(root);
		expect(registry.size()).toBe(1);
		await registry.shutdown();
	});

	it('issues a different id for each project', async () => {
		const registry = createRegistry();
		const a = registry.add(await tempRoot());
		const b = registry.add(await tempRoot());
		expect(a.id).not.toBe(b.id);
		await registry.shutdown();
	});

	it('throws for an unknown projectId', () => {
		const registry = createRegistry();
		expect(() => registry.get('nope')).toThrow(UnknownProjectError);
	});

	it('removes a project directory', async () => {
		const registry = createRegistry();
		const root = await tempRoot();
		const project = registry.add(root);

		await registry.remove(project.id);
		expect(await exists(root)).toBe(false);
		expect(registry.size()).toBe(0);
	});

	it('ignores a remove for an unknown projectId', async () => {
		const registry = createRegistry();
		await expect(registry.remove('nope')).resolves.toBeUndefined();
	});

	it('removes every directory on shutdown', async () => {
		const registry = createRegistry();
		const rootA = await tempRoot();
		const rootB = await tempRoot();
		registry.add(rootA);
		registry.add(rootB);

		await registry.shutdown();

		expect(await exists(rootA)).toBe(false);
		expect(await exists(rootB)).toBe(false);
		expect(registry.size()).toBe(0);
	});

	it('serializes operations for the same project', async () => {
		const registry = createRegistry();
		const project = registry.add(await tempRoot());
		const order: string[] = [];

		const slow = registry.withProject(project.id, async () => {
			order.push('a:start');
			await new Promise((resolve) => setTimeout(resolve, 20));
			order.push('a:end');
		});
		const fast = registry.withProject(project.id, async () => {
			order.push('b:start');
			order.push('b:end');
		});

		await Promise.all([slow, fast]);
		expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
		await registry.shutdown();
	});

	it('keeps the queue usable after a task fails', async () => {
		const registry = createRegistry();
		const project = registry.add(await tempRoot());

		const failing = registry.withProject(project.id, () => Promise.reject(new Error('boom')));
		await expect(failing).rejects.toThrow('boom');

		await expect(registry.withProject(project.id, async () => 'ok')).resolves.toBe('ok');
		await registry.shutdown();
	});

	it('does not serialize across different projects', async () => {
		const registry = createRegistry();
		const a = registry.add(await tempRoot());
		const b = registry.add(await tempRoot());
		const order: string[] = [];

		const first = registry.withProject(a.id, async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
			order.push('a');
		});
		const second = registry.withProject(b.id, async () => {
			order.push('b');
		});

		await Promise.all([first, second]);
		expect(order).toEqual(['b', 'a']);
		await registry.shutdown();
	});

	it('throws from withProject for an unknown projectId', () => {
		const registry = createRegistry();
		expect(() => registry.withProject('nope', async () => 1)).toThrow(UnknownProjectError);
	});
});
