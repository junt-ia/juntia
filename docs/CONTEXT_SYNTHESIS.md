# Context synthesis

How Juntia turns `analyze`'s deterministic facts into project knowledge, without inventing anything. The
**FACT** tier below is real and built (Phase 12I: `.juntia/facts.json`, persisted and diffed by `juntia
analyze`) — INTERPRETATION and DECISION remain design only, no AI runtime call exists yet. Full reasoning:
`phases/12h-project-context-synthesis-design.md` (design) and `phases/12i-project-facts-persistence.md`
(the real FACT-tier implementation) in `junt-ia/juntia-research` *(planned, not yet created — currently
still `claude-toolkit`)*.

## Three tiers, never collapsed

| | FACT | INTERPRETATION | DECISION |
|---|---|---|---|
| Example | `package.json` has a `phaser` dependency | "This looks like a Phaser game" | "This project will keep using Phaser" |
| Who creates it | The deterministic scanner | An AI runtime, via the existing adapter interface | A human |
| Confidence | N/A — observed or not | `high` / `medium` / `low` (the same three values `lib/runtime/validator.js` already defines) | N/A |
| Lives in | `.juntia/facts.json` (**built**) | `.juntia/pending.json` (proposed) | `PROJECT_STATE.md` / `DECISIONS.md` / `RULES.md` / `ARCHITECTURE.md` |
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

## The FACT tier, concretely (built, Phase 12I)

`.juntia/facts.json` holds a flat, diffable list — one entry per language/technology/dependency/manifest/
config/structure item, each with its own `evidence`, tagged with a `schemaVersion` so an incompatible future
format is detected and treated as `UNKNOWN` rather than misread. `juntia analyze`'s first run on a project
creates this baseline; every run after that loads the previous one, compares it against a fresh scan, and
reports exactly three kinds of change — **Added**, **Removed**, **Changed** (only for facts with a real,
comparable value, like a dependency's version) — never an interpretation of what a change means. The file
is git-ignored by default (`.juntia/.gitignore`, created alongside it) since it's a machine-regenerated
snapshot, not human-authored narrative like `DECISIONS.md`.

## What's still missing before INTERPRETATION can be built

A real adapter guideline + validator pair (see "The AI runtime's role" above) that reads `.juntia/
facts.json`'s real content and proposes `.juntia/pending.json` entries — not built yet. The precondition
Phase 12H identified (a persisted fact baseline) is now satisfied; this is the next real gap.
