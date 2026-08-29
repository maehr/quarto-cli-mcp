import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, mapResult, ok } from '../../src/core/result.ts';

describe('ok', () => {
	it('wraps a value', () => {
		expect(ok(1)).toEqual({ ok: true, value: 1 });
	});
});

describe('err', () => {
	it('wraps an error', () => {
		expect(err('boom')).toEqual({ ok: false, error: 'boom' });
	});
});

describe('isOk', () => {
	it('is true for a success', () => {
		expect(isOk(ok(1))).toBe(true);
	});

	it('is false for a failure', () => {
		expect(isOk(err('boom'))).toBe(false);
	});
});

describe('isErr', () => {
	it('is true for a failure', () => {
		expect(isErr(err('boom'))).toBe(true);
	});

	it('is false for a success', () => {
		expect(isErr(ok(1))).toBe(false);
	});
});

describe('mapResult', () => {
	it('maps a success value', () => {
		expect(mapResult(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
	});

	it('passes an error through unchanged', () => {
		const failure = err('boom');
		expect(mapResult(failure, (n: number) => n * 3)).toBe(failure);
	});
});
