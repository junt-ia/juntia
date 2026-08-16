# Workflow: Investigation

Scaffolded once by `juntia init` — Juntia's own recommended process for this kind of work, the same for every
project. Edit freely once scaffolded; Juntia does not regenerate this file.

## Goal

Answer a real question about existing behavior, architecture, or an open option — without changing anything.
An investigation produces understanding, not a diff.

## When to use

The request is a question ("how does X work," "what would happen if...," "what options do we have for Y"),
not a change. If the answer turns out to require a change, that becomes a separate, new request following
`feature-development.md` or `refactor.md` — this workflow does not chain into implementation on its own.

## Sequence

1. Confirm what's actually being asked — an ambiguous question answered confidently is worse than asking for
   clarification.
2. Read `.juntia/context.md`, `.juntia/DECISIONS.md`, and `.juntia/ARCHITECTURE.md` (if present) before
   forming an answer — do not re-derive what Juntia already has recorded.
3. For an open-ended "what are our options" question, name real, concrete alternatives — never a generic
   pros/cons list disconnected from this project's actual constraints.
4. Answer, citing what the answer is actually grounded in (a confirmed decision, an observed fact, or an
   explicitly-labeled inference).

## Roles involved

- **Product** — for a question about desired behavior or product intent.
- **Architect** — for a question about system design, an existing component, or a foundational tradeoff.
- Whichever role matches the question's own domain; an investigation rarely needs more than one.

## Skills recommended

- `architecture-review` — when the question is about an existing component or a design tradeoff, used in its
  read-only, explanatory sense rather than to justify a specific change.

## Decisions this workflow may require

- **Architecture decision** — an investigation commonly surfaces that a real technical-direction choice now
  needs to be made, even though this workflow never makes or proposes one itself.
  - `technical_direction` — which real path forward to take, once the investigation has named the actual
    options (see "Sequence" above) — the choice itself still belongs to a human, and to whichever later
    workflow acts on it.

This workflow itself never writes a decision request to `.juntia/pending.json` — naming that a decision is
needed IS this workflow's own real output (see "Expected outputs" below), never a change of its own. Whichever
workflow acts on the answer (`feature-development.md`, `refactor.md`, ...) is the one that actually escalates
it, once the request identifies which specific value or tradeoff needs deciding. A product decision never
arises here — an investigation answers a question about what exists or what's possible, it doesn't itself
introduce a new, undecided product behavior.

## Expected outputs

- A clear answer or a clearly-named set of real options — never an implementation.
- No entry in `.juntia/decisions.json` — an investigation never creates a decision on its own; it can surface
  that one is needed, which a human then makes separately.

## Recommended governance level

**LIGHT**, always. Nothing changes as a result of this workflow by itself, so no human confirmation gate
applies — the gate belongs to whatever workflow, if any, is opened afterward to act on the answer.
