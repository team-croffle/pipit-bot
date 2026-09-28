---
description: Run work items in order up to a target — a work number, a release (<version>-rc.A) or a version — only if it exists in plan + work files.
argument-hint: <N | version-N | version-rc.A | version>
---

Target: $ARGUMENTS (required)

Resolve the target:

- `N` → work items of the current work version up to and including `N`.
- `<version>-<N>` → the same for that version.
- `<version>-rc.A` → every item whose `release` is that rc (plus unfinished dependencies).
- `<version>` → every item of that version and of any earlier unfinished version.

If the argument is missing, the version has no plan, or the item has no work file, say exactly what is missing (and that `/planning-next` or `/planning-to <version>` creates it) and **stop without doing any work**.

Then run the **Work workflow** for each pending item in dependency order. Whenever the items of an rc are all done, run `/test` and the **Branch → PR → merge → rc** loop before continuing. Stop early on a failed gate, a red check, a blocked dependency or an open `[사용자 확인]` decision, and report where you stopped. Report all commits and releases at the end.

@.claude/skills/pipit-bot-workflow/SKILL.md
