import { describe, expect, it } from 'vitest';
import {
	type ArgError,
	buildCreateArgs,
	buildInspectArgs,
	buildRenderArgs,
	describeArgError,
	validateFormat,
	validateProjectType,
} from '../../src/core/args.ts';

describe('validateProjectType', () => {
	it.each(['default', 'website', 'book', 'manuscript', 'a1-b2'])('accepts %s', (value) => {
		expect(validateProjectType(value)).toEqual({ ok: true, value });
	});

	it.each(['--no-prompt', '-x', '', 'a b', 'a/b', '1abc', 'a;rm'])('rejects %s', (value) => {
		expect(validateProjectType(value)).toEqual({
			ok: false,
			error: { kind: 'invalid-project-type', value },
		});
	});
});

describe('validateFormat', () => {
	it.each(['html', 'pdf', 'gfm+footnotes', 'revealjs', 'docusaurus-md'])('accepts %s', (value) => {
		expect(validateFormat(value)).toEqual({ ok: true, value });
	});

	it.each(['--to', '-html', '', 'html pdf', 'a/b'])('rejects %s', (value) => {
		expect(validateFormat(value)).toEqual({ ok: false, error: { kind: 'invalid-format', value } });
	});
});

describe('describeArgError', () => {
	const cases: readonly [ArgError, string][] = [
		[{ kind: 'invalid-project-type', value: 'x' }, 'project type'],
		[{ kind: 'invalid-format', value: 'x' }, 'format'],
	];

	for (const [error, fragment] of cases) {
		it(`describes ${error.kind}`, () => {
			expect(describeArgError(error)).toContain(fragment);
		});
	}
});

describe('buildCreateArgs', () => {
	it('builds the documented command', () => {
		expect(buildCreateArgs('default')).toEqual([
			'create',
			'project',
			'default',
			'.',
			'--no-open',
			'--no-prompt',
		]);
	});
});

describe('buildRenderArgs', () => {
	it('renders the whole project when no input is given', () => {
		expect(buildRenderArgs({})).toEqual(['render', '--no-execute']);
	});

	it('renders one input file', () => {
		expect(buildRenderArgs({ input: 'hello.qmd' })).toEqual([
			'render',
			'hello.qmd',
			'--no-execute',
		]);
	});

	it('adds the format', () => {
		expect(buildRenderArgs({ to: 'html' })).toEqual(['render', '--to', 'html', '--no-execute']);
	});

	it('adds the output file', () => {
		expect(buildRenderArgs({ output: 'out.html' })).toEqual([
			'render',
			'--output',
			'out.html',
			'--no-execute',
		]);
	});

	it('disables execution by default', () => {
		expect(buildRenderArgs({})).toContain('--no-execute');
	});

	it('disables execution when execute is false', () => {
		expect(buildRenderArgs({ execute: false })).toContain('--no-execute');
	});

	it('disables execution when execute is undefined', () => {
		expect(buildRenderArgs({ execute: undefined })).toContain('--no-execute');
	});

	it('enables execution only when execute is true', () => {
		expect(buildRenderArgs({ execute: true })).toEqual(['render', '--execute']);
	});

	it('keeps the documented option order', () => {
		expect(buildRenderArgs({ input: 'a.qmd', to: 'pdf', output: 'a.pdf', execute: true })).toEqual([
			'render',
			'a.qmd',
			'--to',
			'pdf',
			'--output',
			'a.pdf',
			'--execute',
		]);
	});
});

describe('buildInspectArgs', () => {
	it('inspects the project when no input is given', () => {
		expect(buildInspectArgs()).toEqual(['inspect']);
	});

	it('inspects an explicit undefined input as the project', () => {
		expect(buildInspectArgs(undefined)).toEqual(['inspect']);
	});

	it('inspects one input file', () => {
		expect(buildInspectArgs('hello.qmd')).toEqual(['inspect', 'hello.qmd']);
	});
});
