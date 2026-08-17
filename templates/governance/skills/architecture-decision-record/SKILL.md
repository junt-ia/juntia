---
name: architecture-decision-record
description: Document a real technical tradeoff — the alternatives actually considered and why one was chosen — and escalate it as a decision request when it's genuinely hard to reverse.
role: architect
when_to_use: A real tradeoff (two or more genuine alternatives on the table) that touches persistence, security, ownership, or another hard-to-reverse category surfaces, and no existing decision already settles it — whether that's during a dedicated architecture-review pass or discovered later, mid-implementation, once the code itself reveals the real alternatives. The moment it's concrete, not saved up for a single review pass.
inputs:
  - the tradeoff itself: what's actually being chosen between
  - real alternatives under consideration (never a generic pros/cons list)
  - .juntia/context.md and .juntia/ARCHITECTURE.md, if present, for this project's real existing components
  - .juntia/DECISIONS.md (check it isn't already answered)
process:
  - Confirm the tradeoff is real — two or more alternatives genuinely on the table, not one obvious choice dressed up as a decision.
  - Check .juntia/DECISIONS.md first — do not re-litigate an already-confirmed architectural decision.
  - Name each real alternative and its actual, concrete tradeoff — never an invented or generic pro/con.
  - Write a decision request to `.juntia/pending.json` — see `.juntia/governance/rules/agent-rules.md` for the exact document contract — options being the real alternatives named above. Never fill in `text`/`decision`/`confirmedAt`/`source`.
  - Pause only the specific piece of work that depends on the answer — an unrelated part of the same task that doesn't need it can continue.
  - Once a human answers via `juntia confirm`, the recorded decision (`.juntia/DECISIONS.md`) is the real record, and `.juntia/task-handoff.md` is refreshed automatically with it — re-read its "Confirmed decisions" section and continue the paused work from there; treat it as settled, not as this skill's own recommendation restated.
expected_output: A real decision request in `.juntia/pending.json` naming the actual alternatives, or — if no real second option actually exists — a clear statement that no decision is actually required.
constraints:
  - Does not decide the tradeoff itself — only a human, via `juntia confirm`, does.
  - Does not produce a generic pros/cons list disconnected from this project's real, existing architecture.
  - Does not re-open a tradeoff `.juntia/DECISIONS.md` already settled.
---

The recording half of what `architecture-review` already classifies: that skill judges impact and grounds a
recommendation in real, existing components; this one is what turns a genuine, hard-to-reverse tradeoff into a
real decision request instead of a recommendation left implicit in a PR description or, worse, decided
silently mid-implementation. Named after the industry Architecture Decision Record practice this mirrors, not
a Juntia invention — the escalation mechanism itself (writing to `.juntia/pending.json`, a human confirming
via `juntia confirm`) is what's new in Phase 15F; the discipline of naming real alternatives is not.

Phase 16B found that an architecture tradeoff does not only surface during a dedicated `architecture-review`
pass — it can just as plausibly become apparent once the Engineer is already implementing something and hits a
real fork in the road no one named beforehand. `when_to_use` above reflects that directly: this skill applies
wherever and whenever the tradeoff actually becomes concrete, not only as a scheduled follow-on to another
skill.
