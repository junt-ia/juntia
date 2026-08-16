# Decision Triggers

A small, curated set of situations that commonly signal a real product or architecture decision is needed —
not an exhaustive checklist, and not something that blocks automatically. A trigger firing means "this
situation can require a human decision, go check" — never "this situation requires a decision, stop." You (the
agent) decide whether it actually applies to the request in front of you; if it does, escalate through the
real mechanism — a `type: "product"` or `type: "architecture"` pending item in `.juntia/pending.json` — per
`.juntia/governance/rules/agent-rules.md`. Juntia never matches a trigger against your request automatically;
this file exists to be read, not executed.

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
