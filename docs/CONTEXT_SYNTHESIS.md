# Context synthesis

How Juntia turns `analyze`'s deterministic facts into project knowledge, without inventing anything. The
**FACT** tier is real and built (Phase 12I: `.juntia/facts.json`, persisted and diffed by `juntia analyze`).
**INTERPRETATION** is real and evaluated (Phase 12J: `juntia analyze --explain` makes a genuine AI-runtime
call over real facts, validated against a fact-grounding check, printed to the console — not yet persisted
anywhere, so still evaluation-stage rather than "built" for production use). **DECISION** remains fully
human and untouched by any of this. Full reasoning: `phases/12h-project-context-synthesis-design.md`
(design), `phases/12i-project-facts-persistence.md` (the real FACT-tier implementation), and
`phases/12j-context-synthesis-runtime-evaluation.md` (the real INTERPRETATION-tier evaluation) in
`junt-ia/juntia-research` *(planned, not yet created — currently still `claude-toolkit`)*.

## Three tiers, never collapsed

| | FACT | INTERPRETATION | DECISION |
|---|---|---|---|
| Example | `package.json` has a `phaser` dependency | "This looks like a Phaser game" | "This project will keep using Phaser" |
| Who creates it | The deterministic scanner | An AI runtime, via the existing adapter interface | A human |
| Confidence | N/A — observed or not | `high` / `medium` / `low` (the same three values `lib/runtime/validator.js` already defines) | N/A |
| Lives in | `.juntia/facts.json` (**built**) | Console output only, via `analyze --explain` (**evaluated, Phase 12J**) — `.juntia/pending.json` considered, not built | `PROJECT_STATE.md` / `DECISIONS.md` / `RULES.md` / `ARCHITECTURE.md` |
| Promotes automatically to the next tier? | Eligible to be cited | **Never** — writing to a decision-tier file always needs human confirmation | Terminal |

A fact never becomes knowledge by itself. An interpretation never becomes a decision by itself. This is the
same KNOWN/INFERRED/DECISION_REQUIRED discipline the internal reasoning engine (`lib/product-reasoning.js`,
`lib/architecture-reasoning.js`) already enforces per-request — applied here to persistent project context
for the first time, not a new rule.

## The AI runtime's role

Reuses the existing `adapter.interpret(text, options) -> Promise<RuntimeResponse>` shape (Phase 12F) as-is
— no new adapter method (Phase 12J generalized `lib/runtime/claude-cli-adapter.js` to accept an optional
`systemPrompt`/`schema` pair, defaulting to the original intent guideline, so a second interpretation domain
could plug in without a second adapter file). What surrounds it: `lib/runtime/
project-interpretation-guideline.js` (the system prompt + JSON schema sent to the runtime — serializes
facts + detected changes + existing context into `text`, real-fact identifiers only) and `lib/runtime/
project-interpretation-validator.js` (rejects any response trying to sneak in a `fact`, `decision`,
`confirmed`, `action`, `questions`, or `authorization` field — the same anti-hallucination discipline
`lib/runtime/validator.js` already applies to intent interpretation, extended to this new interpretation
type). `lib/project-intelligence/context-synthesis-bridge.js` composes all three, mirroring
`lib/intent-runtime-bridge.js`'s own shape.

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

## The INTERPRETATION tier, evaluated (Phase 12J)

`juntia analyze --explain` (opt-in only — plain `analyze` never calls a runtime or spends anything) sends
the real facts `.juntia/facts.json` just persisted, plus the real diff against the previous baseline, to
the same authenticated Claude Code CLI session Phase 11C already uses for intent interpretation. Each fact
is rendered with a bracket-delimited identifier (`- id:[dependency:phaser] value:"^3.60.0"
evidence:package.json`) that the runtime is instructed to cite verbatim in `basedOn` — found necessary via
a real, live run: an earlier, unbracketed rendering led a real response to cite
`"dependency:phaser (value: 49)"` as if the trailing annotation were part of the identifier, which the
validator correctly rejected. The validator's grounding check (cross-referencing every `basedOn` entry
against the real fact list) is the one thing this domain's validator does that the intent domain's does
not — the intent domain has a downstream governance layer to catch a fabricated citation later;
INTERPRETATION does not yet, so this validator is the only line of defense against it, and does not defer
the check.

**Real validation, not just design**: two independent live runs (`juntia`, `app-podcaster`) plus one
through the actual `bin/juntia.js analyze --explain` binary. All three produced a valid, fully fact-grounded
interpretation — `app-podcaster`'s cited 30 real fact identifiers, all exactly matched, zero invented. Total
real cost across every live call this phase (including the one that correctly failed validation before the
bracket fix): well under $0.05. Output is printed to the console only, explicitly labeled "not a fact, not
saved, not a decision" — no file is written beyond what plain `analyze` already writes
(`.juntia/facts.json`, `.juntia/.gitignore`).

## What's still missing before INTERPRETATION is more than an evaluation

- **A persistence surface** — `.juntia/pending.json` or an equivalent was evaluated, not built, this phase
  (see the "Decisiones descartadas" section of `phases/12j-context-synthesis-runtime-evaluation.md` for the
  safety/UX/traceability/reversibility tradeoffs weighed). Without one, an interpretation is necessarily
  ephemeral — useful to read once, but Juntia remembers nothing about it between runs.
- **A feedback loop** — `EXISTING CONTEXT` in the request text is currently always "none persisted yet";
  nothing yet writes a confirmed decision back into a form the next `--explain` run could cite.
- **A noise/cost threshold** — every `--explain` run currently interprets the entire fact set from scratch;
  there's no rule yet for when re-interpreting is worth the real cost/latency versus reusing a still-valid
  prior read.
- **A real confirmation UX** — "When a human gets asked" above is still a design, not a built flow; nothing
  currently asks anything, because nothing is persisted for a human to confirm yet.
