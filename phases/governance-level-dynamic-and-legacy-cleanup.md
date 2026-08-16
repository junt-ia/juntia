# Governance Level Dynamic & Legacy Reasoning Cleanup

The first file committed under `phases/` — every prior phase doc this codebase's own comments reference
(`phases/04-intent-router.md`, `phases/15c-workflow-routing.md`, `phases/15f-decision-model.md`, ...) was
written and kept locally during development but never committed; by the time this phase started, none of
those files existed on disk anymore. This phase's own doc starts a real, committed convention at this path
going forward. Nothing about that history is reconstructed here — only this phase's own real work.

## Vision this phase is grounded in

> AI interprets. Juntia governs.

Juntia is not an agent. It doesn't decide solutions, doesn't reason about what to build, and doesn't replace
human or agent judgment. It organizes how much process a piece of work needs. Two problems stood in the way of
that identity being fully true:

1. **Governance level was static.** Every workflow declared one fixed default (`feature-development` is
   always STANDARD) — but two features under that same workflow can have wildly different real impact. A
   trivial NPC animation and a persistent economy system both got the same level of process.
2. **Two architectures still coexisted.** An earlier "reasoning engine" layer (Phases 04-11: intent
   classification, product/architecture/engineering reasoning, an internal AI runtime bridge) had been
   superseded by the Core/Knowledge Layer/Agent architecture (Phase 15C+), but was never actually removed —
   only marked "legacy, unwired." `README.md` told users this explicitly: the modules "remain in the package
   for compatibility but are not part of the current architecture's vision."

## Part 1 — Governance Level Dynamic

### The constraint that shaped the design

No AI, no NLP, no free-text interpretation. This ruled out the most obvious approach — detect impact by
scanning the request's own text for keywords (exactly what the now-deleted `architecture-reasoning.js` tried,
with its `IMPACT_CUES` regex table). That approach is precisely the kind of "interpretación más allá de
clasificación determinista" this phase's own brief forbids, and it's a large part of why that file no longer
exists.

The resolution: signals are **declared**, never detected. The same trust boundary
`.juntia/governance/rules/decision-triggers.md` already established for decision escalation — "a trigger
firing means 'go check' — you decide whether it applies" — applied here to governance level instead.
`lib/governance/governance-signals.js` never reads the request's own text; a caller (an agent applying its own
judgment, or a human via `juntia route "..." --signal <name>`) names which signals apply, and Juntia computes
the deterministic result of that declaration.

### The escalation/de-escalation rule

With no signals declared, `governanceLevel` equals the workflow's own static base — byte-identical to the
pre-existing behavior for every caller that doesn't opt in. With one or more recognized signals declared, the
final level is the **highest** level named among them:

- A single STRICT-mapped signal (`new_dependency`, `architecture_change`, `data_model_change`,
  `security_impact`, `breaking_change`) always wins, regardless of how many lower-level signals are also
  present.
- An all-LIGHT declaration (`documentation_only`, `isolated_change`) can resolve **below** the workflow's own
  base — the brief's own worked example: an isolated, dependency-free change under `feature-development`
  (base STANDARD) resolving to LIGHT.

Unrecognized signal names are silently ignored — never guessed at, never an error, the same discipline
`decision-triggers.js`/`workflow-knowledge.js` already use for malformed or unexpected input.

### What shipped

- `templates/governance/rules/governance-signals.md` — a small, curated catalog (10 entries), scaffolded once
  by `juntia init` like `decision-triggers.md`, project-editable after that. Reuses `decision-triggers.md`'s
  own signal names where the concept overlaps (`new_dependency`, `data_model_change`) for conceptual
  coherence between the two files.
- `lib/governance/governance-signals.js` — `parseGovernanceSignals`, `loadGovernanceSignals`,
  `evaluateGovernanceLevel({ baseLevel, declaredSignals, catalogSignals }) -> { baseLevel, detectedSignals,
  finalLevel, requiredReview }`.
- `routeWorkflow(text, projectRoot, { signals })` — `governanceLevel` is now the FINAL level;
  `baseGovernanceLevel`/`detectedSignals`/`requiredReview` are new, additive fields.
- `buildAgentContext()`/`buildTaskHandoff()` — additive fields, defensively defaulted so a route object built
  before this addition still produces a valid result. `task-handoff.md` prints the brief's own exact
  `Base governance` / `Detected signals` / `Final governance` / `Required review` block only when at least one
  signal was actually recognized; the plain `Governance: LEVEL` line is unchanged otherwise.
