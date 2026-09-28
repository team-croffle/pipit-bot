---
description: Plan the next roadmap version — write .ai/plan/<version>_<goal>.md and its work files.
argument-hint: [hint]
---

Plan the **next version** (definition in the workflow below). Arguments: $ARGUMENTS

1. Determine the released version and the next roadmap version. If every roadmap version already has a plan, say so and stop.
2. Read the roadmap entry, the code it touches, and prior decisions (`grep -l 'decisions:.*<keyword>' .ai/history/*`).
3. Decisions that change the work materially and cannot be settled from the code or history: ask the user with concrete options before writing; everything else becomes a stated assumption.
4. Write `.ai/plan/<version>_<goal>.md` (`status: 계획됨`) and one work file per row as `.ai/work/<version>-<N>_<task>.md` — `N` is the work number in execution order, `release: <version>-rc.A` the pre-release it ships in. Work numbers are not rc numbers.
5. Add `계획: plan/<file>` under the version in the roadmap (no checklists there).
6. Report: version, work items table (number, task, target release), open questions.

Do not implement anything and do not commit.

@.claude/skills/pipit-bot-workflow/SKILL.md
