---
name: pipit-bot-workflow
description: pipit-bot rules for the local `.ai/` planning workspace and the planning / work / test / release workflows. Referenced by /planning-next, /planning-to, /work, /work-to, /test, /release. Read it when asked about plan or work files, "next task", or release steps in this repository.
---

# pipit-bot workflow

Follows `AGENTS.md`; this file adds the workflow. `.ai/` is a **gitignored local planning directory** — it is never
committed and its contents never move into committed docs. `.ai/` files may be written in the collaborator's language;
code, commit messages, PRs and docs stay English. **`AGENTS.md` §2 (the music worker is abstract) applies to every
commit, branch, PR, release note and comment** — check before anything leaves the machine.

## Versions

- **Released version**: `version` in `package.json` (bumped only by the release workflow; `-rc.A` = stable not out yet).
- **Roadmap versions**: `### vX.Y.Z` headings in `.ai/ROADMAP.md` — a plan per version, not a checklist. A version's
  entry is deleted once its stable release is deployed.
- **Next version**: the first roadmap version above the released one that has no plan file.
- **Current work version**: the lowest version that still has a file under `.ai/work/`.
- File names carry the version without `v`.

## Work numbers vs. rc labels

Work items of a version are numbered `1, 2, …` in execution order; numbers continue across planning rounds and are never
reused. The rc label `<version>-rc.A` is attached when a pre-release ships and usually bundles several items — enough for
a person to test. Every work file states its target in `release:`. Never write `rc.N` to mean a work item; use `#N`.

## `.ai/` layout

```
.ai/
  ROADMAP.md
  plan/<version>_<goal>.md
  work/<version>-<N>_<task>.md             deleted when folded into history on release
  test/<YYYY-MM-DD-HHmm>_<version>.md
  history/<YYYY-MM-DD>-<topic>.md          major work and decisions only; first line `decisions: …`
  release/pipit-bot_v<version>_release.md  release note body (templates: release-notes.md)
  pr/<branch>.md
```

## Plan file — `.ai/plan/<version>_<goal>.md`

Front matter `version`, `status: planned | in-progress | done`, `branch: feat/<version>-<goal>`,
`base: ROADMAP.md v<version> (updated <date>)`, `created`. Sections: goal · research (code the roadmap entry touches,
reusable modules) · dependencies / risks (App permissions, env, settings migration, the music-backend contract) ·
approach · decisions (mark `[ask user]`) · work items table `| # | task | area | depends | release | status |` ·
verification plan · release memo (workflow inputs, what the notes say, upgrade steps, README sections) · open questions.

Rules: read the roadmap entry **and the code it touches** first; every roadmap bullet maps to at least one item; one item
= one focused commit or a short series; order by dependency (settings keys and server before the dashboard reading them);
end with a `docs` item when READMEs change. Areas: `github | api | commands | dashboard | music | settings | docs | ci`.

## Work file — `.ai/work/<version>-<N>_<task>.md`

```
---
version: <version>
id: <N>
release: <version>-rc.A
title: <title>
area: <area>
depends: []
status: todo | doing | blocked | done
branch: feat/<version>-<goal>
---
## Purpose
## Current code        file paths + key facts
## Tasks               - [ ] per file
## Decisions           - [ ] needed decisions; [ask user] on the ones the agent must not take alone
## Expected result
## Pitfalls
## Verification        - [ ] gates  - [ ] scenarios  - [ ] needs a real server (user)
## Release             target rc, what the notes say, prerequisites (env, permissions)
```

## Work workflow (one item)

1. Refuse if `blocked`, a dependency is not `done`, or an `[ask user]` decision is open — say why.
2. Branch: never on `master`. Use the plan's branch, created from or rebased onto `origin/master`. Set `status: doing`.
3. Re-read **Current code**; fix the work file first if the plan no longer matches.
4. Implement per `AGENTS.md`, ticking items. Out-of-scope breakage becomes a new item with the next free number.
5. Gates: `yarn typecheck && yarn lint:check && yarn format:check && yarn check:abstraction`, `yarn build`, and
   `yarn dashboard:build` when `dashboard/` changed. Run what can be run (`yarn watch:start`, `yarn dashboard:dev`);
   list the rest as "needs user".
6. Commit `type(scope): title` + one-line summary + bullets, `Co-Authored-By` footer only; hooks run the abstraction
   check on the staged tree and message. Do not push here.
7. Set `status: done` with a short **Result** (commits, verified, not verified); tick the plan row.
8. When every item of the target rc is done, say so — the rc is ready for `/test` and the loop below.

## Branch → PR → merge → rc

Part of the workflow once the rc's items are done and `/test` is green; announce each step. Stable releases, force pushes
and tag deletion are never part of it.

1. `/test`; a failing gate stops the loop.
2. Rebase on `origin/master`, `git push -u origin <branch>`, `gh pr create` with the template in
   `.github/pull_request_template/` (body drafted in `.ai/pr/<branch>.md`, title and body abstraction-checked).
3. `gh pr checks <n> --watch` — `Source Abstraction`, `Secret Scan`, `label`. Red → fix, push, wait. Never merge red.
4. `gh pr merge <n> --rebase --delete-branch`; `git checkout master && git pull --rebase origin master`; delete the local
   branch; `git fetch --prune`.
5. `gh workflow run release.yml --ref master -f release_type=rc [-f version=X.Y.Z -f version_suffix=rc.1] -f dry_run=false`.
   The **first rc of a new version** always passes `version` + `version_suffix` (`rc` alone turns `0.6.4` into
   `0.6.5-rc.1`). `gh run watch <id> --exit-status`. The workflow bumps `package.json`, tags, pushes the GHCR image and
   creates a draft; a prerelease never moves `latest`.
6. Notes `.ai/release/pipit-bot_vX.Y.Z-rc.A_release.md` from [release-notes.md](./release-notes.md), then
   `gh release edit vX.Y.Z-rc.A --title "Pre-Release vX.Y.Z-rc.A" --notes-file <file> --draft=false --prerelease`.
7. Fold the shipped work files into `.ai/history/<date>-<version>-rc.A.md` and delete them; update the roadmap status.

All GitHub operations go through `gh`. On an error, search `.ai/history/*` for an earlier fix first; stop and ask only
when the fix would be hard to undo.

## Test workflow

1. Gates as in the work workflow, plus `yarn check:abstraction --range origin/master..HEAD`.
2. Scenarios from the work files' Verification and the plan's verification plan; run what can run locally, mark the rest.
3. Write `.ai/test/<YYYY-MM-DD-HHmm>_<version>.md` (gates table, scenarios table, failures with paths). Failures become new
   work items. Never mark a scenario passed that was not executed.

## Stable release

Only on the user's explicit instruction in this conversation. Preconditions: every item of the version shipped, the last
rc confirmed on a server by the user, synced clean `master`, READMEs updated. Notes from the stable template (both
languages end with **Included Pre-Releases**); run the workflow with `-f release_type=patch -f version=X.Y.Z`; publish with
`--title "Release vX.Y.Z" --latest`. If `package.json` already holds that stable version, say it is already released.
