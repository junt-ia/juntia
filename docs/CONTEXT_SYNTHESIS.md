# Context synthesis (design)

How Juntia would turn `analyze`'s deterministic facts into project knowledge, without inventing anything —
a design, not an implementation. No AI runtime call, no `.juntia/` auto-generation, and no code in this
repository implements any of this yet. Full reasoning, including three examples grounded in real Phase 12G
benchmark data: `phases/12h-project-context-synthesis-design.md` in `junt-ia/juntia-research` *(planned, not
yet created — currently still `claude-toolkit`)*.

## Three tiers, never collapsed

| | FACT | INTERPRETATION | DECISION |
|---|---|---|---|
| Example | `package.json` has a `phaser` dependency | "This looks like a Phaser game" | "This project will keep using Phaser" |
| Who creates it | The deterministic scanner | An AI runtime, via the existing adapter interface | A human |
| Confidence | N/A — observed or not | `high` / `medium` / `low` (the same three values `lib/runtime/validator.js` already defines) | N/A |
| Lives in | `.juntia/facts.json` (proposed) | `.juntia/pending.json` (proposed) | `PROJECT_STATE.md` / `DECISIONS.md` / `RULES.md` / `ARCHITECTURE.md` |
| Promotes automatically to the next tier? | Eligible to be cited | **Never** — writing to a decision-tier file always needs human confirmation | Terminal |

A fact never becomes knowledge by itself. An interpretation never becomes a decision by itself. This is the
same KNOWN/INFERRED/DECISION_REQUIRED discipline the internal reasoning engine (`lib/product-reasoning.js`,
`lib/architecture-reasoning.js`) already enforces per-request — applied here to persistent project context
for the first time, not a new rule.

## The AI runtime's role

Reuses the existing `adapter.interpret(text, options) -> Promise<RuntimeResponse>` shape (Phase 12F) as-is
— no new adapter method. What's new is what would surround it: a guideline that serializes facts + existing
confirmed context into `text`, and a validator that rejects any response trying to sneak in a `confirmed`,
`decision`, or `authorization` field — the same anti-hallucination discipline `lib/runtime/validator.js`
already applies to intent interpretation, extended to this new interpretation type.

## When a human gets asked

- A fact is detected → never asks, facts are self-evident.
- An interpretation would be written into a decision-tier file for the first time → **always** confirm,
  regardless of confidence.
- An interpretation just restates an already-confirmed decision → skip asking, it'd be redundant.
- A low-confidence or genuinely ambiguous interpretation → ask.

## A real, structural gap this design found

`juntia analyze` is print-only today (by design — Phase 12E/12F). Detecting "what changed since last time"
(so context updates can be proposed as diffs, never full regenerations) requires a persisted fact baseline
that doesn't exist yet. This is the concrete precondition a future implementation phase needs to satisfy
before incremental context updates can work at all.
