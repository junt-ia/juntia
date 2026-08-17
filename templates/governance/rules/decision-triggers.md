# Decision Triggers

A small, curated set of situations that commonly signal a real product or architecture decision is needed —
not an exhaustive checklist, and not something that blocks automatically. A trigger firing means "this
situation can require a human decision, go check" — never "this situation requires a decision, stop." You (the
agent) decide whether it actually applies to the request in front of you; if it does, escalate through the
real mechanism — a `type: "product"` or `type: "architecture"` pending item in `.juntia/pending.json` — per
`.juntia/governance/rules/agent-rules.md`. Juntia never matches a trigger against your request automatically;
this file exists to be read, not executed.

**`Requires confirmation` is this catalog's own definition of BLOCKING vs. non-blocking** — the only place
that distinction is decided, never inferred by Juntia from a question's own wording or how important it
sounds:

- **`yes` — blocking.** Do not proceed on an assumption. Write the decision request, pause the specific piece
  of work that depends on the answer, and wait for a real human confirmation via `juntia confirm` before
  continuing it.
- **`no` — non-blocking.** Use your own reasonable judgment and continue; nothing here requires you to stop
  and wait. Note the choice in your own reasoning if it's worth recording, but it is not a decision request.

A real, applicable situation this catalog doesn't name at all is still your judgment call, the same as always
— this catalog names the common cases, it doesn't replace your own reasoning for one it doesn't cover. See
`.juntia/governance/skills/governance-review/SKILL.md` for the full escalation procedure, invoked the moment a
trigger like one of these becomes concretely relevant — at any point during a workflow, as many times as it
genuinely happens, never saved up for a single review pass.

Scaffolded once by `juntia init` and never overwritten after that — this file is yours to edit, extend, or
trim once it exists. Kept deliberately short: a handful of real, evidenced situations, not a bureaucratic
checklist for every possible unknown.

## new_gameplay_rule

- **Type:** product
- **Reason:** Introduces or changes a rule that affects how the product behaves for a real user — a new
  mechanic, a changed condition, a new consequence for an existing action.
- **Requires confirmation:** yes

## balancing_value

- **Type:** product
- **Reason:** A tunable, numeric value (a duration, a threshold, a score, a rate) with no single objectively
  correct answer. The real gap a live dogfooding session (`restaurant-game`, M04) found: this kind of value
  gets silently guessed and written directly into code when nothing prompts an agent to escalate it instead.
- **Requires confirmation:** yes

## new_dependency

- **Type:** architecture
- **Reason:** Adds a new external dependency — a real, lasting cost and a real technical-boundary change, not
  a purely internal implementation detail.
- **Requires confirmation:** yes

## data_model_change

- **Type:** architecture
- **Reason:** Changes how state is shaped or persisted. Hard to reverse once real data exists under the old
  shape.
- **Requires confirmation:** yes

## cross_module_boundary

- **Type:** architecture
- **Reason:** Moves or duplicates logic across an existing module boundary — affects more than the immediate
  change, but is usually reversible.
- **Requires confirmation:** no
