#!/usr/bin/env node
import os from 'node:os';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pino from 'pino';
import { parseServerConfig } from './core/config.ts';
import { resolveDefaultsPath } from './core/defaults.ts';
import { createServer } from './server.ts';
import { createDefaultsStore } from './shell/defaults.ts';
import { createRegistry } from './shell/registry.ts';

// Stdout carries the MCP protocol, so every log line goes to stderr.
const logger = pino({ level: process.env.QUARTO_MCP_LOG_LEVEL ?? 'info' }, pino.destination(2));

const main = async (): Promise<void> => {
	const config = parseServerConfig(process.env);
	if (!config.ok) {
		logger.error(config.error);
		process.exitCode = 1;
		return;
	}

	const registry = createRegistry();
	const defaultsPath = resolveDefaultsPath(process.env, os.homedir());
	const defaults = createDefaultsStore(defaultsPath);
	const server = createServer({ registry, config: config.value, defaults });

	let shuttingDown = false;
	const shutdown = async (reason: string): Promise<void> => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		logger.info({ reason }, 'Removing temporary projects.');
		await registry.shutdown();
		process.exit(0);
	};

	for (const signal of ['SIGINT', 'SIGTERM'] as const) {
		process.on(signal, () => {
			void shutdown(signal);
		});
	}

	// An MCP client stops a stdio server by closing the pipe, not by a signal. The stdio transport
	// listens for `data` and for `error` only, so nothing else reports that end. Without this
	// handler the process exits on its own and leaves every temporary project on disk.
	//
	// The pending removals hold the event loop open, so the cleanup finishes before the exit.
	process.stdin.on('end', () => {
		void shutdown('stdin-end');
	});

	await server.connect(new StdioServerTransport());
	logger.info({ limits: config.value, defaultsPath }, 'Quarto MCP server ready on stdio.');
};

main().catch((cause: unknown) => {
	logger.error({ cause }, 'The server stopped with an error.');
	process.exitCode = 1;
});
