---
description: Do the next pending work item (the first todo whose dependencies are done) in the current work version.
argument-hint: [N]
---

Arguments: $ARGUMENTS

1. Find the current work version and its first work file with `status: todo` whose `depends` are all done, lowest work number first (or the given `N`). If no work file exists at all, the next version needs planning: say so and run the `/planning-next` steps first, then continue. If everything is done or blocked, report the version state and stop.
2. Say which item you are taking, then run the **Work workflow** for that single item.
3. If that finished the last item of its target rc, run `/test` and continue with **Branch → PR → merge → rc**.
4. Stop after one item (and its rc, if it completed one). Do not start the next item.

@.claude/skills/pipit-bot-workflow/SKILL.md
