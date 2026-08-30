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
| `quarto_defaults_get` | Read the stored metadata defaults and the path of their file. |
| `quarto_defaults_set` | Store the metadata defaults for every new project. |

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

### Remember your author details

Store your name, your affiliation, and your ORCID one time. Call `quarto_defaults_set`:

```json
{
  "metadata": {
    "author": [
      {
        "name": "Ada Lovelace",
        "orcid": "0000-0002-1825-0097",
        "affiliations": [{ "name": "University of Basel" }]
      }
    ],
    "lang": "en",
    "license": "CC BY 4.0"
  }
}
```

The server writes the value to `~/.config/quarto-cli-mcp/defaults.yml`:

```yaml
# Managed by quarto-cli-mcp. Written into new projects as _metadata.yml.
author:
  - name: Ada Lovelace
    orcid: 0000-0002-1825-0097
    affiliations:
      - name: University of Basel
lang: en
license: CC BY 4.0
```

Every later `quarto_create_project` call copies that file into the new project as `_metadata.yml`.
Quarto merges `_metadata.yml` over `_quarto.yml`, so the author reaches each document.

The defaults survive a server restart. You can edit the file by hand.

To use other metadata for one project, pass `metadata` to `quarto_create_project`. The value
replaces the defaults. To skip the defaults, pass `useDefaults: false`. To clear the defaults,
call `quarto_defaults_set` with an empty `metadata` object.

#### Know these three limits

Quarto owns the merge. The server writes one file and changes nothing else.

1. Keep `format` out of the defaults. A `format` key in the defaults drops the formats of the
   project. A project that asks for `pdf` then renders `html` only.
2. An author in the defaults is additive. A project that names one other author still carries the
   author from the defaults. To get one author list, set `useDefaults: false`, or pass an explicit
   `metadata`. An `author` key in a document front matter does replace the inherited list, but the
   `authors` spelling does not.
3. The defaults reach the project root only. A document in `chapters/` gets nothing from them. This
   limits their value for a book or for a manuscript.

Read the [Limits section of `SPECS.md`](SPECS.md#limits) for the measured table.

### Server limits

Set these environment variables to change the process limits. They are server configuration,
never tool parameters.

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUARTO_MCP_RENDER_TIMEOUT_MS` | `120000` | Stop a Quarto run after this time. |
| `QUARTO_MCP_MAX_OUTPUT_BYTES` | `1048576` | Cap `stdout` and `stderr` per run. |
| `QUARTO_MCP_MAX_PROJECT_BYTES` | `268435456` | Temporary storage budget. |
| `QUARTO_MCP_LOG_LEVEL` | `info` | Pino log level. Logs go to stderr. |
| `QUARTO_MCP_DEFAULTS_FILE` | see below | The metadata defaults file. |

The server resolves the defaults file in this order. The first match wins:
`QUARTO_MCP_DEFAULTS_FILE`, then `$XDG_CONFIG_HOME/quarto-cli-mcp/defaults.yml`, then
`~/.config/quarto-cli-mcp/defaults.yml`.

## Status

Version 0.2 is in development.

## Security

Document code execution is off by default. `--no-execute` is not a sandbox. Quarto configuration
can start other programs, for example through render hooks or filters. Version 0.2 assumes
trusted project input. Use an OS or container sandbox when project input is untrusted.

Read [`SECURITY.md`](SECURITY.md) to report a vulnerability.

## License

[AGPL-3.0-only](LICENSE)
