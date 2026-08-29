import { describe, expect, it } from 'vitest';
import { mimeTypeForPath } from '../../src/core/mime.ts';

describe('mimeTypeForPath', () => {
	it.each([
		['hello.html', 'text/html'],
		['a/b/report.pdf', 'application/pdf'],
		['notes.md', 'text/markdown'],
		['source.qmd', 'text/markdown'],
		['data.json', 'application/json'],
		['style.css', 'text/css'],
		['fig.svg', 'image/svg+xml'],
		['book.epub', 'application/epub+zip'],
		['nb.ipynb', 'application/x-ipynb+json'],
	])('maps %s', (input, expected) => {
		expect(mimeTypeForPath(input)).toBe(expected);
	});

	it('ignores extension case', () => {
		expect(mimeTypeForPath('REPORT.PDF')).toBe('application/pdf');
	});

	it('returns undefined for an unknown extension', () => {
		expect(mimeTypeForPath('archive.xyz')).toBeUndefined();
	});

	it('returns undefined when there is no extension', () => {
		expect(mimeTypeForPath('Makefile')).toBeUndefined();
	});

	it('returns undefined for a dotfile', () => {
		expect(mimeTypeForPath('.gitignore')).toBeUndefined();
	});

	it('returns undefined for a dotfile in a directory', () => {
		expect(mimeTypeForPath('a/b/.gitignore')).toBeUndefined();
	});

	it('reads the extension from the file name, not the directory', () => {
		expect(mimeTypeForPath('site.html/README')).toBeUndefined();
	});
});
