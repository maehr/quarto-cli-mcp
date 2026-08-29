# Contributing

Thank you for your interest in this project. This document explains how to work in this
repository.

Read [`AGENTS.md`](AGENTS.md) first. It is the machine contract and it holds the full rules.
Read [`SPECS.md`](SPECS.md) for the product contract.

## Setup

1. Install Node.js 22 or later. The repository pins the version in `.nvmrc`.
2. Install [pnpm](https://pnpm.io/installation).
3. Install [Quarto](https://quarto.org/docs/get-started/). Put it on `PATH`.
4. Run `pnpm install`. This also installs the Git hooks.

## Before you open a pull request

Run the quality gate:

```bash
pnpm check
```

The gate runs Biome, the TypeScript compiler, and Vitest with coverage. CI runs the same gate.
The `pre-push` hook runs it again before a push.

New code in `src/core/` must reach 100% coverage. That directory holds the pure logic.

## Pull request process

1. Open an issue that describes the work.
2. Create a branch. Use a `feat/`, `fix/`, `chore/`, or `docs/` prefix.
3. Write commit messages that follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
   The `commit-msg` hook rejects other messages.
4. Open a pull request. Write `Closes #<n>` in the body.
5. Wait for the `quality-gate` check to pass.
6. Merge with a squash merge. The branch is deleted after the merge.

Keep one logical change per pull request.

## Changing behavior

`SPECS.md` is the contract. Change `SPECS.md` in the same pull request that changes behavior.
Do not let the code and the specification drift apart.

This server stays thin. Quarto owns configuration, formats, render behavior, and inspect
output. Do not copy Quarto configuration logic into this repository.

## Changelog

`CHANGELOG.md` is generated. Run `pnpm run changelog`. Do not edit the file by hand.

## Code of conduct

This project follows the [Contributor Covenant 3.0](CODE_OF_CONDUCT.md).
