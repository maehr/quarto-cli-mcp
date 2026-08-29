/**
 * A small `Result` type for expected failures.
 *
 * Use it in `src/core/` instead of throwing. A thrown error in the pure core hides the
 * failure from the type system and forces the caller to guess what can go wrong.
 */
export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(
	result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } => result.ok;

export const isErr = <T, E>(
	result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } => !result.ok;

/** Map the success value. An error passes through unchanged. */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
	result.ok ? ok(fn(result.value)) : result;
