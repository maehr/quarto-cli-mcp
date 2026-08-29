import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDefaultsStore, type DefaultsStore } from '../../src/shell/defaults.ts';

const dirs: string[] = [];

/**
 * A defaults store backed by a temporary file.
 *
 * Caution: no test may touch the real `~/.config`. Every test gets its own file.
 */
export const tempDefaultsStore = (): DefaultsStore => {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'quarto-mcp-defaults-'));
	dirs.push(dir);
	return createDefaultsStore(path.join(dir, 'defaults.yml'));
};

/** Remove every temporary defaults directory. Call it from `afterEach`. */
export const cleanupDefaults = (): void => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
};
