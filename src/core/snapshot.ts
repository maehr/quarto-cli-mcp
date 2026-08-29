import { isIgnoredPath } from './paths.ts';

export type FileStat = {
	readonly size: number;
	readonly mtimeMs: number;
};

/** Project-relative path to its size and modification time. */
export type Snapshot = ReadonlyMap<string, FileStat>;

const hasChanged = (before: FileStat | undefined, after: FileStat): boolean =>
	before === undefined || before.size !== after.size || before.mtimeMs !== after.mtimeMs;

/**
 * Report the files a render created or modified.
 *
 * Deleted files are not reported. SPECS.md defines the result as files "created or modified by
 * this render", and a client cannot read a file that no longer exists.
 *
 * Paths under `.quarto/` are dropped. That directory is Quarto's own cache.
 */
export const diffSnapshots = (before: Snapshot, after: Snapshot): readonly string[] => {
	const changed: string[] = [];
	for (const [filePath, stat] of after) {
		if (isIgnoredPath(filePath)) {
			continue;
		}
		if (hasChanged(before.get(filePath), stat)) {
			changed.push(filePath);
		}
	}
	return changed.sort();
};
