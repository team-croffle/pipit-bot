---
description: Release the current version — an rc through the branch loop, or a stable release on explicit instruction — after checking preconditions.
argument-hint: [rc|patch|minor|major] [--dry-run]
---

Arguments: $ARGUMENTS A release type overrides the plan's 릴리스 메모; `--dry-run` forces `dry_run=true`.

- **rc** (default while work is in flight): run **Branch → PR → merge → rc** for the current rc. It needs no extra approval once `/test` is green and checks pass; announce each step.
- **stable** (`patch|minor|major`, or no type when every rc of the version has shipped): only when the user explicitly asked for a stable release in this conversation — otherwise stop and say so. Run the **Stable release workflow**. If `package.json` already holds that stable version, say it is already released and stop.

Check every precondition first and stop with the list of unmet ones. Report the PR, the run URL, the tag and the published release.

@.claude/skills/pipit-bot-workflow/SKILL.md
