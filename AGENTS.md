# Quarto MCP — Agent Contract

This repository is a thin MCP server that wraps the Quarto CLI.

It exposes three tools: `quarto_create_project`, `quarto_render`, and `quarto_inspect`.

Quarto stays the source of truth for configuration, formats, render behavior, and inspect output.

`SPECS.md` is the product contract. Change `SPECS.md` before you change behavior.

This file is the general TypeScript agent-tooling specification, reduced to the parts that apply
here. It drops the browser and WASM rules, because this is a Node-only server. It drops the fork
and stacked-pull-request workflow, because this is a solo private repository.

Use Node.js LTS and ESM.

Pin versions in `package.json`. Commit `pnpm-lock.yaml`. Do not ship development tools to runtime.

## 0. This Repository

### Prerequisite

The `quarto` executable must be on `PATH`. Tests that call Quarto skip when it is absent.

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies. |
| `pnpm lint` | Run Biome. |
| `pnpm typecheck` | Run the TypeScript compiler. |
| `pnpm test` | Run Vitest with coverage. |
| `pnpm check` | Run all three gate steps. |
| `pnpm start` | Start the stdio MCP server. |

Run `pnpm check` after a change batch. Run it again before a push.

### Source Layout

| Path | Rule |
| --- | --- |
| `src/core/` | Pure functions. No I/O. 100% coverage required. |
| `src/shell/` | Side effects only. Process, filesystem, and registry access. |
| `src/tools/` | Zod input schemas and tool handlers. Wires core to shell. |
| `src/server.ts` | Registers the three tools on one `McpServer`. |
| `src/index.ts` | Binary entry point. Connects the stdio transport. |

### Server Rules

Run Quarto without a shell. Use argument arrays only.

Do not accept an executable path from the client.

Send all logs to stderr. Stdout carries the MCP protocol.

Keep project roots private. Clients use only `projectId`.

Validate every client path against the project root.

## 1. Orchestration

Context is limited. Use it carefully.

**Model tier.** Use the frontier model for planning, decisions, and shared context. Use smaller models for bounded tasks.

**Delegate on evidence.** Delegate tasks that read much more data than they return. Examples include search, log analysis, and multi-file review. Make small edits directly.

**Use contracts.** Give each subagent one task. Define its input, output, and stop condition. Require conclusions, not file dumps. Verify important claims.

**Parallel work.** Run tasks in parallel only when they are independent. Use at most three concurrent agents.

**Context limits.**

* At 25%, identify the main context cost.
* At 50%, reduce context by writing state to disk, delegating reads, or narrowing reads.
* At 75%, stop new work and reduce context first.

**Persist state.** Store plans, findings, and decisions in files.

**Read narrowly.** Read only the required file sections. Do not re-read files you just wrote.

## 2. Tooling

### Platform

* Node.js LTS
* ESM
* pnpm
* TypeScript

### Development