- `juntia route "<request>" --signal <name>` (repeatable) — the CLI surface.

### What this deliberately does not do

Decide what to implement. `evaluateGovernanceLevel` answers exactly one question — "how much process and
review does this need?" — never "what should be built" or "is this a good idea." It has no opinion on the
request's content beyond the signal names handed to it.

## Part 2 — Legacy Reasoning Cleanup

### Classification

| Module | Verdict | Why |
|---|---|---|
| `lib/intent-router.js` | Deleted | Nine-intent free-text classifier + `RISK`/`CONTEXT_MAP`/`WORKFLOW_MAP` — fully superseded by `intent-model.js` (four-intent, numeric confidence) + the Knowledge Layer. Kept both taxonomies alive at once, exactly the "two competing architectures" this phase closes. |
| `lib/product-reasoning.js` | Deleted | Extracts "desired behavior," detects named-category unknowns, assembles acceptance criteria from free text — interpretation beyond classification. |
| `lib/architecture-reasoning.js` | Deleted | `IMPACT_CUES` detects impact categories via regex over free text — the exact mechanism Part 1 deliberately avoided. Its `impactLevelFromCategories`/`ALWAYS_CONFIRM_CATEGORIES` tier logic is real, good prior art — already credited in `governance-levels.js`'s own header as what LIGHT/STANDARD/STRICT was grounded in — but the concept was recognized, not extracted as code, both when `governance-levels.js` was built and again for Part 1's signal catalog. Nothing in the file needed to survive as code. |
| `lib/engineering-reasoning.js` | Deleted | Assembles objective, scope, implementation steps, files likely affected, test strategy — literally deciding how to build something. The single most direct violation of "Juntia no implementa código" in the whole legacy layer. |
| `lib/intent-runtime-bridge.js` | Deleted | Calls an AI runtime *from inside Juntia* to reason about a request (`adapter.interpret()`). Contradicts the AI Handoff model (Phase 13D): Juntia writes instructions for an external agent, never invokes a runtime itself. |
| `lib/runtime/reasoning-guideline.js` | Deleted | The system prompt sent to the runtime by `intent-runtime-bridge.js`. Only meaningful if that module is alive. |
| `lib/runtime/validator.js` *(found during audit, not in the original list)* | Deleted, with one real dependency extracted first | Validated the legacy bridge's runtime output. Not fully orphaned as first assumed: `lib/runtime/project-interpretation-validator.js` (active — powers `juntia confirm`'s AI Handoff validation) imported its `FORBIDDEN_GOVERNANCE_KEYS`/`ALLOWED_CONFIDENCE` constants. Caught by running the full test suite immediately after deletion, not assumed safe. Those two constants are now defined directly in `project-interpretation-validator.js`; everything else in `validator.js` (`validateInterpretation`, `INTENTS`/`ALLOWED_INTENTS`) really was only reachable through the deleted bridge. |
| `lib/runtime/false-confidence-risk-signal.js` *(found during audit)* | Deleted | Decided when the legacy bridge should escalate to the AI runtime. Only ever consumed by `intent-runtime-bridge.js`. |

Everything else — the Knowledge Layer resolvers, the decision model/triggers, agent context/handoff,
project-intelligence facts/decisions/scanner, and the *active* `runtime/project-interpretation-*` pair — is
current-architecture Core and was not touched.

### What was NOT found to need cleanup

`test/fixtures/semantic-layer-baseline-dataset.js` and `test/fixtures/semantic-strategy-eval-dataset.js`
reference the legacy `classifyIntent()`/`analyzeProduct()` chain in their own header comments (historical
evaluation data from an earlier phase), but no `.test.js` file requires either of them — they were already
orphaned, inert data before this phase, never wired into the running suite. Out of scope: they don't reference
the removed modules at runtime (only in comments), don't fail any test, and weren't named in this phase's own
brief. Left as-is.

### Public API impact

`lib/index.js` no longer exports `classifyIntent`, `analyzeProduct`, `analyzeArchitecture`,
`analyzeEngineering`, or `interpretIntent`. This is a real, intentional breaking change to
`require('@juntia/juntia')`, allowed under `docs/RELEASE.md`'s own 0.x versioning rule (a MINOR release may
include a documented breaking change while the public surface is still stabilizing) and exactly what
`README.md` already told users to expect. `classifyTaskIntent`/`routeWorkflow` are the only, current, real
entrypoint now — a single architecture, not two.

