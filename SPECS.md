# Quarto MCP — v0.2

## Goal

Provide a thin MCP wrapper for the Quarto CLI.

The MCP must:

* create a temporary Quarto project,
* write initial project files,
* remember one set of metadata defaults,
* render the project,
* inspect the project.

The MCP must not copy Quarto configuration logic.

Quarto remains the source of truth for configuration, formats, render behavior, and inspect output.

---

## Tools

Expose only these tools:

* `quarto_create_project`
* `quarto_render`
* `quarto_inspect`
* `quarto_defaults_get`
* `quarto_defaults_set`

---

## `quarto_create_project`

```ts
type CreateProjectInput = {
  type?: string; // default: "default"
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  useDefaults?: boolean; // default: true
  files?: Array<{
    path: string;
    content: string;
  }>;
};

type CreateProjectResult = {
  projectId: string;
};
```

### Process

1. Resolve the metadata. See "Metadata Defaults".
2. Create a temporary directory.
3. Run:

```text
quarto create project <type> . --no-open --no-prompt
```

Verified on Quarto 1.10.18: `.` creates the project in the current directory.

4. If `config` exists, replace `_quarto.yml` with its YAML form.
5. If the resolved metadata has one key or more, write `_metadata.yml` with its YAML form.
6. Write `files`.
7. Return `projectId`.

### Rules

* `config` is generic YAML data.
* Reject a `type` that Quarto would read as an option.
* Do not define a Quarto configuration schema.
* Do not merge `config` with generated Quarto configuration.
* If `config` is absent, keep the generated `_quarto.yml`.
* `metadata` is generic YAML data.
* Do not merge `metadata` with `config`. Quarto merges the two files.
* Reject `_quarto.yml` in `files`. This rule applies to the project root only.
* Reject `_metadata.yml` in `files`. This rule applies to the project root only.
* A nested path such as `chapters/_metadata.yml` stays legal.
* `files` contains UTF-8 text files only.
* All file paths are relative to the project root.
* Reject absolute paths and paths outside the project root.

---

## `quarto_render`

```ts
type RenderInput = {
  projectId: string;
  input?: string;
  to?: string;
  output?: string;
  execute?: boolean;
};

type RenderResult = {
  success: boolean;
  files: Array<{
    path: string;
    mimeType?: string;
  }>;
  stdout: string;
  stderr: string;
};
```

### CLI mapping

```text
quarto render [input]
  [--to FORMAT]
  [--output FILE]
  [--execute | --no-execute]
```

### Rules

* If `input` is absent, render the project.
* Keep `to` as a string. Reject a value that Quarto would read as an option.
* Use `--no-execute` by default.
* Use `--execute` only when `execute: true`.
* Put Quarto options in `_quarto.yml`, `_metadata.yml`, or document YAML.
* Do not add other Quarto render options to the MCP API.
* `input` and `output` are relative to the project root.
* Reject absolute paths and paths outside the project root.
* Reject option-like path values.
* Reject `output: "-"`.
* `files` contains files created or modified by this render.
* Exclude paths under `.quarto/`. Quarto uses that directory for its own cache and
  cross-reference index.
* Do not report deleted files. A client cannot read a file that no longer exists.
* Return file paths relative to the project root.
* Determine `mimeType` only when possible.
* Set `success: false` when Quarto exits with a non-zero status.
* Preserve Quarto `stdout` and `stderr`.

---

## `quarto_inspect`

```ts
type InspectInput = {
  projectId: string;
  input?: string;
};

type InspectResult = Record<string, unknown>;
```

### CLI mapping

```text
quarto inspect [input]
```

### Rules

* If `input` is absent, inspect the project.
* `input` is relative to the project root.
* Reject absolute paths and paths outside the project root.
* Parse Quarto stdout as JSON.
* Return the parsed JSON without field changes.
* The MCP must not add absolute paths.
* Quarto inspect output can contain paths produced by Quarto.

---

## `quarto_defaults_get`

```ts
type DefaultsGetInput = Record<string, never>;

type DefaultsResult = {
  path: string;
  metadata: Record<string, unknown>;
};
```

### Rules

* Read the defaults file. See "Metadata Defaults".
* Return an empty `metadata` when the file is absent. An absent file is not an error.
* Return `path`, because the user needs the path to edit the file.
* `path` is the only absolute path that the MCP returns. Project roots stay private.

---

## `quarto_defaults_set`

```ts
type DefaultsSetInput = {
  metadata: Record<string, unknown>;
};

type DefaultsSetResult = DefaultsResult;
```

### Rules

* `metadata` is generic YAML data.
* Replace the whole file. Do not merge the new value with the stored value.
* Create the parent directory when it is absent.
* To clear the defaults, send `metadata: {}`.
* Serialize concurrent writes to the file.
* Return the stored value and the file path.

---

## Metadata Defaults

The MCP stores one set of Quarto metadata on disk.

The defaults file holds the exact YAML that the MCP writes into a new project. The file has no wrapper
and no version key. The user can read and edit the file without a translation step.

The MCP stores one set only. It does not support named profiles.

### File Path

Resolve the path in this order. The first match wins.

1. `QUARTO_MCP_DEFAULTS_FILE`
2. `$XDG_CONFIG_HOME/quarto-cli-mcp/defaults.yml`
3. `~/.config/quarto-cli-mcp/defaults.yml`

The path is server configuration. It is not an MCP tool parameter.

### Resolution

`quarto_create_project` resolves the metadata in this order:

1. If `metadata` is present, use `metadata`.
2. If `metadata` is absent and `useDefaults` is not `false`, use the stored defaults.
3. In all other conditions, use nothing.

### Rules

