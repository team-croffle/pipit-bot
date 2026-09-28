# AGENTS.md — pipit-bot

Working rules for agents and collaborators in this repository. `CLAUDE.md` only includes this file.

## 1. What this is

**Pipit** is a Discord bot for small development teams — GitHub reminders, reaction roles, invite logging and shared
music, configured from one dashboard. This repository is one product made of three parts:

| Part | Where | Stack |
| --- | --- | --- |
| Discord bot | `src/commands`, `src/listeners`, `src/preconditions`, `src/lib` | Sapphire, discord.js v14, discord-player v7 |
| Embedded API | `src/api` (Hono) | `/api/*` for the dashboard (OIDC), `/internal/*` for the music worker (token), `/webhooks/github` |
| Dashboard | `dashboard/` (Yarn workspace) | Vue 3, Vite, shadcn-vue, Tailwind — built to `dashboard/dist` and served at `GET /` |

Node.js 18+, TypeScript (ESM), Yarn 4. Quality: `tsc`, oxlint, oxfmt, husky + lint-staged. Remote: GitHub
`team-croffle/pipit-bot` (`origin`), **public**.

Reading order for a new task: [README.md](./README.md) (features, env, GitHub App setup) →
[docs/music-backend.md](./docs/music-backend.md) (the only definition of the music worker interface) → the code.

## 2. Absolute rule — the music worker is abstract

Music playback is delegated to an **external music worker** that this repository knows only through the HTTP contract in
[docs/music-backend.md](./docs/music-backend.md). Anyone may implement a worker against that contract with whatever
source they like; this repository **assumes nothing about the source**.

Therefore, in **every artifact** of this repository — code, comments, commit messages, branch names, PRs, issues, docs,
log messages, tests, release notes:

- never name a concrete audio source, provider, download library, stream protocol or token/cookie scheme, and never name
  the private worker implementation the maintainers run. Say "the music worker".
- the `!p <query>` argument is an **opaque string** — no parsing, interpretation or URL validation. It is forwarded to the
  worker as-is, and the bot plays the local file the worker's callback names.
- no download, extraction or source-resolution code lives here.
- the bot plays **local files only**: the worker writes `{fileKey}.pcm` under `STREAM_ROOT`, the bot streams it through
  its local-file extractor.

`yarn check:abstraction` enforces a list of forbidden terms on staged files (pre-commit), the commit message
(commit-msg) and a push/PR range (the `abstraction` workflow). The list is deliberately not spelled out in prose here;
the script is the source of truth. **Before anything leaves the machine, run it and read the diff yourself as well** — the
script catches terms, not hints.

Discussion of a specific worker implementation does not belong in this repository at all — not in issues either.

## 3. Architecture rules

- Bot ↔ worker communication is the HTTP contract only: `POST /v1/jobs` to enqueue, the worker calls back
  `POST /internal/music/jobs/:jobId/{ready|failed}` with `X-Pipit-Internal-Token`. No WebSocket.
- `/internal/*` is never exposed publicly; callback auth requires `INTERNAL_TOKEN`.
- There is **no main/edge role split** and no edge-node concept. Do not reintroduce `ROLE`, `MainOnly`/`EdgeOnly`
  preconditions or similar.
- Dashboard auth: Authentik OIDC (Authorization Code + PKCE, this app is the client). With `OIDC_ISSUER` unset, the dev
  identity `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE` applies. Write access maps from `DASHBOARD_ADMIN_GROUPS`.
- Runtime settings persist as JSON under `data/` (`runtime-config.json`, `guild-events.json`, `github-notify.json`,
  `github-messages.json`, `reaction-roles.json`). No hard-coded settings in source; every loader tolerates a missing file
  and reports a damaged one (`loadSettingsFile`).
- GitHub notifications: one public route `POST /webhooks/github` with `X-Hub-Signature-256` verification; everything
  substituted into a message is sanitized (`sanitizeGithubText`), only mapped Discord ids may ping, embeds carry the
  link (no `SuppressEmbeds`). Read `src/lib/github/*.ts` headers before changing behaviour — each records **why**.
- Logging: `console.*` is forbidden. Use `container.logger` / `this.container.logger`.
- `src/**/*.ts` files stay under 300 lines (oxlint `max-lines`); split routes/modules the way `src/api/routes/*` are.

## 4. Design rules (dashboard)

