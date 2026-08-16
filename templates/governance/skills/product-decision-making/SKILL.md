---
name: product-decision-making
description: Recognize when a request leaves a real product behavior undecided, separate that from an ordinary implementation detail, and escalate it as a decision request instead of guessing.
role: product
when_to_use: Following feature-planning (or any workflow) surfaces a concrete, load-bearing unknown — a duration, a threshold, a scoring rule, a priority — that determines actual product behavior and isn't already covered by a confirmed decision.
inputs:
  - the unknown itself, stated as a concrete question (not a vague "need more info")
  - .juntia/DECISIONS.md (check it isn't already answered)
  - any real, named options actually under consideration — never invented to pad the list
process:
  - Separate a real blocking unknown (the product's actual behavior depends on the answer) from an ordinary implementation detail an engineer can reasonably choose without changing what the product does.
  - Check .juntia/DECISIONS.md first — do not ask a question that already has a confirmed answer.
  - State the question in concrete, answerable terms — "what should X be," not "is this okay."
  - Name real options only if they're actually under consideration; an empty options list is more honest than invented ones.
  - Write a decision request — `{ "type": "product", "question": "...", "context": "...", "options": [...] }` — to `.juntia/pending.json`. Never fill in `text`/`decision`/`confirmedAt`/`source` — those belong only to a human, at `juntia confirm` time.
  - Stop and wait. Do not proceed on an assumed answer while the request is pending.
expected_output: A real decision request in `.juntia/pending.json`, or — if the unknown turns out to be a detail, not a decision — a clear statement of why it doesn't need escalating.
constraints:
  - Does not answer its own question, under any framing.
  - Does not treat every unknown as blocking — most implementation choices are not product decisions.
  - Does not proceed on an assumed answer while a real decision request is still pending.
---

Grounded directly in a real gap this phase found, not designed speculatively: a live dogfooding session
(`restaurant-game`, M04) needed two real product decisions — a wait-timeout duration and a reputation-penalty
magnitude — and had no real mechanism to escalate them through Juntia at all, so `.juntia/DECISIONS.md` was
hand-edited directly instead. This skill is the real, structured procedure that gap was missing: recognize the
unknown, check it isn't already decided, ask a concrete question, and wait for a human answer via
`juntia confirm` — never guess, and never treat "the team hasn't decided" the same as "the agent gets to
decide."