* [Biome](https://biomejs.dev/) — lint, format, imports
* [Vitest](https://vitest.dev/) — tests and coverage
* [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) — Git hooks
* [commitlint](https://commitlint.js.org/) — Conventional Commits
* [git-cliff](https://git-cliff.org/) — changelog generation

### Runtime

* Web APIs first: `fetch`, `Request`, `Response`, `URL`, `AbortSignal`, Web Crypto, Web Streams
* [Zod](https://zod.dev/) — validation and configuration
* [Pino](https://getpino.io/) — structured logging
* [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server and stdio transport

Prefer built-in APIs.

* Use `fetch` for HTTP.
* Use `node:util.parseArgs` for small CLIs.
* Use `node:fs/promises`, `node:path`, and `node:crypto`.
* Use arrays, iterators, `Map`, and `Set` for normal data work.
* Add database, dataframe, notebook, or chart libraries only when required.

Do not add `Effect`, `fp-ts`, DI containers, ORMs, or similar frameworks by default.

## 3. Standards

* [SemVer 2.0.0](https://semver.org/)
* [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
* [Contributor Covenant 3.0](https://www.contributor-covenant.org/version/3/0/code_of_conduct/)
* `LICENSE`: AGPL-3.0
* SPDX: `AGPL-3.0-only`

Generate `CHANGELOG.md` with git-cliff. Do not edit it by hand.

## 4. Code

Use these rules:

* Use ESM only.
* Set `"type": "module"`.
* Use a functional core and an imperative shell.
* Keep business logic pure.
* Isolate network, file, database, clock, randomness, and process access.
* Prefer functions and plain data.
* Use classes only when identity or lifecycle requires them.
* Pass dependencies as function arguments or factory parameters.
* Use Zod at external boundaries.
* Infer internal types from Zod when possible.
* Prefer `type` over `interface`.
* Prefer `readonly` data.
* Prefer discriminated unions over inheritance.
* Use `unknown` for untrusted input.
* Do not use `any` to suppress type errors.
* Avoid `enum`.
* Use literal unions or `as const`.
* Use `satisfies` when appropriate.
* Exhaust all discriminated union cases.
* Use `import type` for type-only imports.
* Do not use TypeScript `paths` for runtime aliases.
* Keep comments focused on contracts and non-obvious decisions.
* Require 100% coverage for core logic.

Use a small `Result` type for expected failures when useful:

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }
```

Recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ESNext",
    "module": "NodeNext",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "rewriteRelativeImportExtensions": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Use a separate build configuration when a library must publish JavaScript or declaration files.

Do not add a server bundler by default.

Add Vite only for browser applications that need bundling or a development server.

### Quality Gate

Run the same gate locally and in CI:

```bash
pnpm exec biome ci .
pnpm exec tsc --noEmit
pnpm exec vitest run --coverage
```

Configure Vitest to require 100% coverage for core logic.

Run the gate before push.

Run `commitlint` on commit messages.

## 5. GitHub Workflow

Do not push directly to `main`. Trunk protection rejects such a push.

Track every unit of work with a GitHub issue. Deliver it with one branch and one pull request.

```bash
gh issue create --title "feat: thing" --body "..."
git switch -c feat/thing
gh pr create --fill --body "Closes #12"
```

Use one logical change per pull request.

Use Conventional Commits for commit messages and pull request titles.

Write `Closes #<n>` in the pull request body. This closes the issue on merge.

Merge with a squash merge. Delete the branch after the merge.

### Trunk Protection

Use idempotent repository configuration.

```bash
gh repo edit \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge \
  --allow-update-branch \
  --enable-secret-scanning \
  --enable-secret-scanning-push-protection

gh api -X PUT \
  repos/OWNER/REPO/branches/main/protection \
  --input protection.json
```

Require:

* pull requests
* appropriate approval rules
* stale approval dismissal
* code-owner approval when required
* last-push approval when required
* conversation resolution
* strict status checks
* linear history
* `enforce_admins: true`
* no force push
* no branch deletion

For a solo maintainer, require zero approvals when admin enforcement is active.

Use a repository ruleset when classic branch protection is unavailable.

## 6. CI/CD Security

Use these defaults:

* Set top-level `permissions: contents: read`.
* Increase permissions only for jobs that need them.
* Use `pnpm install --frozen-lockfile`.
* Pin GitHub Actions to full commit SHAs.
* Use Dependabot for updates. Do not use Renovate.
* Avoid package lifecycle scripts unless required.
* Do not execute fork code with privileged credentials.
* Do not use untrusted `github.event.*` values directly in `run:`.
* Pass untrusted values through `env:`.
* Quote shell variables.
* Use OIDC for cloud authentication.
* Do not store long-lived cloud credentials.
* Store secrets as separate scalar values.
* Use GitHub Environments for deployments.
* Prefer environment secrets over repository secrets.
* Do not use self-hosted runners for public repositories.
* Add `.github/workflows/**` to `CODEOWNERS`.
* Require the quality gate, CodeQL, and dependency review.

CI and local hooks must use the same quality gate.

### Advanced Security Limit

This repository is private and does not have GitHub Advanced Security. Secret scanning, code
scanning, and dependency review are therefore unavailable.

The CodeQL and dependency review workflows are present. Both carry an
`if: github.event.repository.visibility == 'public'` guard. They start to run when the
repository becomes public. Do not delete them.

Branch protection requires only the `quality-gate` check.


## 7. Security Model

Document code execution is off by default. `--no-execute` is not a sandbox.

Quarto configuration can start other programs, for example through render hooks or filters.

Version 0.1 assumes trusted project input.

Use an OS or container sandbox when project input is untrusted.

Do not copy Quarto security or configuration rules into this server.
