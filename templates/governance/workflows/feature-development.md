# Workflow: Feature development

Scaffolded once by `juntia init` — Juntia's own recommended process for this kind of work, the same for every
project. Edit freely once scaffolded; Juntia does not regenerate this file.

## Goal

Turn a request for new or changed behavior into a validated, implemented change — without silently
reinterpreting what was asked for, or skipping a step a riskier version of this same request would need.

## When to use

The request introduces something that doesn't exist yet, or changes the behavior of something that already
does.

## Sequence

```
Product -> Architect (if needed) -> Engineer -> QA
```

1. Analyze the impact — what existing components, decisions, or constraints does this touch?
2. Review the existing architecture (`.juntia/context.md`, `.juntia/ARCHITECTURE.md` if present) before
   proposing a new one.
3. Propose a solution, naming any tradeoff.
4. Implement.
5. Validate — run the real tests/build, not just a visual read.

At any of the steps above — not only once, before step 4 starts — check this workflow's own "Decisions this
workflow may require" below against the specific piece of work in front of you right now. The moment one
genuinely applies, escalate it via `governance-review` and pause that specific piece of work; an unrelated
part of the same task can continue. Do not try to predict every decision the whole feature will eventually
need before you start — most only become concrete once you're actually doing the step that needs them. If the
work affects or conflicts with an existing confirmed decision, wait for confirmation before proceeding on it —
do not proceed on an assumption.

## Roles involved

- **Product** — always: makes the desired behavior and any blocking unknowns explicit before anything is
  built.
- **Architect** — only if the request touches persistence, integration, security, ownership, or performance.
  Most feature work does not need this step; do not invoke it by default.
- **Engineer** — always: turns the reasoned request into an implementation plan and the implementation itself.
- **QA** — always: recommends how the result should be validated against what was actually asked for.

## Skills recommended

- `feature-planning` — for the Product step.
- `architecture-review` — only when the Architect role is engaged.
- `governance-review` — available at any step above, the moment a decision area becomes concretely relevant —
  not a single pass reserved for the Engineer, and not limited to one point in the sequence.
- `implementation` — for the Engineer step.
- `testing-strategy` — for the QA step.

## Decisions this workflow may require

- **Product decision** — when the request leaves an actual behavior parameter unstated (a duration, a
  threshold, a scoring rule, a priority) that no existing confirmed decision already covers. This is the
  single most common gap real feature work hits — see `.juntia/governance/skills/product-decision-making/
  SKILL.md`.
  - `behavior` — what the feature should actually do in a specific, concrete case.
  - `user_experience` — how it should look, feel, or respond to whoever uses it.
  - `scope` — what's actually included in this change versus explicitly out of scope.
  - `balancing` — a tunable numeric value (a duration, a threshold, a score) with no single correct answer —
    the real gap a live dogfooding session found (see `.juntia/governance/rules/decision-triggers.md`'s own
    `balancing_value` trigger).
- **Architecture decision** — only when the Architect role above was actually engaged and a real,
  hard-to-reverse tradeoff needs a human call before implementing — see `.juntia/governance/skills/
  architecture-decision-record/SKILL.md`.
  - `data_model` — how state for this feature is shaped or persisted.
  - `module_boundary` — which existing module or file owns this logic.
  - `dependency_choice` — whether a new external dependency is actually justified.

Write either as a `type: "product"` or `type: "architecture"` pending item in `.juntia/pending.json` — a
question, options if you have real ones, never a proposed answer (see `.juntia/governance/rules/
agent-rules.md`). A human answers it via `juntia confirm`; only then does it become a real decision.

## Expected outputs

- An implemented, validated change.
- A new or updated `.juntia/DECISIONS.md` entry, if the work surfaced a real decision that needed making.
- No architecture recommendation left unconfirmed — a "considered but not decided" tradeoff belongs in
  `.juntia/DECISIONS.md`'s "Discarded and why" section, not silently dropped.

## Recommended governance level

**STANDARD** by default. Escalates to **STRICT** the moment the request touches persistence, security, or
ownership — human confirmation before implementation becomes mandatory, regardless of how confident the
proposal looks. Can be treated as **LIGHT** only for the smallest, most mechanical additions with no open
unknown and no architectural impact — most feature work does not qualify.
