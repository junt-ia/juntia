# Decisions

Standing, hard-to-reverse decisions about Juntia's own architecture and direction — the project-level
equivalent of `.juntia/DECISIONS.md`, which instead records decisions *within* a Juntia-governed project (and
is gitignored, self-hosted instance data, not committed here). Append-only: a superseded decision is marked
as such, never silently deleted.

## Decision escalation is just-in-time, invoked whenever a decision becomes concrete — never a single review pass

**Decision:** `.juntia/governance/skills/governance-review/SKILL.md` (and the workflow/role files that point
at it) no longer frame decision escalation as a single checkpoint done once, "immediately before
implementation." It is a standing capability, invoked the moment a real, workflow-declared decision area
becomes concrete — during product reasoning, architecture reasoning, implementation, or QA — and can fire more
than once across the same task. BLOCKING vs. non-blocking is decided exclusively by
`decision-triggers.md`'s own declared `Requires confirmation` field — never inferred by Juntia from a
question's own wording.

**Why:** a real, live Phase 16B dogfooding session found that the original, single-pass framing (Phase 15G's
own design) taught agents to check once, early, and never again — recreating the exact "a value gets silently
guessed into code" failure mode that framing was built to close, for any decision that only became concrete
after that one pass. No new Core mechanism was required to fix this: the pause/confirm/resume cycle Decision
Continuity already built works at any point in a task; the fix is entirely in when the Knowledge Layer tells
an agent to reach for it.

**Recorded:** `phases/just-in-time-governance.md`.

## `pending.json` accepts a bare JSON array, not only the wrapped `{ schemaVersion, items }` document

**Decision:** `lib/project-intelligence/pending-store.js#loadPending` accepts a bare JSON array as the items
list, in addition to the canonical wrapped shape — self-healed back to the canonical shape the moment the file
is next written. No other previously-accepted or previously-rejected shape changed.

**Why:** `.juntia/governance/rules/agent-rules.md` documented a decision request only as a single bare object,
never shown wrapped in a real document — an external agent following it literally, needing to write more than
one request, could plausibly (and, in a real dogfooding session, did) produce a bare array. Juntia's own
architecture declares that an agent writes to this file directly; the representation its own documentation
leads an agent to produce must be one Core accepts. The documentation was also fixed to show the complete,
unambiguous contract — this tolerance and that fix are two views of the same real gap, not independent
choices.

**Recorded:** `phases/just-in-time-governance.md`.

## A confirmed decision is a live instruction for unfinished work, never just history — but "applied" is never a status Juntia asserts

**Decision:** `.juntia/task-handoff.md` — the file an agent actually works from mid-task — is now regenerated
by `juntia confirm`, not just `.juntia/context.md`. It distinguishes a decision confirmed before the current
task started (baseline) from one confirmed since (flagged as possibly superseding a provisional value already
chosen). Deliberately rejected: adding a fourth, persisted `applied` status to a decision record, set by an
agent or a command once it believes it has acted on it.

**Why:** a real, live Snake dogfooding session found that two of four confirmed decisions never reached the
game's code — `.juntia/context.md` was refreshed correctly, but nothing told the agent mid-task that a decision
it needed had just changed. Juntia has no way to verify a code change actually implements a decision correctly
without patching source itself, which contradicts "AI interprets. Juntia governs." — a self-reported `applied`
flag would let a decision look resolved without being resolved. Scoping "new" to the current task's own
lifetime (a fresh `juntia route` call resets the baseline) gives the same practical signal without Juntia ever
claiming something about code it did not check.

**Recorded:** `phases/decision-continuity.md`.

## Governance signals must be declared, never text-interpreted

**Decision:** the dynamic governance level mechanism (`lib/governance/governance-signals.js`) never scans a
request's own free text to decide whether a signal applies. A caller (an agent, applying its own judgment, or
a human via `juntia route --signal <name>`) declares which signals apply; Juntia only computes the
deterministic result of that declaration.

**Why:** the alternative — detecting impact categories via regex over free text — is exactly what the legacy
`architecture-reasoning.js` did (`IMPACT_CUES`), and is exactly the kind of "interpretación más allá de
clasificación determinista" that contradicts "AI interprets. Juntia governs." Declared signals keep the
boundary real: Juntia evaluates what's told to it, never what it infers.

**Recorded:** `phases/governance-level-dynamic-and-legacy-cleanup.md`.

## The legacy reasoning layer is fully removed, not just unwired

**Decision:** `intent-router.js`, `product-reasoning.js`, `architecture-reasoning.js`, `engineering-reasoning.js`,
`intent-runtime-bridge.js`, `runtime/reasoning-guideline.js`, and their two orphaned dependents
(`runtime/validator.js`, `runtime/false-confidence-risk-signal.js`) are deleted from the codebase, not merely
unexported. `lib/index.js`'s public API dropped `classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/
`analyzeEngineering`/`interpretIntent` — a real, intentional breaking change.

**Why:** these modules tried to reason about *what should be built* (product framing, architecture
recommendations, an implementation plan with files/steps/test strategy) and, in `intent-runtime-bridge.js`'s
case, called an AI runtime from inside Juntia itself — both squarely inside what Juntia's own governing
definition excludes. They were kept, unremoved, for several phases specifically to avoid dropping tested,
working code without real evidence it was safe to drop. This phase is that evidence: a real, evidenced
successor (`intent-model.js` + the Knowledge Layer + governance signals) already existed, and having two
competing architectures live in the same package was itself the higher-risk state.

**Recorded:** `phases/governance-level-dynamic-and-legacy-cleanup.md`.

## 0.x allows documented breaking changes; 1.0 is reserved for real stability

**Decision (pre-existing, restated here as the standing rule this phase relied on):** a MINOR version bump
while in `0.x` may include a breaking change to the CLI or public API, as long as it's documented in
`CHANGELOG.md`. `1.0.0` is reserved for the first real stability commitment, once sustained external usage
(not just this repo's own validation) justifies it.

**Why:** freezing a still-stabilizing surface prematurely would block correcting real design mistakes (this
phase's own legacy-export removal being the latest instance) behind an unearned stability guarantee.

**Recorded:** `docs/RELEASE.md#versioning-while-0x`.
