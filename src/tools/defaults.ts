import { z } from 'zod';
import type { Metadata } from '../core/defaults.ts';
import type { DefaultsStore } from '../shell/defaults.ts';

export const defaultsGetInputSchema = z.object({});

export const defaultsSetInputSchema = z.object({
	metadata: z
		.record(z.string(), z.unknown())
		.describe(
			'Generic YAML data, such as author, affiliation, and ORCID. It replaces the stored ' +
				'defaults. Send an empty object to clear them.',
		),
});

export type DefaultsSetInput = z.infer<typeof defaultsSetInputSchema>;

export type DefaultsResult = {
	readonly path: string;
	readonly metadata: Metadata;
};

export type DefaultsDeps = { readonly defaults: DefaultsStore };

export const getDefaults = async (deps: DefaultsDeps): Promise<DefaultsResult> => ({
	path: deps.defaults.path(),
	metadata: await deps.defaults.read(),
});

export const setDefaults = async (
	input: DefaultsSetInput,
	deps: DefaultsDeps,
): Promise<DefaultsResult> => {
	await deps.defaults.write(input.metadata);
	return { path: deps.defaults.path(), metadata: input.metadata };
};
