import { describe, expect, it } from 'vitest';
import { diffSnapshots, type Snapshot } from '../../src/core/snapshot.ts';

const snapshot = (entries: Record<string, [number, number]>): Snapshot =>
	new Map(Object.entries(entries).map(([p, [size, mtimeMs]]) => [p, { size, mtimeMs }]));

describe('diffSnapshots', () => {
	it('reports a created file', () => {
		const before = snapshot({});
		const after = snapshot({ 'hello.html': [10, 1] });
		expect(diffSnapshots(before, after)).toEqual(['hello.html']);
	});

	it('reports a file whose size changed', () => {
		const before = snapshot({ 'hello.html': [10, 1] });
		const after = snapshot({ 'hello.html': [20, 1] });
		expect(diffSnapshots(before, after)).toEqual(['hello.html']);
	});

	it('reports a file whose modification time changed', () => {
		const before = snapshot({ 'hello.html': [10, 1] });
		const after = snapshot({ 'hello.html': [10, 2] });
		expect(diffSnapshots(before, after)).toEqual(['hello.html']);
	});

	it('ignores an unchanged file', () => {
		const before = snapshot({ 'hello.qmd': [10, 1] });
		const after = snapshot({ 'hello.qmd': [10, 1] });
		expect(diffSnapshots(before, after)).toEqual([]);
	});

	it('does not report a deleted file', () => {
		const before = snapshot({ 'gone.qmd': [10, 1] });
		const after = snapshot({});
		expect(diffSnapshots(before, after)).toEqual([]);
	});

	it('drops the Quarto cache directory', () => {
		const before = snapshot({});
		const after = snapshot({ '.quarto/xref/INDEX': [5, 1], 'hello.html': [10, 1] });
		expect(diffSnapshots(before, after)).toEqual(['hello.html']);
	});

	it('sorts the result', () => {
		const before = snapshot({});
		const after = snapshot({ 'b.html': [1, 1], 'a.html': [1, 1], 'c/d.html': [1, 1] });
		expect(diffSnapshots(before, after)).toEqual(['a.html', 'b.html', 'c/d.html']);
	});

	it('reports the support files a render creates', () => {
		const before = snapshot({ 'hello.qmd': [10, 1] });
		const after = snapshot({
			'hello.qmd': [10, 1],
			'hello.html': [200, 2],
			'hello_files/libs/bootstrap/bootstrap.min.js': [50, 2],
			'.quarto/project-cache/x': [1, 2],
		});
		expect(diffSnapshots(before, after)).toEqual([
			'hello.html',
			'hello_files/libs/bootstrap/bootstrap.min.js',
		]);
	});
});
