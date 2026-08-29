import { afterEach, describe, expect, it } from 'vitest';
import { getDefaults, setDefaults } from '../../src/tools/defaults.ts';
import { cleanupDefaults, tempDefaultsStore } from '../support/defaults.ts';

afterEach(cleanupDefaults);

const AUTHOR = { author: [{ name: 'Ada Lovelace', orcid: '0000-0002-1825-0097' }] };

describe('quarto_defaults_get', () => {
	it('returns empty metadata and the file path before anything is stored', async () => {
		const defaults = tempDefaultsStore();
		await expect(getDefaults({ defaults })).resolves.toEqual({
			path: defaults.path(),
			metadata: {},
		});
	});
});

describe('quarto_defaults_set', () => {
	it('stores metadata and reads it back', async () => {
		const defaults = tempDefaultsStore();
		await expect(setDefaults({ metadata: AUTHOR }, { defaults })).resolves.toEqual({
			path: defaults.path(),
			metadata: AUTHOR,
		});
		await expect(getDefaults({ defaults })).resolves.toEqual({
			path: defaults.path(),
			metadata: AUTHOR,
		});
	});

	it('replaces the whole file instead of merging', async () => {
		const defaults = tempDefaultsStore();
		await setDefaults({ metadata: { lang: 'de', license: 'CC BY 4.0' } }, { defaults });
		await setDefaults({ metadata: { lang: 'en' } }, { defaults });
		await expect(getDefaults({ defaults })).resolves.toEqual({
			path: defaults.path(),
			metadata: { lang: 'en' },
		});
	});

	it('clears the defaults with an empty mapping', async () => {
		const defaults = tempDefaultsStore();
		await setDefaults({ metadata: AUTHOR }, { defaults });
		await setDefaults({ metadata: {} }, { defaults });
		await expect(getDefaults({ defaults })).resolves.toEqual({
			path: defaults.path(),
			metadata: {},
		});
	});
});