## Verification

- Full test suite (`npm test`): 682 tests before this phase, 427 after (255 legacy tests deleted with their
  modules), zero failures at every stage — Part 1 landed and was verified first, then Part 2's deletions were
  verified by a full re-run, which is exactly what caught the `runtime/validator.js` dependency `
  project-interpretation-validator.js` actually had.
- `grep` sweep across `lib/`, `bin/`, `test/`, `docs/`, `README.md`, `CONTRIBUTING.md` for every deleted
  module's filename and every removed export name: no remaining `require()` of a deleted file; every prose
  mention that survived is deliberately past-tense, narrating what was removed and pointing at this doc.

## Answers to this phase's own closing questions

1. **¿Governance Level puede adaptarse al impacto real?** Yes — a workflow's static base can now be escalated
   or de-escalated by declared signals, verified end-to-end (`test/workflow-router.test.js`,
   `test/governance-signals.test.js`, `test/cli-route.test.js`).
2. **¿La evaluación sigue siendo determinista?** Yes — no AI, no NLP, no text matching anywhere in
   `governance-signals.js`; every signal is an explicit declaration, matched against a static markdown
   catalog by exact name.
3. **¿La Knowledge Layer sigue siendo fuente de verdad?** Yes, more than before — the signal catalog itself
   lives in `.juntia/governance/rules/governance-signals.md`, not in JavaScript; the Core module only knows
   how to read and combine it. The legacy layer's own `WORKFLOW_MAP`/`CONTEXT_MAP` (workflow definitions
   hardcoded in JS) — the pattern the Knowledge Layer replaced — is now fully gone, not just superseded.
4. **¿El agente recibe correctamente el nivel final?** Yes — `governanceLevel` in the Agent Context and CLI
   output is the final level; `baseGovernanceLevel`, `detectedSignals`, and `requiredReview` are additional,
   explicit fields naming why it differs from the workflow's own default when it does.
5. **¿Qué señales aumentan governance?** `new_dependency`, `architecture_change`, `data_model_change`,
   `security_impact`, `breaking_change` (all STRICT); `new_functionality`, `behavior_change`,
   `tests_required` (STANDARD, useful mainly for escalating a LIGHT-default workflow like `bug-fix`).
   `documentation_only`/`isolated_change` (LIGHT) can lower it.
6. **¿Qué módulos legacy fueron eliminados?** Eight: the six named in this phase's own brief
   (`intent-router.js`, `product-reasoning.js`, `architecture-reasoning.js`, `engineering-reasoning.js`,
   `intent-runtime-bridge.js`, `runtime/reasoning-guideline.js`) plus two found during audit
   (`runtime/validator.js`, `runtime/false-confidence-risk-signal.js`) that would otherwise have been left as
   dead code.
7. **¿Qué módulos legacy fueron migrados?** None as code. One concept — impact categories mapping to a tier —
   was already recognized (not extracted) into `governance-levels.js` before this phase, and is now the
   direct ancestor of Part 1's signal catalog. Two constants (`FORBIDDEN_GOVERNANCE_KEYS`, `ALLOWED_CONFIDENCE`)
   were inlined from the deleted `runtime/validator.js` into the active
   `runtime/project-interpretation-validator.js`, which still needed them.
8. **¿Existe todavía lógica de agente dentro de Juntia?** No — no module calls an AI runtime, assembles an
   implementation plan, or proposes a technical solution anywhere in the codebase after this phase.
9. **¿La arquitectura final está alineada con Core / Knowledge / Agent?** Yes — a single classification/
   routing/governance path (Core), a single declarative source of truth for its content (Knowledge Layer,
   including the new signal catalog), and zero internal reasoning about what an external Agent should build.
10. **¿Está listo Juntia para una nueva publicación beta?** The two gaps this phase targeted are closed, but
    `README.md`'s other named limitations are unchanged by this phase (no real live-agent session has been run
    end-to-end; only Claude Code is a built integration). Verdict below is scoped to what this phase actually
    resolved, not a judgment on those separate, pre-existing gaps.

**Verdict: CONTINUE.** Both objectives landed with real, deterministic mechanisms, verified by a full,
green test suite before and after, and the codebase now has exactly one architecture instead of two. The
remaining beta limitations `README.md` already named are real but out of this phase's scope — they don't
block continuing, they define what the next phase should evaluate.
