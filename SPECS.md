# Quarto MCP — v0.1

## Goal

Provide a thin MCP wrapper for the Quarto CLI.

The MCP must:

* create a temporary Quarto project,
* write initial project files,
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

---

## `quarto_create_project`

```ts
type CreateProjectInput = {
  type?: string; // default: "default"
  config?: Record<string, unknown>;
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

1. Create a temporary directory.
2. Run:

```text
quarto create project <type> . --no-open --no-prompt
```

Verified on Quarto 1.10.18: `.` creates the project in the current directory.

3. If `config` exists, replace `_quarto.yml` with its YAML form.
4. Write `files`.
5. Return `projectId`.

### Rules

* `config` is generic YAML data.
* Reject a `type` that Quarto would read as an option.
* Do not define a Quarto configuration schema.
* Do not merge `config` with generated Quarto configuration.
* If `config` is absent, keep the generated `_quarto.yml`.
* Reject `_quarto.yml` in `files`.
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

Version 0.1 assumes trusted project input.

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
* invalid inspect JSON.

For `quarto_render`, also return the defined `RenderResult` when Quarto starts but exits with a non-zero status.

---

## Out of Scope

Do not expose these commands in v0.1:

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

---

## Architecture

```text
MCP
├── temporary project lifecycle
├── project registry
├── file writes
├── YAML serialization
├── path validation
├── safe CLI calls
└── process limits

Quarto
├── configuration
├── formats
├── render behavior
└── inspect behavior
```

Keep the MCP thin.
