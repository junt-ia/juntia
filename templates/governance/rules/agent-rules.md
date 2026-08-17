# Agent Rules

Juntia's own standing rules for how a connected AI agent should operate in this project — the same rules
scaffolded into every Juntia-governed project, not derived from this project specifically. Distinct from
`.juntia/RULES.md`, if present, which holds this project's own human-authored constraints instead.

Scaffolded once by `juntia init` (directly, or via `integrate`/`setup`, which call it) and never overwritten
after that — this file is yours to edit once it exists. If your team wants to add a project-specific rule, or
soften/extend one of the ones below, edit it here directly; Juntia will not silently revert your changes.

- **Analyze before modifying.** Read `.juntia/context.md` (confirmed facts and decisions) before proposing or
  making a change — do not re-derive what Juntia has already established.
- **Respect confirmed decisions — including one confirmed after you started the current task.** A decision in
  `.juntia/DECISIONS.md` was made deliberately by a human. Don't silently work around, contradict, or
  re-litigate one — if a change requires it, say so explicitly and ask. `.juntia/task-handoff.md`'s own
  "Confirmed decisions" section is refreshed automatically every time `juntia confirm` records one, and
  separates what you already knew when this task started from what was confirmed since. Anything in the
  second group wins over a provisional value you already chose or wrote — re-check your implementation
  against it before considering the task done, even if it contradicts what you had proposed.
- **Never introduce a dependency without stating why.** A new dependency is a real, lasting cost — name the
  concrete reason it is needed as part of proposing the change, not after the fact.
- **Ask when a request conflicts with an existing decision or constraint.** Do not silently choose one side —
  surface the conflict and let the human decide, the same way Juntia itself never resolves a conflicted
  decision on its own (see `.juntia/context.md`'s own "Conflicts needing review" section).
- **Validate changes before considering them done.** Run the project's own real tests/build, not just a
  visual read of the diff.
- **Never write directly to `.juntia/decisions.json`.** Only a human, via `juntia confirm`, creates a
  decision. If you are proposing a project interpretation (not implementing a change), follow
  `.juntia/agent-instructions.md` instead.
- **Never invent a product or architecture decision on your own.** If a request leaves a real behavior
  parameter, threshold, or technical tradeoff unstated, and no existing decision in `.juntia/DECISIONS.md`
  already covers it, write a decision request to `.juntia/pending.json`. Propose the question, never the
  answer; continue only once a human has confirmed a real answer via `juntia confirm`. Not every unknown
  qualifies — an ordinary implementation detail you can reasonably choose yourself is not a decision request;
  a hard-to-reverse or genuinely undecided one is.

  **The full `.juntia/pending.json` contract** — this is the exact, complete shape Juntia validates; producing
  anything else is what a real dogfooding session found silently broke `juntia confirm`. Each request is one
  object:

  ```json
  { "type": "product", "question": "...", "context": "...", "options": ["...", "..."], "reason": "..." }
  ```

  (`"type"` is `"product"` or `"architecture"`; `"context"`/`"options"`/`"reason"` are optional — `"reason"` is
  why this specific situation needs confirmation, shown verbatim in `task-handoff.md`'s Task Status section.)
  The file itself holds
  every pending item as a JSON **array** of these objects. Either of these is correct and accepted:

  ```json
  [{ "type": "product", "question": "..." }]
  ```

  ```json
  { "schemaVersion": 1, "items": [{ "type": "product", "question": "..." }] }
  ```

  The second is the canonical shape Juntia itself writes back (and what you'll see if the file already
  exists — add to its `items` array, don't replace it) — but the first, a bare array with no wrapper, is
  read identically; use whichever is easier to produce. What is never valid: a single bare object with no
  array around it at all, even for one request — it is `[{ ... }]`, not `{ ... }`. Never set `text`,
  `decision`, `confirmedAt`, or `source` yourself — those belong only to a human, at `juntia confirm` time.
- **Escalate a decision the moment you notice it needs one — not in a single review pass, and not after.** A
  workflow's own "Decisions this workflow may require" section (or `workflow.decisionAreas` in your Agent
  Context / task handoff) names areas that *can* apply, not a checklist to resolve all at once before you
  start. The moment one genuinely becomes concrete — during product reasoning, architecture reasoning,
  implementation, or QA — follow `.juntia/governance/skills/governance-review/SKILL.md` right then: write the
  decision request, and pause only the specific piece of work that depends on the answer; an unrelated part of
  the same task can continue. A real dogfooding session found that treating this as one pass, done early,
  taught the opposite lesson — a decision that only became concrete mid-implementation was never re-checked.
  `.juntia/governance/rules/decision-triggers.md` names a few common, real situations and whether each is
  BLOCKING (`Requires confirmation: yes`) or not — that field decides blocking, never your own read of how
  important a question sounds. A situation it doesn't name is still your judgment call.
- **Mark a blocking decision WAITING the moment you escalate it — right away, don't wait for the answer.**
  After writing a decision request, run `juntia confirm` immediately, answering `skip` if you don't have the
  human's real answer yet. This refreshes `.juntia/task-handoff.md`'s own "Task Status" section to
  `WAITING_HUMAN_CONFIRMATION` and lists the pending decision — deterministic, file-backed, discoverable by
  you or a later session without depending on this conversation. Do not silently pick a default and do not
  continue the affected implementation while status reads `WAITING_HUMAN_CONFIRMATION`. Once a human answers
  via `juntia confirm`, status returns to normal and the confirmed value appears in "Confirmed decisions" —
  continue only from there.

These rules describe what improves consistency and reduces contradictory or context-losing work across
sessions — not a guarantee of correctness. A model can still make mistakes; the point is to reduce how often
they come from missing context this project already has.