- Design tokens (CSS variables) for colour, spacing, typography — no ad-hoc colours per component.
- Light and dark both supported (`prefers-color-scheme` + manual override).
- Responsive: nothing breaks at phone width; horizontal scrolling stays inside containers.
- Loading, error and empty states are never omitted (`StateBlock`).
- Whitespace, hierarchy and readability over decoration; new UI matches the existing pages. shadcn-vue components are
  vendored under `dashboard/src/components/ui/` — add through `shadcn-vue add`, do not hand-edit them.
- Korean UI copy; server-side messages and delivery-log details in English.

## 5. Commits, review, PRs

- Gates before every commit: `yarn typecheck`, `yarn lint:check`, `yarn format:check`, `yarn check:abstraction`;
  `yarn dashboard:build` when `dashboard/` changed. Hooks enforce these — never bypass them (`--no-verify`).
- Conventional commits, **English**, `type(scope): title`. Body: one summary line, then a **bullet list** of changes
  (not prose). Example:

  ```txt
  feat(dashboard): add GitHub notification settings page

  Adds a /github page for the settings that until now had to be edited as JSON on the server
  - the master switch, the default channel and event set, per-repository overrides, and the GitHub-login-to-Discord-user map used for mentions
  - discord-guild.ts: new /api/discord/members endpoint fetches guild members lazily
  ```

- One logical change per commit; small, single-purpose PRs. Never commit on `master` — feature branch from `master`,
  rebase onto it; the repository accepts **rebase-and-merge only**.
- Nothing leaves the machine (push, PR, issue, comment, release) without the user's explicit instruction at that
  moment. Force pushes need their own approval every time.
- Secrets never appear in a diff. `.env*` are never read or committed.
- Fill in the PR template (`.github/pull_request_template.md`); labels are applied by the labeler from paths and
  branch names (`feat/`, `fix/`, `refactor/`).

## 6. Testing

- No test framework yet; the gates above are the minimum. Behaviour is verified on a running bot: `yarn watch:start`
  (uses `.env.development.local`), `yarn dashboard:dev` for HMR, or the Docker image (`Dockerfile`).
- If tests are added: worker-dependent tests mock the contract in `docs/music-backend.md` — never a real worker or a
  specific source.
- Say plainly what was not verified (real Discord server, real GitHub App).

## 7. Releases (maintainers)

- Versions: `vX.Y.Z-rc.N` pre-release, `vX.Y.Z` stable. The **Pipit Bot Release** workflow (`workflow_dispatch`) bumps
  `package.json`, tags, pushes the image to GHCR and creates a **draft** release; a prerelease never moves `latest`.
  Never tag by hand — the workflow derives the next version from `package.json`.
- Inputs: `release_type` (`rc|patch|minor|major`), optional exact `version`, optional `version_suffix` (e.g. `rc.1`),
  `dry_run`. To skip versions, set `version` explicitly.
- Titles `Pre-Release vX.Y.Z-rc.A` / `Release vX.Y.Z`. Notes are bilingual (Korean collapsed in `<details>`, then
  English) and end with a generated `## Changelogs`; a stable release lists its **Included Pre-Releases**. Templates:
  `.claude/skills/pipit-bot-workflow/release-notes.md`. §2 applies to notes.

## 8. Planning workflow and commands

`.ai/` is a **gitignored local planning directory** (roadmap, plan, work, test, history, release notes). It is never
committed and its contents never move into committed docs. The workflow is defined once in
[.claude/skills/pipit-bot-workflow/SKILL.md](./.claude/skills/pipit-bot-workflow/SKILL.md) and driven by the commands in
`.claude/commands/`:

| Command | Does |
| --- | --- |
| `/planning-next` | Plans the next `.ai/ROADMAP.md` version: plan file + one work file per item |
| `/planning-to <version>` | Plans every version up to the given one |
| `/work [N]` | Does the next pending work item; finishing an rc's last item continues into `/test` and the rc loop |
| `/work-to <N \| version-N \| version-rc.A \| version>` | Runs work items (and rc loops) up to a target |
| `/test [version]` | Gates + scenarios, writes `.ai/test/…` |
| `/release [rc\|patch\|minor\|major] [--dry-run]` | rc through the loop; stable only on explicit instruction |

The rc loop (push → PR → green checks → rebase-merge → release workflow → publish notes) is part of the workflow and runs
without a separate approval once `/test` is green; stable releases, force pushes and tag deletion never do.
