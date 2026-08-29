import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	describePathError,
	isIgnoredPath,
	type PathError,
	toProjectRelative,
	validateRelativePath,
} from '../../src/core/paths.ts';

const ROOT = path.resolve('/tmp/project');

describe('validateRelativePath', () => {
	it('accepts a plain relative path', () => {
		const result = validateRelativePath(ROOT, 'hello.qmd');
		expect(result).toEqual({ ok: true, value: path.join(ROOT, 'hello.qmd') });
	});

	it('accepts a nested relative path', () => {
		const result = validateRelativePath(ROOT, 'posts/first/index.qmd');
		expect(result).toEqual({ ok: true, value: path.join(ROOT, 'posts/first/index.qmd') });
	});

	it('accepts the project root itself', () => {
		expect(validateRelativePath(ROOT, '.')).toEqual({ ok: true, value: ROOT });
	});

	it('accepts a path that leaves and returns inside the root', () => {
		const result = validateRelativePath(ROOT, 'posts/../hello.qmd');
		expect(result).toEqual({ ok: true, value: path.join(ROOT, 'hello.qmd') });
	});

	it('rejects an empty path', () => {
		expect(validateRelativePath(ROOT, '')).toEqual({ ok: false, error: { kind: 'empty' } });
	});

	it('rejects an absolute path', () => {
		expect(validateRelativePath(ROOT, '/etc/passwd')).toEqual({
			ok: false,
			error: { kind: 'absolute', value: '/etc/passwd' },
		});
	});

	it('rejects a single dash, which Quarto reads as stdout', () => {
		expect(validateRelativePath(ROOT, '-')).toEqual({
			ok: false,
			error: { kind: 'option-like', value: '-' },
		});
	});

	it('rejects an option-like value', () => {
		expect(validateRelativePath(ROOT, '--output-dir')).toEqual({
			ok: false,
			error: { kind: 'option-like', value: '--output-dir' },
		});
	});

	it('rejects a parent escape', () => {
		expect(validateRelativePath(ROOT, '../secret.qmd')).toEqual({
			ok: false,
			error: { kind: 'escapes-root', value: '../secret.qmd' },
		});
	});

	it('rejects a deep parent escape', () => {
		expect(validateRelativePath(ROOT, 'a/b/../../../outside.qmd')).toEqual({
			ok: false,
			error: { kind: 'escapes-root', value: 'a/b/../../../outside.qmd' },
		});
	});

	it('rejects a sibling directory that shares the root prefix', () => {
		// `/tmp/project-other` starts with `/tmp/project` as a string but is not inside it.
		expect(validateRelativePath(ROOT, '../project-other/file.qmd')).toEqual({
			ok: false,
			error: { kind: 'escapes-root', value: '../project-other/file.qmd' },
		});
	});

	it('resolves the root argument before comparing', () => {
		const result = validateRelativePath(`${ROOT}/nested/..`, 'hello.qmd');
		expect(result).toEqual({ ok: true, value: path.join(ROOT, 'hello.qmd') });
	});
});

describe('describePathError', () => {
	const cases: readonly [PathError, string][] = [
		[{ kind: 'empty' }, 'empty'],
		[{ kind: 'absolute', value: '/x' }, 'absolute'],
		[{ kind: 'option-like', value: '-x' }, '"-"'],
		[{ kind: 'escapes-root', value: '../x' }, 'outside'],
	];

	for (const [error, fragment] of cases) {
		it(`describes ${error.kind}`, () => {
			expect(describePathError(error)).toContain(fragment);
		});
	}
});

describe('toProjectRelative', () => {
	it('returns a project-relative path', () => {
		expect(toProjectRelative(ROOT, path.join(ROOT, 'a', 'b.qmd'))).toBe('a/b.qmd');
	});

	it('returns an empty string for the root itself', () => {
		expect(toProjectRelative(ROOT, ROOT)).toBe('');
	});
});

describe('isIgnoredPath', () => {
	it('ignores the Quarto cache directory', () => {
		expect(isIgnoredPath('.quarto/xref/INDEX')).toBe(true);
	});

	it('ignores a nested Quarto cache directory', () => {
		expect(isIgnoredPath('posts/.quarto/cache')).toBe(true);
	});

	it('keeps a normal output file', () => {
		expect(isIgnoredPath('hello.html')).toBe(false);
	});

	it('keeps a name that merely starts with the ignored name', () => {
		expect(isIgnoredPath('.quartorc')).toBe(false);
	});
});
