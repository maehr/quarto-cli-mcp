import { err, ok, type Result } from './result.ts';

/**
 * A client controls the project type and the output format. Quarto reads a leading dash as an
 * option, so both are constrained to a conservative character set before they reach an
 * argument array.
 */
export type ArgError =
	| { readonly kind: 'invalid-project-type'; readonly value: string }
	| { readonly kind: 'invalid-format'; readonly value: string };

export const describeArgError = (error: ArgError): string => {
	switch (error.kind) {
		case 'invalid-project-type':
			return `The project type "${error.value}" is not a plain name.`;
		case 'invalid-format':
			return `The format "${error.value}" is not a plain format name.`;
	}
};

const PROJECT_TYPE = /^[a-z][a-z0-9-]*$/i;
// A Quarto format can carry a variant, for example `html` or `gfm+footnotes`.
const FORMAT = /^[a-z0-9][a-z0-9._+-]*$/i;

export const validateProjectType = (value: string): Result<string, ArgError> =>
	PROJECT_TYPE.test(value) ? ok(value) : err({ kind: 'invalid-project-type', value });

export const validateFormat = (value: string): Result<string, ArgError> =>
	FORMAT.test(value) ? ok(value) : err({ kind: 'invalid-format', value });

/** `quarto create project <type> . --no-open --no-prompt`, run with the project root as cwd. */
export const buildCreateArgs = (type: string): readonly string[] => [
	'create',
	'project',
	type,
	'.',
	'--no-open',
	'--no-prompt',
];

export type RenderArgs = {
	readonly input?: string | undefined;
	readonly to?: string | undefined;
	readonly output?: string | undefined;
	readonly execute?: boolean | undefined;
};

/**
 * Execution is off unless the client asks for it. `--no-execute` is not a sandbox; see
 * SECURITY.md for what it does and does not promise.
 */
export const buildRenderArgs = (options: RenderArgs): readonly string[] => {
	const args: string[] = ['render'];
	if (options.input !== undefined) {
		args.push(options.input);
	}
	if (options.to !== undefined) {
		args.push('--to', options.to);
	}
	if (options.output !== undefined) {
		args.push('--output', options.output);
	}
	args.push(options.execute === true ? '--execute' : '--no-execute');
	return args;
};

export const buildInspectArgs = (input?: string | undefined): readonly string[] =>
	input === undefined ? ['inspect'] : ['inspect', input];
