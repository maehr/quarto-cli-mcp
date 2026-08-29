# Security Policy

## Supported versions

This project is at version 0.1 and is in development. Only the `main` branch receives fixes.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

Report it in one of these two ways:

1. Open a [private security advisory](https://github.com/maehr/quarto-cli-mcp/security/advisories/new).
2. Email [moritz.maehr@gmail.com](mailto:moritz.maehr@gmail.com).

Include the affected version, the steps to reproduce, and the impact you expect.

## Response times

| Stage | Target |
| --- | --- |
| Acknowledgement | 5 working days |
| Initial assessment | 10 working days |
| Public disclosure | 90 days after the report, or earlier when a fix ships |

## Threat model

Read this before you report. These properties are documented behavior, not defects.

The server assumes trusted project input in version 0.1.

Document code execution is off by default. `--no-execute` is not a sandbox. Quarto configuration
can start other programs, for example through render hooks or filters. A client that controls
`_quarto.yml` can therefore run code. Use an OS or container sandbox when project input is
untrusted.

Quarto inspect output can contain absolute paths that Quarto itself produced. The server does
not add them and does not rewrite them.

These properties are in scope and a report is welcome:

- A client path that escapes the project root.
- A project id that reaches another project's directory.
- A client value that reaches a shell, or that is read as a Quarto command-line option.
- A client-supplied executable path.
- A project directory that survives after the server stops.

## AI assistants

An AI assistant may help draft a report. Verify every claim before you send it. Do not send a
generated report that you have not reproduced.
