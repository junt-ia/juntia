# Decisions

Standing, hard-to-reverse decisions about Juntia's own architecture and direction — the project-level
equivalent of `.juntia/DECISIONS.md`, which instead records decisions *within* a Juntia-governed project (and
is gitignored, self-hosted instance data, not committed here). Append-only: a superseded decision is marked
as such, never silently deleted.

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
