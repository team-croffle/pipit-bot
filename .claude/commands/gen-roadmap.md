---
description: Add or change .ai/ROADMAP.md entries from the user's requirements, each placed in a version (the user's choice first).
argument-hint: <requirements> [→ vX.Y.Z]
---

Update `.ai/ROADMAP.md` from the requirements in: $ARGUMENTS

1. If no requirement is given, ask for it and stop.
2. Run the **Roadmap workflow** below. A version the user names for a requirement (`→ v0.7.3`, "in 0.8.0", …) wins over
   any placement you would choose.
3. Ask before writing when a named version is already released or its plan is in progress, or when an existing entry would
   have to move or disappear.
4. Report the placement table and open questions.

Edit the roadmap only: do not write plans or work files, do not implement, do not commit.

@.claude/skills/pipit-bot-workflow/SKILL.md
