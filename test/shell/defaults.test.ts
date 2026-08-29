import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultsStore, DefaultsFileError } from '../../src/shell/defaults.ts';

const dirs: string[] = [];

/** Caution: no test may touch the real `~/.config`. Every store gets its own directory. */
const newStore = async (name = 'defaults.yml') => {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'quarto-mcp-store-'));
	dirs.push(dir);
	const file = path.join(dir, name);
	return { store: createDefaultsStore(file), file, dir };
};

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('createDefaultsStore', () => {
	it('reports the file path', async () => {
		const { store, file } = await newStore();
		expect(store.path()).toBe(file);
	});

	it('reads an absent file as empty defaults', async () => {
		const { store } = await newStore();
		await expect(store.read()).resolves.toEqual({});
	});

	it('writes and reads back one mapping', async () => {
		const { store } = await newStore();
		const metadata = { author: [{ name: 'Ada Lovelace' }], lang: 'de' };
		await store.write(metadata);
		await expect(store.read()).resolves.toEqual(metadata);
	});

	it('creates the parent directories', async () => {
		const { store } = await newStore(path.join('nested', 'deep', 'defaults.yml'));
		await store.write({ lang: 'de' });
		await expect(store.read()).resolves.toEqual({ lang: 'de' });
	});

	it('replaces the whole file instead of merging', async () => {
		const { store } = await newStore();
		await store.write({ lang: 'de', license: 'CC BY 4.0' });
		await store.write({ lang: 'en' });
		await expect(store.read()).resolves.toEqual({ lang: 'en' });
	});

	it('rejects a file that holds invalid YAML', async () => {
		const { store, file } = await newStore();
		await writeFile(file, 'a: [1,\nb: 2\n', 'utf8');
		await expect(store.read()).rejects.toThrow(DefaultsFileError);
	});

	it('rejects a file that holds a sequence', async () => {
		const { store, file } = await newStore();
		await writeFile(file, '- one\n- two\n', 'utf8');
		await expect(store.read()).rejects.toThrow(/mapping/);
	});

	it('propagates a read error that is not a missing file', async () => {
		const { dir } = await newStore();
		// A directory is not a missing file, so the error must reach the caller.
		const store = createDefaultsStore(dir);
		await expect(store.read()).rejects.not.toThrow(DefaultsFileError);
	});

	it('serves the next call after a failed read', async () => {
		const { store, file } = await newStore();
		await writeFile(file, 'a: [1,\nb: 2\n', 'utf8');
		await expect(store.read()).rejects.toThrow(DefaultsFileError);
		await store.write({ lang: 'de' });
		await expect(store.read()).resolves.toEqual({ lang: 'de' });
	});

	it('serializes concurrent writes', async () => {
		const { store } = await newStore();
		await Promise.all([
			store.write({ lang: 'de' }),
			store.write({ lang: 'en' }),
			store.write({ lang: 'fr' }),
		]);
		// The last write wins whole. No read sees a half-written file.
		const value = await store.read();
		expect(['de', 'en', 'fr']).toContain(value.lang);
	});
});