* The file contains one YAML mapping.
* Treat an empty file as an empty mapping.
* Return a tool error when the file holds invalid YAML.
* Return a tool error when the file holds a scalar or a sequence.
* Caution: resolve the metadata before you create the temporary directory. A malformed file must
  not leave a temporary directory on disk.
* Do not create a project without the metadata when the file is malformed.

### Precedence

Quarto applies metadata in this order: `_quarto.yml`, then `_metadata.yml`, then document YAML.

The MCP writes the resolved metadata to `_metadata.yml`. Quarto merges the two files.

The MCP does not merge YAML.

A scalar key follows that order. A higher level replaces the value of a lower level. A mapping
merges key by key. A sequence does not follow that order. Read "Limits".

| Case | Defaults | Project config | Document | Result |
| --- | --- | --- | --- | --- |
| Scalar | `lang: en` | `lang: de` | — | `en` |
| Scalar | `lang: en` | `lang: de` | `lang: fr` | `fr` |
| Nested mapping | `execute.echo` | `execute.warning` | — | both keys |
| One format | `format.html.toc` | `format.html.theme` | — | both keys |
| Sibling format | `format.html` | `format.pdf` | — | `html` only |
| Author, entries differ | one `author` | one other `author` | — | two authors |
| Author, entries identical | one `author` | the same `author` | — | one author |
| Author in the document | one `author` | one other `author` | one other `author` | the document author only |
| `authors` in the document | one `author` | — | one `authors` | two authors |
| Subdirectory | one `author` | — | — | the project root only |

Measured on Quarto 1.10.18. `test/tools/metadata-merge.test.ts` holds one test for each row. A
Quarto upgrade that changes a rule fails the build.

### Limits

Quarto owns these rules. The MCP cannot change them. Read the two traps first.

#### Trap 1 — a `format` key in the defaults drops the project format

The keys inside one format merge. The format list does not merge. The higher level wins the list.

A project config asks for `pdf`. The defaults hold `format: {html: ...}`. Quarto then renders `html`
only. The `pdf` format and its options disappear.

Keep `format` out of the defaults. Set the format in each project.

#### Trap 2 — an author in the defaults is additive

Quarto joins the `author` sequence of `_quarto.yml` and of `_metadata.yml`. It then removes an entry
that is identical to another entry. It does not replace the sequence.

A project config that names one other author still carries the author from the defaults. Both names
reach the rendered page.

A document behaves differently. An `author` key in the document front matter replaces the whole
inherited list. Only the author of the document reaches the rendered page.

Caution: `quarto inspect` reports the joined list for that case. The render then narrows the list.
Trust the rendered page.

Caution: `authors` is a different key from `author`. An `authors` key in a document does not replace
the inherited `author`. Both names reach the rendered page.

Set `useDefaults: false`, or pass an explicit `metadata`, when a project needs its own author list.

#### Limit — the defaults do not reach a subdirectory

The root `_metadata.yml` applies to documents in the project root only. A document in `chapters/`
gets nothing from it.

This limit reduces the value of the defaults for a book or for a manuscript. Those project types
keep their content in subdirectories.

A nested `chapters/_metadata.yml` applies to its own subtree. Pass such a file through `files`.

The MCP must not work around this limit. This document forbids a YAML merge in the MCP.

---

## Project State

```ts
type ProjectState = {
  id: string;
  root: string;
};
```

`ProjectState` is internal.

Clients use only `projectId`.

### Lifecycle

* Generate opaque random project IDs.
* Keep project roots private.
* Store project state in the MCP server process.
* A project ID is valid only for the current server process.
* Remove a project directory if project creation fails.
* Remove temporary projects when the server stops.
* Serialize operations for the same project.

---

## CLI Execution

Run Quarto without a shell.

```ts
spawn("quarto", args, {
  cwd: project.root,
  shell: false
});
```

The Quarto executable is server-controlled.

Do not accept an executable path from the client.

Use argument arrays only.

---

## Path Safety

Apply path checks to all MCP path parameters and file writes.

The MCP must:

* reject absolute paths,
* reject `..` path escapes,
* reject paths that resolve outside the project root.

Do not inspect Quarto configuration to find embedded paths.

---

## Execution Safety

Document code execution is disabled by default.

`--no-execute` is not a security sandbox.

Quarto configuration can run other programs, for example through render hooks or filters.

Version 0.2 assumes trusted project input.

Use an OS or container sandbox when project input is untrusted.

Do not copy Quarto security or configuration rules into the MCP.

---

## Process Limits

The server should define:

* a render timeout,
* stdout and stderr size limits,
* temporary storage limits.

These limits are server configuration.

They are not MCP tool parameters.

---

## Errors

Return an MCP tool error for:

* unknown `projectId`,
* invalid paths,
* invalid arguments,
* failed process startup,
* invalid inspect JSON,
* an unreadable defaults file,
* a defaults file that does not hold one YAML mapping.

For `quarto_render`, also return the defined `RenderResult` when Quarto starts but exits with a non-zero status.

---

## Out of Scope

Do not expose these commands in v0.2:

* `preview`
* `serve`
* `publish`
* `install`
* `update`
* `remove`
* `pandoc`
* `typst`
* `run`

Do not add a general Quarto command tool.

Do not add Quarto configuration schemas.

Do not implement Quarto configuration behavior.

Do not merge YAML in the MCP. Quarto merges configuration files.

Do not add named metadata profiles.

---

## Architecture

```text
MCP
├── temporary project lifecycle
├── project registry
├── metadata defaults file
├── file writes
├── YAML serialization
├── path validation
├── safe CLI calls
└── process limits

Quarto
├── configuration
├── metadata merge and precedence
├── formats
├── render behavior
└── inspect behavior
```

Keep the MCP thin.
