---
description: Plan every roadmap version up to <version> (inclusive) — plan + work files per version.
argument-hint: <version>
---

Target: $ARGUMENTS (a version without `v`, e.g. `0.7.2`; required)

1. If no version is given or it is not a heading in the roadmap, list the available roadmap versions and stop.
2. Walk roadmap versions in semver order from the first unplanned one up to the target. For each, do what `/planning-next` does: read roadmap + code, write the plan (`status: 계획됨`) and its work files. Skip versions that already have a plan and say so.
3. Work numbering restarts per version; later versions may depend on earlier ones (`depends: ["<version>-<N>"]`).
4. Ask the decisions that need the user **once, grouped**, not per version.
5. Report one table per version plus open questions.

Do not implement anything and do not commit.

@.claude/skills/pipit-bot-workflow/SKILL.md
