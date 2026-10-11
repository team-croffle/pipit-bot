# 008 — Tooling: Yarn, TypeScript, oxlint, oxfmt, CI

- **Yarn** 4 (workspaces) — https://yarnpkg.com
- **TypeScript** — https://www.typescriptlang.org/docs
- **oxlint** — https://oxc.rs/docs/guide/usage/linter · **oxfmt** — https://oxc.rs/docs/guide/usage/formatter
- **husky** — https://typicode.github.io/husky · **lint-staged** — https://github.com/lint-staged/lint-staged
- **GitHub Actions** — https://docs.github.com/en/actions

## How Pipit uses it

- Gates: `yarn typecheck`, `yarn lint:check`, `yarn format:check`, `yarn check:abstraction`, plus `yarn build` and
  `yarn dashboard:build`.
- Hooks: pre-commit runs lint-staged and the abstraction check on staged files; commit-msg checks the message style and
  the abstraction rule. Hooks are never bypassed.
- CI on every pull request: the checks, a secret scan (TruffleHog), path- and branch-based labels, and the abstraction
  check over the pushed range.
- Releases: a `workflow_dispatch` workflow that versions, tags, builds and pushes the image and drafts the release
  ([decision 005](../decisions/005_v0.5.0_releases-by-workflow.md)).

## Worth knowing

- oxlint enforces `max-lines: 300` for `src/**/*.ts` — split modules rather than raising it.
- A gate piped through `tail` or `head` reports the pipe's exit code, not the gate's — run gates unpiped.
- Conventional commits in English: `type(scope): title`, a one-line summary, then a bullet list.
