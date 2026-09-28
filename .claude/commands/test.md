---
description: Run the test workflow (gates + scenarios) on the current state and write .ai/test/<YYYY-MM-DD-HHmm>_<version>.md.
argument-hint: [version]
---

Arguments: $ARGUMENTS Version under test: the given one, otherwise the current work version, otherwise the released version.

Run the **Test workflow** exactly as written. Report the gates table and scenario table, and list every failure and every scenario left for the user to confirm. Do not fix failures in this command; create work items for them instead.

@.claude/skills/pipit-bot-workflow/SKILL.md
