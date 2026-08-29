import path from 'node:path';
import { err, ok, type Result } from './result.ts';

/**
 * Why every path is checked here: a client controls these strings. Quarto reads a leading
 * dash as an option, and `..` reaches outside the temporary project. Both are rejected
 * before any value reaches a process argument.
 */
export type PathError =
	| { readonly kind: 'empty' }
	| { readonly kind: 'absolute'; readonly value: string }
	| { readonly kind: 'option-like'; readonly value: string }
	| { readonly kind: 'escapes-root'; readonly value: string };

export const describePathError = (error: PathError): string => {
	switch (error.kind) {
		case 'empty':
			return 'The path is empty.';
		case 'absolute':
			return `The path "${error.value}" is absolute. Use a path relative to the project root.`;
		case 'option-like':
			return `The path "${error.value}" starts with "-". Quarto would read it as an option.`;
		case 'escapes-root':
			return `The path "${error.value}" resolves outside the project root.`;
	}
};

/**
 * Resolve a client path against the project root.
 *
 * The check is lexical. It does not follow symbolic links inside the project. Version 0.1
 * assumes trusted project input, so a symbolic link that a client wrote is out of scope.
 *
 * @returns the absolute resolved path, when the path is inside the root.
 */
export const validateRelativePath = (
	root: string,
	candidate: string,
): Result<string, PathError> => {
	if (candidate === '') {
		return err({ kind: 'empty' });
	}
	if (candidate.startsWith('-')) {
		return err({ kind: 'option-like', value: candidate });
	}
	if (path.isAbsolute(candidate)) {
		return err({ kind: 'absolute', value: candidate });
	}

	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(resolvedRoot, candidate);
	if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
		return err({ kind: 'escapes-root', value: candidate });
	}
	return ok(resolved);
};

/** Express an absolute path inside the root as a project-relative path with `/` separators. */
export const toProjectRelative = (root: string, absolute: string): string =>
	path.relative(path.resolve(root), absolute).split(path.sep).join('/');

/** Quarto writes its cache and cross-reference index here. It is noise for a client. */
const IGNORED_SEGMENTS = new Set(['.quarto']);

export const isIgnoredPath = (relativePath: string): boolean =>
	relativePath.split('/').some((segment) => IGNORED_SEGMENTS.has(segment));
