import path from 'node:path';
import { parse, stringify } from 'yaml';
import type { Env } from './config.ts';
import { err, ok, type Result } from './result.ts';

/**
 * The metadata defaults are generic YAML data. The server defines no Quarto schema, because
 * SPECS.md keeps Quarto as the source of truth for configuration.
 */
export type Metadata = Readonly<Record<string, unknown>>;

const CONFIG_DIR = 'quarto-cli-mcp';
const DEFAULTS_FILE = 'defaults.yml';

/** The file is meant to be read and edited by hand, so it says what writes it. */
const HEADER = '# Managed by quarto-cli-mcp. Written into new projects as _metadata.yml.\n';

export type DefaultsError =
	| { readonly kind: 'invalid-yaml'; readonly message: string }
	| { readonly kind: 'not-a-mapping' };

export const describeDefaultsError = (error: DefaultsError): string => {
	switch (error.kind) {
		case 'invalid-yaml':
			return `The defaults file does not hold valid YAML. ${error.message}`;
		case 'not-a-mapping':
			return 'The defaults file must hold one YAML mapping, not a scalar or a sequence.';
	}
};

/**
 * Read the stored defaults.
 *
 * An empty file parses to `null`. That is "no defaults", not a failure, so it returns an empty
 * mapping. A scalar or a sequence is a failure, because neither can become document metadata.
 */
export const parseDefaults = (text: string): Result<Metadata, DefaultsError> => {
	let document: unknown;
	try {
		document = parse(text);
	} catch (cause) {
		return err({ kind: 'invalid-yaml', message: String(cause) });
	}
	if (document === null) {
		return ok({});
	}
	if (typeof document !== 'object' || Array.isArray(document)) {
		return err({ kind: 'not-a-mapping' });
	}
	return ok(document as Metadata);
};

export const serializeDefaults = (metadata: Metadata): string => `${HEADER}${stringify(metadata)}`;

/**
 * Resolve the defaults file path. The first match wins.
 *
 * `homeDir` is a parameter rather than a call to `os.homedir()`, because this module stays pure.
 */
export const resolveDefaultsPath = (env: Env, homeDir: string): string => {
	const explicit = env.QUARTO_MCP_DEFAULTS_FILE;
	if (explicit !== undefined && explicit !== '') {
		return explicit;
	}
	const configHome = env.XDG_CONFIG_HOME;
	if (configHome !== undefined && configHome !== '') {
		return path.join(configHome, CONFIG_DIR, DEFAULTS_FILE);
	}
	return path.join(homeDir, '.config', CONFIG_DIR, DEFAULTS_FILE);
};
