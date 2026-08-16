---
name: governance-review
description: Before implementing, check the resolved workflow's own declared decision areas against what you're about to build, and check whether anything relevant is already pending or already decided.
role: engineer
when_to_use: Immediately before starting implementation on any workflow that declares a non-empty "Decisions this workflow may require" section (see the resolved workflow's own file, or `workflow.decisionAreas` in the Agent Context / task handoff).
inputs:
  - the resolved workflow's own "Decisions this workflow may require" section (roles/skills/decision areas)
  - .juntia/pending.json (anything already awaiting a human answer)
  - .juntia/DECISIONS.md (anything already decided)
  - .juntia/governance/rules/decision-triggers.md (optional — common situations worth recognizing)
process:
  - List the workflow's own declared decision areas for this request (e.g. behavior, balancing, data_model) — not a generic checklist, only what this specific workflow actually names.
  - For each area, check whether the request already states a real, specific answer, or whether it would require guessing a value/tradeoff that isn't actually known yet.
  - Check .juntia/DECISIONS.md first — do not treat an already-decided area as still open.
  - Check .juntia/pending.json — do not create a duplicate request for something already awaiting a human answer.
  - For each area that's genuinely open, escalate it as a decision request (product-decision-making or architecture-decision-record, depending on type) before writing the code that would otherwise silently encode a guessed answer.
  - Only once every genuinely open, applicable area either has a real answer or a real pending request, proceed to implementation.
expected_output: Either a short confirmation that no real decision area applies (or all are already resolved), or one or more new decision requests in .juntia/pending.json — written before implementation starts, not discovered partway through it.
constraints:
  - Does not decide any of the areas itself — only recognizes and escalates.
  - Does not treat every listed area as automatically blocking — most requests resolve most areas from their own stated content or an existing decision.
  - Does not re-ask about an area a confirmed decision or an existing pending item already covers.
---

Grounded directly in the real gap this phase's own dogfooding evidence found: `product-decision-making`/
`architecture-decision-record` (Phase 15F) are real, correct procedures for recognizing and escalating a
decision — but both activate reactively, once an agent already notices it's guessing. The real
`restaurant-game` failure mode was different: the agent never paused to check *before* writing the value into
code at all. This skill is that pause — a real, distinct trigger condition (immediately before implementation,
not "when I happen to notice") that neither of the other two skills owns. It never decides anything itself; it
only makes sure the right question gets asked before the wrong answer gets written.
