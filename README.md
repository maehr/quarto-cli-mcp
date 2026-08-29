# Quarto MCP

A thin [Model Context Protocol](https://modelcontextprotocol.io/) server that wraps the
[Quarto](https://quarto.org/) CLI.

The server creates temporary Quarto projects, writes files into them, renders them, and inspects
them. It does not copy Quarto configuration logic. Quarto stays the source of truth for
configuration, formats, render behavior, and inspect output.

## Tools

| Tool | Purpose |
| --- | --- |
| `quarto_create_project` | Create a temporary Quarto project and write initial files. |
| `quarto_render` | Render the project or one input file. |
| `quarto_inspect` | Return Quarto's inspect JSON for the project or one input file. |

Read [`SPECS.md`](SPECS.md) for the full contract.

## Requirements

- Node.js 22 or later
- [Quarto](https://quarto.org/docs/get-started/) on `PATH`

## Install

```bash
pnpm install
pnpm run build
```

## Use

The server speaks MCP over stdio. Add it to a client configuration:

```json
{
  "mcpServers": {
    "quarto": {
      "command": "node",
      "args": ["/absolute/path/to/quarto-cli-mcp/dist/index.js"]
    }
  }
}
```

A `projectId` is valid only while the server process runs. The server removes every temporary
project when it stops.

### Server limits

Set these environment variables to change the process limits. They are server configuration,
never tool parameters.

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUARTO_MCP_RENDER_TIMEOUT_MS` | `120000` | Stop a Quarto run after this time. |
| `QUARTO_MCP_MAX_OUTPUT_BYTES` | `1048576` | Cap `stdout` and `stderr` per run. |
| `QUARTO_MCP_MAX_PROJECT_BYTES` | `268435456` | Temporary storage budget. |
| `QUARTO_MCP_LOG_LEVEL` | `info` | Pino log level. Logs go to stderr. |

## Status

Version 0.1 is in development.

## Security

Document code execution is off by default. `--no-execute` is not a sandbox. Quarto configuration
can start other programs, for example through render hooks or filters. Version 0.1 assumes
trusted project input. Use an OS or container sandbox when project input is untrusted.

Read [`SECURITY.md`](SECURITY.md) to report a vulnerability.

## License

[AGPL-3.0-only](LICENSE)
