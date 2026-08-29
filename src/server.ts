import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from './core/config.ts';
import type { DefaultsStore } from './shell/defaults.ts';
import type { Registry } from './shell/registry.ts';
import { createProject, createProjectInputSchema } from './tools/create.ts';
import {
	defaultsGetInputSchema,
	defaultsSetInputSchema,
	getDefaults,
	setDefaults,
} from './tools/defaults.ts';
import { inspect, inspectInputSchema } from './tools/inspect.ts';
import { render, renderInputSchema } from './tools/render.ts';

export const SERVER_NAME = 'quarto-cli-mcp';
export const SERVER_VERSION = '0.1.0';

/** Every tool returns JSON. The MCP content block carries it as text. */
const asContent = (value: unknown) => ({
	content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

export const createServer = (deps: {
	readonly registry: Registry;
	readonly config: ServerConfig;
	readonly defaults: DefaultsStore;
}): McpServer => {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

	server.registerTool(
		'quarto_create_project',
		{
			title: 'Create a Quarto project',
			description:
				'Create a temporary Quarto project and write initial files into it. Returns an opaque ' +
				'projectId that is valid only while this server process runs.',
			inputSchema: createProjectInputSchema.shape,
		},
		async (input) => asContent(await createProject(input, deps)),
	);

	server.registerTool(
		'quarto_render',
		{
			title: 'Render a Quarto project',
			description:
				'Render the project, or one input file. Code execution is off unless execute is true. ' +
				'A Quarto failure is reported as success: false, with stdout and stderr preserved.',
			inputSchema: renderInputSchema.shape,
		},
		async ({ projectId, ...rest }) =>
			// The registry serializes operations for the same project.
			asContent(
				await deps.registry.withProject(projectId, (project) =>
					render({ projectId, ...rest }, { project, config: deps.config }),
				),
			),
	);

	server.registerTool(
		'quarto_inspect',
		{
			title: 'Inspect a Quarto project',
			description:
				"Return Quarto's inspect JSON for the project, or for one input file. The output is " +
				'passed through without field changes.',
			inputSchema: inspectInputSchema.shape,
		},
		async ({ projectId, ...rest }) =>
			asContent(
				await deps.registry.withProject(projectId, (project) =>
					inspect({ projectId, ...rest }, { project, config: deps.config }),
				),
			),
	);

	server.registerTool(
		'quarto_defaults_get',
		{
			title: 'Read the stored metadata defaults',
			description:
				'Return the Quarto metadata that every new project receives as _metadata.yml, and the ' +
				'path of the file that holds it. An absent file returns empty metadata.',
			inputSchema: defaultsGetInputSchema.shape,
		},
		async () => asContent(await getDefaults(deps)),
	);

	server.registerTool(
		'quarto_defaults_set',
		{
			title: 'Store the metadata defaults',
			description:
				'Store Quarto metadata, such as author, affiliation, and ORCID, for every new project. ' +
				'The call replaces the whole file. Send empty metadata to clear the defaults.',
			inputSchema: defaultsSetInputSchema.shape,
		},
		async (input) => asContent(await setDefaults(input, deps)),
	);

	return server;
};
