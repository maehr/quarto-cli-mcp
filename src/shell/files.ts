import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isIgnoredPath } from '../core/paths.ts';
import type { FileStat, Snapshot } from '../core/snapshot.ts';

/** Create an empty temporary directory to hold one Quarto project. */
export const makeProjectDir = (): Promise<string> => mkdtemp(path.join(os.tmpdir(), 'quarto-mcp-'));

export const removeDir = (dir: string): Promise<void> => rm(dir, { recursive: true, force: true });

/** Write one UTF-8 text file, creating parent directories as needed. */
export const writeTextFile = async (absolutePath: string, content: string): Promise<void> => {
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, content, 'utf8');
};

/**
 * Walk the project and record each file's size and modification time.
 *
 * Paths under `.quarto/` are skipped during the walk rather than filtered afterwards, because
 * that directory can hold a large cache and reading it would cost time for a result the
 * client never sees.
 */
export const snapshotTree = async (root: string): Promise<Snapshot> => {
	const entries = new Map<string, FileStat>();

	const walk = async (dir: string, prefix: string): Promise<void> => {
		const found = await readdir(dir, { withFileTypes: true });
		await Promise.all(
			found.map(async (entry) => {
				const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
				if (isIgnoredPath(relative)) {
					return;
				}
				const absolute = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					await walk(absolute, relative);
					return;
				}
				// A symbolic link is recorded by its own metadata, never followed.
				if (!entry.isFile()) {
					return;
				}
				const info = await stat(absolute);
				entries.set(relative, { size: info.size, mtimeMs: info.mtimeMs });
			}),
		);
	};

	await walk(root, '');
	return entries;
};
