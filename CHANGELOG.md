# Changelog

All notable changes to `@juntia/juntia` are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning follows [semver](https://semver.org/), with the
0.x-specific meaning described in [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x).

## [Unreleased]

Nothing yet.

## [0.13.0] - 2026-08-17

### Just-In-Time Governance

Two consecutive objectives, both grounded in a real Phase 16B dogfooding session. Full account:
[`phases/just-in-time-governance.md`](phases/just-in-time-governance.md).

#### Fixed

- `lib/project-intelligence/pending-store.js#loadPending` now accepts a bare JSON array as `pending.json`'s
  items list, not only the canonical `{ schemaVersion, items }` wrapper — the exact shape an external agent
  following `.juntia/governance/rules/agent-rules.md`'s own (previously incomplete) example could plausibly
  produce, and did, in the real dogfooding session that found this. `normalizePendingItems` self-heals the
  array shape back to the canonical document on disk the moment it's next touched; nothing else about
  accepted/rejected shapes changed.
- `agent-rules.md` now documents the complete `pending.json` contract — the per-request object shape, both
  accepted document shapes, and the one shape (a single bare object) that is still never valid.
  `product-decision-making`/`architecture-decision-record` skills point at this single definition instead of
  each repeating their own partial copy.

#### Changed

- `governance-review/SKILL.md` reframed from a single "immediately before implementation" checkpoint into a
  standing, just-in-time capability — invoked the moment a decision area becomes concrete, at any workflow
  step, as many times as genuinely needed. `feature-development.md`/`bug-fix.md`/`refactor.md` updated to
  match; `governance-review` added to the latter two's own "Skills recommended," which previously named no
  escalation skill despite declaring real decision areas.
- `decision-triggers.md` now states explicitly that its own `Requires confirmation: yes/no` field is this
  codebase's BLOCKING/non-blocking definition — declarative, never inferred from a question's own text.
- `agent-rules.md`'s decision-escalation rule, the four role files
  (`product.md`/`architect.md`/`engineer.md`/`qa.md`), `governance-levels.js`'s `decisionGuidance` strings, and
  `task-handoff.js`'s generated "Potential decisions" prose all reworded to remove "before implementing"
  single-pass framing in favor of the same just-in-time principle. `bootstrap.js` gains a "While you are
  working" section stating it directly.

#### Not added

No new CLI command, no new decision status ("applied" evaluated and rejected again, same reasoning as
Decision Continuity), no per-workflow "apply confirmed decisions" phase (evaluated, rejected as duplicating
what Core's existing `task-handoff.md` refresh already provides uniformly), no automatic/inferred blocking
classification.

## [0.12.0] - 2026-08-17

### Decision Continuity

Closes a real gap the first live dogfooding session (a three-arm Snake experiment) found: `juntia confirm`
already refreshed `.juntia/context.md` on every confirmation, but never `.juntia/task-handoff.md` — the file
an agent is actually mid-task against — so a human-confirmed decision that contradicted a provisional value
an agent had already proposed did not reliably reach it. Two of four confirmed decisions never reached the
game's code. Full account: [`phases/decision-continuity.md`](phases/decision-continuity.md).

#### Added

- `.juntia/task-handoff.md` gains a `## Confirmed decisions` section, split into decisions confirmed since the
  current task started (flagged — may supersede a provisional value already chosen) and decisions already
  known when it started (filtered to the workflow's own declared decision types). For a product/architecture
  decision, the original question and options considered are shown alongside the human's actual confirmed
  answer.
- `juntia confirm` now refreshes `.juntia/task-handoff.md` (when one currently exists) immediately after
  recording a decision, via a new `refreshTaskHandoffDecisions` (`lib/governance/task-handoff.js`) — no new CLI
  command; reuses the existing `route`/`confirm` cycle.
- `buildTaskHandoff(text, route, { decisions, generatedAt })` — two new, defensively-defaulted options; every
  pre-existing caller is unaffected.

#### Changed

- `lib/governance/bootstrap.js` / `templates/governance/rules/agent-rules.md` — one short, generic instruction
  each, pointing at the new section when a task handoff already exists.

## [0.11.0] - 2026-08-16

Governance Level Dynamic & Legacy Reasoning Cleanup: governance level was a static per-workflow default; this
phase makes it respond to declared, deterministic impact signals, and finishes retiring the "legacy reasoning"
architecture Phase 15A first flagged as superseded but never removed. One identity going forward: Juntia as a
deterministic governance layer, not a reasoning engine. See
[`phases/governance-level-dynamic-and-legacy-cleanup.md`](phases/governance-level-dynamic-and-legacy-cleanup.md)
for the full account.

### Added

- `lib/governance/governance-signals.js` (new) + `.juntia/governance/rules/governance-signals.md` (new,
  scaffolded) — a small, curated catalog of declarable signals (`new_dependency`, `architecture_change`,
  `data_model_change`, `security_impact`, `breaking_change`, `isolated_change`, `documentation_only`, and
  others), each naming a LIGHT/STANDARD/STRICT level and an optional decision type. Never matched against a
  request's text — a caller (an agent, or a human via `juntia route "..." --signal <name>`, repeatable)
  declares which signals apply; Juntia only computes the deterministic result.
- `routeWorkflow()`/`buildAgentContext()`/`buildTaskHandoff()` gain `baseGovernanceLevel`, `detectedSignals`,
  and `requiredReview`. `governanceLevel` is now the FINAL level after any declared signals were applied — a
  single STRICT-mapped signal escalates over any number of lower ones; an all-LIGHT declaration can
  de-escalate below a workflow's own STANDARD default. With no signals declared, behavior is byte-identical
  to the previous static level, for every existing caller.
- `.juntia/task-handoff.md` prints a `Base governance` / `Detected signals` / `Final governance` /
  `Required review` block whenever at least one declared signal was recognized; unchanged otherwise.
- `juntia route "<request>" --signal <name>` (repeatable) — the CLI surface for declaring signals.

### Removed

- The legacy, nine-intent free-text reasoning layer, unwired since Phase 15A and explicitly named in
  `README.md` as "not part of Juntia's current direction": `lib/intent-router.js`, `lib/product-reasoning.js`,
  `lib/architecture-reasoning.js`, `lib/engineering-reasoning.js`, `lib/intent-runtime-bridge.js`,
  `lib/runtime/reasoning-guideline.js` — plus `lib/runtime/validator.js` and
  `lib/runtime/false-confidence-risk-signal.js`, found orphaned once their only remaining consumer
  (`intent-runtime-bridge.js`) was removed. **Breaking change** to the public API: `require('@juntia/juntia')`
  no longer exports `classifyIntent`, `analyzeProduct`, `analyzeArchitecture`, `analyzeEngineering`, or
  `interpretIntent` — only `classifyTaskIntent`/`routeWorkflow` remain, per `docs/RELEASE.md`'s own 0.x rule
  that a MINOR release may include a documented breaking change while the public surface is still stabilizing.
  `lib/runtime/project-interpretation-validator.js` (the actively-used AI Handoff validator — unrelated to
  the removed intent-domain `validator.js` beyond having briefly shared two constants) now defines
  `FORBIDDEN_GOVERNANCE_KEYS`/`ALLOWED_CONFIDENCE` directly; unaffected in behavior.

## [0.10.0] - 2026-08-16

Decision Discovery & Governance Triggers: Phase 15F gave Juntia a real model for product/architecture
decisions once they appear; this phase helps them appear at the right moment — before an agent silently
guesses a value and writes it into code, the real failure mode `restaurant-game`'s own M04 dogfooding showed
even with the Phase 15F mechanism already available. "Juntia no toma decisiones. Juntia ayuda al agente a
saber cuándo una decisión debe existir."

### Added

- Workflow files can now declare specific, named decision AREAS within each type (e.g. `product: behavior,
  user_experience, scope, balancing`), not just the type itself — parsed by a new `extractDecisionAreas()` in
  `lib/governance/workflow-knowledge.js` into `workflow.decisionAreas`, propagated through `routeWorkflow()`,
  `buildAgentContext()`, and a new "## Potential decisions" section in `.juntia/task-handoff.md`.
- `lib/governance/decision-triggers.js` (new) + `.juntia/governance/rules/decision-triggers.md` (new,
  scaffolded) — a small, curated catalog (5 entries) of situations that commonly signal a real product/
  architecture decision (`new_gameplay_rule`, `balancing_value`, `new_dependency`, `data_model_change`,
  `cross_module_boundary`), each with a type, a reason, and whether it recommends confirmation. Read-only,
  referenced from `.juntia/BOOTSTRAP.md` — never matched against a request automatically.
- `governance-levels.js`'s `LEVEL_INFO` gained a `decisionGuidance` field per level (LIGHT/STANDARD/STRICT) —
  a short, fixed instruction for how seriously to treat a workflow's declared decision areas at that level,
  surfaced as `workflow.decisionGuidance` in the Agent Context and rendered in `task-handoff.md`.
- A new skill, `governance-review` (Engineer role) — checking a workflow's own declared decision areas, and
  what's already pending or decided, immediately before implementing. A real, distinct trigger condition from
  Phase 15F's `product-decision-making`/`architecture-decision-record` (which activate reactively, once an
  unknown is already noticed): this one is the proactive, pre-implementation gate the real dogfooding failure
  mode was missing.
- `templates/governance/rules/agent-rules.md` gained one new rule: check for a real decision before
  implementing, not after — pointing at `governance-review` and `decision-triggers.md`.

### Changed

- `investigation.md` now names one real decision area it commonly surfaces (`architecture: technical_direction`)
  — a refinement over Phase 15F's "None, by design": the workflow still never writes a decision request
  itself, but can now correctly represent that it commonly surfaces the need for one.
- `bug-fix.md` now names both decision types explicitly (architecture, common; product, rare but real,
  `expected_behavior`) instead of only architecture.

### Not built this phase

Per the phase's own explicit restrictions: no automatic task blocking, no AI that detects decisions, no
machine learning, no multi-agent, no npm publish, no new runtimes. Decision triggers are never matched against
a request automatically — an agent reads the catalog and applies its own judgment, the same way it already
does for the Knowledge Layer's other declarative content.

## [0.9.0] - 2026-08-16

Decision Model: real dogfooding in `restaurant-game` against the published `0.8.0` beta found a real gap —
Juntia's pending/confirmation mechanism was shaped for one kind of uncertainty (interpreting the project's own
facts) and had no way to represent a product or architecture decision, so `.juntia/DECISIONS.md` was hand-
edited directly, bypassing Juntia's own structured mechanism entirely. "No todo lo que un agente no sabe es
una interpretación pendiente. Algunas cosas son decisiones que el equipo debe tomar."

### Added

- `lib/governance/decision-model.js` (new) — `DECISION_TYPES` (`interpretation`/`product`/`architecture`),
  `validateDecisionRequest()`: the untrusted-input validator for an agent-proposed product/architecture
  decision request. Forbids the same outcome fields (`text`, `decision`, `confirmedAt`, `source`,
  `confidence`, `basedOn`) an agent must never set — it may propose a question, never an answer.
- `.juntia/pending.json` now accepts a decision request shape (`{ type: "product"|"architecture", question,
  context, options, evidence }`) alongside the existing interpretation shape — a general "needs a human
  answer" store, no longer coupled only to facts. `lib/project-intelligence/pending-store.js` gained
  `upsertDecisionRequest`/`decisionRequestId`, mirroring `upsertPending`/`interpretationId` for the new shape.
- `.juntia/decisions.json` records now carry a `type` field and, for product/architecture, `question`/
  `context`/`options`/`evidence`/`text` (the human's real answer) — `recordDecision()` and
  `appendDecisionNarrative()` are type-aware; every decision record now also carries `source: "human"`,
  structurally documenting the human-confirmation guarantee, uniformly across every type.
- `juntia confirm` now branches by pending-item type: a decision request prompts for a real, free-text answer
  (or `skip`/`reject`) instead of yes/no — the same human-in-the-loop gate, adapted to an open-ended question.
- Workflow files gained a new `## Decisions this workflow may require` section (`feature-development.md`:
  product + architecture; `bug-fix.md`/`refactor.md`: architecture only; `investigation.md`: none, by design)
  — parsed by `workflow-knowledge.js` into a new `decisionTypes` field, propagated through `routeWorkflow()`,
  `buildAgentContext()` (`workflow.decisionTypes`), and a new "## Decisions" section in
  `.juntia/task-handoff.md` naming the real escalation mechanism for that specific request.
- Two new skills: `product-decision-making` (Product role) and `architecture-decision-record` (Architect
  role) — recognizing and escalating a real product/architecture unknown as a decision request, grounded
  directly in the real restaurant-game gap. A third candidate (`decision-analysis`) was evaluated and not
  built — its responsibility (comparing options, traceability) is inherent to the two skills above, not a
  distinct concern with its own real owner.
- `templates/governance/rules/agent-rules.md` gained one new standing rule: never invent a product or
  architecture decision — escalate a real, blocking unknown as a decision request instead.

### Changed

- `lib/project-intelligence/decisions-store.js`'s `detectConflicts()` now only ever checks decisions with a
  real, non-empty `basedOn` array — a real bug this phase's own design review found: a product/architecture
  decision's free-text `evidence` (e.g. `"docs/MILESTONES.md M04"`) would otherwise always fail to match any
  real fact key and get incorrectly flagged `conflicted`.
- `lib/project-intelligence/context-generator.js`'s `summarizeDecisions()` renders product/architecture
  decisions distinctly — never with the interpretation-shaped "based on: `<fact keys>`" phrase, which would be
  misleading for a decision that was never grounded in a project fact.

### Not built this phase

Per the phase's own explicit restrictions: no AI decides automatically, no multi-agent, no machine learning,
no fully autonomous governance, no npm publish, no new providers. No cleanup of the six Legacy Reasoning Layer
modules. No additional dogfooding session.

## [0.8.0] - 2026-08-16

**The first public beta release.** Consolidates Phases 15B (Knowledge Layer), 15C (Workflow Routing Engine),
and 15D (Agent Consumption Model) — Phases 0.6.0/0.7.0 were completed and documented individually but never
published; this is the first version published to npm since `0.5.0`. Known beta limitations: no real session
has been run with a live AI agent following the generated handoff/bootstrap files end to end; only Claude Code
is a real, built integration; no automatic role invocation or skill execution; governance levels are a static
per-workflow default, not a dynamic risk classifier; the legacy free-text reasoning modules
(`classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/`analyzeEngineering`/`interpretIntent`) remain
exported for compatibility but are not part of the current architecture's direction. See
[`README.md`](README.md#status) for the full, current list.

Agent Consumption Model: Phase 15C connected Juntia Core to the Knowledge Layer; this phase defines the real
contract an external agent uses to consume that connection, without a human explaining the architecture
manually every session.

### Added

- `lib/governance/bootstrap.js` (new) — `.juntia/BOOTSTRAP.md`: the real navigation index that used to live
  directly inside `CLAUDE.md`. Explains what Juntia is, what to read once per session for first-time
  orientation, how to get the workflow/roles/skills for a specific request (`juntia route`), and a pointer
  list to the Knowledge Layer — never "read everything up front." Reflects real, current filesystem state
  only (whether `RULES.md` or an active `task-handoff.md` exist), regenerated on every `integrate`/`route`
  call, never scaffolded once.
- `lib/governance/agent-context.js` (new) — `buildAgentContext(route)`: a pure transform from `routeWorkflow()`
  into the brief's own exact nested contract (`{ task: { intent, confidence }, workflow: { name,
  governanceLevel }, roles, skills, contextSources }`) — navigation, never a solution. Now what `juntia route`
  prints to the console, and embedded as a fenced JSON block in `.juntia/task-handoff.md`'s new "## Agent
  Context" section.

### Changed

- **`CLAUDE.md` redesigned as a real entry point, not a governance index (breaking change to its own shape,
  not to any public API).** Since Phase 14A it named every real governance file directly; per this phase's own
  explicit brief ("no debe decir 'lee todos estos archivos siempre'"), it now only states that the project uses
  Juntia Governance and points at `.juntia/BOOTSTRAP.md`. Its content is now identical for every project — it
  no longer varies by whether `.juntia/RULES.md` exists (`buildPointerContent()`'s `hasProjectRules` option was
  removed entirely).
- `juntia integrate <runtime>` now also generates/refreshes `.juntia/BOOTSTRAP.md` alongside the runtime
  pointer file and `agent-instructions.md`.
- `juntia route` now prints the Agent Context (nested shape) to the console instead of `routeWorkflow()`'s flat
  internal shape, and also refreshes `.juntia/BOOTSTRAP.md` on every call (whether or not the request
  resolved to a real workflow) — its programmatic return value is unchanged (still the flat shape).
- `juntia setup`'s final message no longer names a specific file (`agent-instructions.md`) to open manually —
  it now just says to open the configured assistant, since that assistant discovers what it needs via
  `CLAUDE.md` → `BOOTSTRAP.md` on its own.

### Not built this phase

Per the phase's own explicit restrictions: no automatic role invocation, no skill execution engine, no
automatic role switching, no Claude plugin integration, no Codex/Cursor integration, no learning mechanism, no
automatic modification of governance content. No `.claude/`-directory generation was built — no first-party
evidence yet for that convention, same discipline already applied to other runtimes. `juntia route` was kept,
not removed, as a real, advanced debugging command.

## [0.7.0] - 2026-08-16

Workflow Routing Engine: Phase 15B built the Knowledge Layer as real, declarative files; this phase connects
Juntia Core to it for real, turning a free-text request into a structured work framework — without Juntia ever
deciding how the request gets solved.

### Added

- `lib/governance/intent-model.js` (new) — `classifyTaskIntent(text)`: a four-intent classifier (`feature`,
  `bug`, `investigation`, `refactor`, mapped 1:1 to Phase 15B's real workflow files), numeric `[0, 1]`
  confidence, and `unknown` (with `needsClarification: true`) whenever there isn't enough signal — an
  ambiguous request never produces a guessed workflow.
- `lib/governance/governance-levels.js` (new) — a small, extensible LIGHT/STANDARD/STRICT registry (label,
  description, examples, `mayRequireRoles`, `humanConfirmationRequired`), grounded in the tier/impact tables
  Phase 15A already found real inside `architecture-reasoning.js`/`engineering-reasoning.js`. Not a risk
  classifier — a request's actual level is always read from its resolved workflow file.
- `lib/governance/workflow-knowledge.js` (new) — `resolveWorkflowForIntent(projectRoot, intent)`: reads a real
  `.juntia/governance/workflows/<file>.md` and parses its existing `## Roles involved` / `## Skills
  recommended` / `## Recommended governance level` sections. No template file was modified to make this
  possible — the Phase 15B files already had this structure. The only thing hardcoded in JS is the intent →
  filename correspondence, never a workflow's content.
- `lib/governance/workflow-router.js` (new) — `routeWorkflow(text, projectRoot)`: the real contract —
  `{ intent, confidence, workflow, governanceLevel, roles, skills, needsClarification, reason }`. Composes the
  three modules above; owns no interpretation logic of its own.
- `lib/governance/task-handoff.js` (new) — `.juntia/task-handoff.md`, a second, distinct handoff alongside
  Phase 13D's `agent-instructions.md`: task type, workflow, governance level, suggested roles/skills, and
  pointers (never copies) to the relevant workflow/role/skill/context files. Only written when a real workflow
  was resolved.
- `juntia route "<request>"` (new CLI command, `bin/juntia.js`) — the real entrypoint for the above: prints the
  routing result as JSON and writes `.juntia/task-handoff.md`. Scaffolds `.juntia/` first (silently,
  unconditionally), same precedent `integrate` already set, so a project that never ran `juntia init` still
  gets a real answer.
- `lib/index.js` now also exports `classifyTaskIntent`/`routeWorkflow` — this phase's own public entrypoint,
  alongside (not replacing) the five legacy exports.

### Changed

- `lib/intent-router.js`, `product-reasoning.js`, `architecture-reasoning.js`, `engineering-reasoning.js`,
  `intent-runtime-bridge.js`, and `lib/runtime/reasoning-guideline.js` each gained a short, documentation-only
  header note naming this phase's real successor to their free-text classification responsibility and
  confirming their Phase 15A/15B "Legacy Reasoning Layer, not eliminated" status. No logic in any of these six
  files changed.

### Not built this phase

Per the phase's own explicit restrictions: no automatic role invocation, no skill execution engine, no
workflow-execution mechanism, no multi-agent support, no new provider, no plugins, no dogfooding session. The
six Legacy Reasoning Layer modules were not migrated, retired, or wired to anything new.

## [0.6.0] - 2026-08-15

The Knowledge Layer: Phase 15A's audit found real governance content (agent rules, workflows) trapped in JS
string builders instead of existing as declarative, versionable artifacts. This phase migrates it.

### Added

- `.juntia/governance/` (scaffolded by `juntia init`, `templates/governance/`, new) — the Knowledge Layer
  contract: `rules/agent-rules.md`, `workflows/{feature-development,bug-fix,investigation,refactor}.md`,
  `roles/{product,architect,engineer,qa}.md` (moved from `.juntia/roles/`), `skills/{feature-planning,
  architecture-review,implementation,testing-strategy}/SKILL.md` (new — a YAML-frontmatter schema:
  `name`/`description`/`role`/`when_to_use`/`inputs`/`process`/`expected_output`/`constraints`), and
  `conventions/README.md` (a contract only — no real convention content existed anywhere to migrate). Every
  file is scaffolded once, copied verbatim like every other `.juntia/init` template — never regenerated once
  it exists, unlike the files it replaces.

### Changed

- `.juntia/agent-rules.md`/`.juntia/workflows.md` (Phase 14A) are retired in favor of
  `.juntia/governance/rules/agent-rules.md` and `.juntia/governance/workflows/*.md` — same content, moved
  from JS template-literal builders (`lib/project-intelligence/agent-governance.js`, removed) into real,
  static template files. **A real, deliberate trade-off**: these files are no longer force-regenerated on
  every `integrate`/`setup` run — a project's own copy is genuinely theirs to edit once scaffolded.
- `juntia integrate <runtime>`'s generated `CLAUDE.md` governance index now points at `.juntia/governance/`
  (with sub-bullets for rules/workflows/roles/skills) instead of naming `agent-rules.md`/`workflows.md`
  individually.
- The Knowledge Layer is now scaffolded by `init()` itself, which runs unconditionally at the top of
  `integrate` — a real, positive behavior change from Phase 14A: a project whose own real, human-authored
  `CLAUDE.md` blocks runtime-pointer generation now still receives the Knowledge Layer, since it no longer
  depends on a successful runtime-specific integration.
- Old-path files (`.juntia/roles/*.md`, `.juntia/agent-rules.md`, `.juntia/workflows.md`) from a pre-0.6.0
  project are left untouched, never deleted or migrated automatically — non-destructive compatibility, not a
  silent migration. See [`docs/RUNTIME_INTEGRATION.md`](docs/RUNTIME_INTEGRATION.md#the-knowledge-layer-phase-14a--phase-15b--memory-behavior-and-where-it-lives).

### Removed

- `lib/project-intelligence/agent-governance.js` and its dedicated test file — its two responsibilities
  (fixed content, and writing it to disk) are now split between static templates and the existing, generic
  `init()`/`SCAFFOLD_FILES` scaffolding mechanism every other declarative file already used.

## [0.5.0] - 2026-08-14

Agent Governance for Claude Code: Phase 13D gave a connected agent memory (facts, decisions, context, a
handoff for producing a new interpretation). This gives it behavior — how it should work, not just what it
knows.

### Added

- `.juntia/agent-rules.md` (`lib/project-intelligence/agent-governance.js`, new) — fixed, deterministic
  rules for how any connected agent should behave in a Juntia-governed project: analyze before modifying,
  respect confirmed decisions, never add a dependency without stating why, ask when a request conflicts with
  something already decided, validate changes, never write directly to `.juntia/decisions.json`. The same
  content for every project — Juntia's own standing policy, not derived per-project. Deliberately not named
  `rules.md`/`RULES.md`: that name is already taken by a real, human-authored, project-specific constraints
  file (`.juntia/RULES.md`, scaffolded by `init`, never auto-written) with a genuinely different author and
  purpose.
- `.juntia/workflows.md` (same module) — the recommended sequence for a new feature (analyze impact → review
  architecture → propose → wait for confirmation if it conflicts with a decision → implement → validate) and
  for a bug fix (reproduce → investigate → modify → validate). Same fixed-content model as `agent-rules.md`.
- Both generated automatically by `juntia integrate <runtime>` (and `setup`, which calls it) alongside the
  existing handoff file, and gated behind the same "never overwrite a real, human-authored `CLAUDE.md`"
  protection `integrate` already had.

### Changed

- `juntia integrate claude-code`'s generated `CLAUDE.md` evolved from a two-file pointer into a governance
  **index**: it now opens with "Juntia is configured for this project" and lists every real file
  (`context.md`, `DECISIONS.md`, `agent-rules.md`, `workflows.md`, `agent-instructions.md`, and `RULES.md`
  when it actually exists) — never copying any of their content, only naming and pointing at them.

## [0.4.0] - 2026-08-14

The AI Handoff: Juntia no longer executes an AI runtime internally. Closes the real dogfooding finding from
`restaurant-game` (`analyze --explain` → `spawn("claude") ENOENT`) at its structural root — evaluated
architecturally first (see `phases/13c-ai-handoff-architecture.md`), implemented this phase.

### Changed

- `juntia analyze --explain` no longer spawns a subprocess or calls any AI runtime. It refreshes
  `.juntia/agent-instructions.md` — deterministic, generated from the same facts/diff `analyze` already
  computed — and reports how many interpretations are already pending. No `claude` binary, `PATH`, API key,
  or model configuration is required for any command to work.
- `juntia setup` no longer calls an AI runtime either. It reviews whatever proposals are already sitting in
  `.juntia/pending.json` (written by an external AI agent following the handoff instructions), asks which
  assistant you use, integrates it, and tells you to open it and follow `.juntia/agent-instructions.md`.
- `juntia integrate <runtime>` now also generates/refreshes `.juntia/agent-instructions.md` alongside the
  runtime-specific pointer file (`CLAUDE.md` for Claude Code). The pointer file itself now mentions the
  handoff file as a guide, without copying its content.
- `juntia confirm` now validates every pending item — shape, forbidden governance fields, and fact-grounding
  — before presenting it to a human, since a proposal can now arrive from an external AI agent, not only
  from Juntia's own (retired) internal call. An invalid or hallucinated proposal is dropped silently, never
  shown, never confirmable. A proposal that already matches a confirmed decision is recognized and dropped
  without asking again.

### Added

- `.juntia/agent-instructions.md` (`lib/project-intelligence/agent-handoff.js`, new) — the AI Handoff: a
  generated, deterministic file explaining to whatever AI agent reads it (Claude Code today) how to
  interpret the project from the same FACTS Juntia already verified, and where to write its proposal
  (`.juntia/pending.json`) for Juntia to validate.

### Removed

- `lib/runtime/claude-cli-adapter.js` and `lib/runtime/provider-registry.js` — the internal
  subprocess-execution mechanism this phase retires. `runtime.provider` in `.juntia/config.yml` keeps its
  storage and meaning (which assistant you use) but is no longer resolved to an internally-invoked adapter.
- `context-synthesis-bridge.js`'s `synthesizeContext` (the part that invoked an injected adapter) —
  `buildRequestText`, the deterministic FACTS/CHANGES/EXISTING CONTEXT renderer, stays and is now reused by
  `agent-handoff.js`.
- `resolveConfiguredAdapter`/`formatRuntimeFailure`/`formatUnresolvedRuntime` (bin/juntia.js) and the
  `adapter`/`adapterOptions` options on `runAnalyze`/`runSetup` — no longer meaningful once nothing in the
  primary CLI flow calls an adapter.

## [0.3.0] - 2026-08-14

Two real problems found during this migration's own first real dogfooding, both closed:

### Fixed

- `juntia analyze --explain` (and `setup`'s own explain step) no longer silently defaults to the Claude CLI
  adapter regardless of configuration. Both now read `.juntia/config.yml`'s `runtime.provider`, resolve the
  real adapter for it (`lib/runtime/provider-registry.js`, new), and report plainly — never guess — when
  nothing is configured (`No AI assistant configured yet — run \`juntia setup\`...`) or the configured value
  isn't a runtime Juntia has an adapter for (`"<name>" is configured, but ...`). A resolved-but-unavailable
  runtime (e.g. Claude Code not installed) still reports in plain language, not a raw process error — that
  guarantee is unchanged, now shared by `analyze --explain` too, not just `setup`.
- A file Juntia itself generates (currently `CLAUDE.md`, via `integrate`/`setup`) is now classified as a
  `managed.file` fact, never `structure.file` — it's real evidence of something, just not of the project's
  own architecture. Previously, `juntia analyze` could report `Added: structure.file: CLAUDE.md` as if a
  human had made a new architectural decision, when a human had actually just run `juntia setup`.

### Added

- `lib/runtime/provider-registry.js` — the real `providerName -> adapter` lookup Phase 12C named as the
  concrete next step, closing it for the project-interpretation domain (`analyze --explain`). The intent-
  classification domain (`interpretIntent()`) is unaffected — no CLI command currently drives it directly.

## [0.2.0] - 2026-08-14

`juntia setup` — the new recommended entrypoint. One command orchestrates the existing capabilities
(init → analyze → explain → confirm → context → integrate) into a single, plain-language onboarding flow,
so a new user never has to learn what a "fact," "interpretation," "decision," or "integration" is just to
get a project ready. Every underlying command (`init`/`analyze`/`confirm`/`context`/`integrate`) is unchanged
and still available directly for anyone who wants the detail or wants to script a specific step.

### Added

- `juntia setup` — detects whether the project is initialized, analyzes it, generates an AI interpretation
  and asks for confirmation once an assistant is configured, refreshes context, asks which AI assistant you
  use (Claude Code today; OpenAI Codex/Gemini CLI/Cursor listed as not-yet-available), and configures that
  integration — idempotent on every re-run, never overwrites a real file it didn't generate, and reports a
  plain-language message (never a raw process error) if the chosen assistant isn't actually available.
- `.juntia/config.yml`'s previously-unused `runtime.provider` field is now written by `setup` (and readable
  via `juntia integrate`'s own internals) as a real record of which assistant you use — not yet consumed to
  select an adapter for `analyze --explain`'s own AI calls, which remains a separate, still-open gap.

## [0.1.0] - 2026-08-14

First public release. 0.x — the CLI surface and public API are real and working, but not yet under a
stability guarantee; see [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x) for what that means in
practice.

### Added

- `juntia init` — scaffolds a project-local `.juntia/` context directory.
- `juntia analyze` — deterministic project inventory (languages, dependencies, config files, structure),
  each fact traceable to real evidence; persists a factual baseline to `.juntia/facts.json` and reports
  Added/Removed/Changed against it on every later run.
- `juntia analyze --explain` — a real AI-runtime interpretation of the persisted facts, validated against a
  fact-grounding check, saved as a pending item in `.juntia/pending.json`.
- `juntia confirm` — the only command that can create a decision: walks every pending interpretation and
  asks; a "yes" writes `.juntia/decisions.json` and appends a line to `.juntia/DECISIONS.md`.
- `juntia context` — assembles `.juntia/context.md` from confirmed facts and confirmed decisions only.
- `juntia integrate claude-code` — generates a `CLAUDE.md` pointer file so Claude Code finds
  `.juntia/context.md` on its own, without duplicating its content.
- A public, documented programmatic API (`require('@juntia/juntia')`): `classifyIntent`, `analyzeProduct`,
  `analyzeArchitecture`, `analyzeEngineering`, `interpretIntent`.
- A protected internal/public boundary enforced by `package.json`'s `exports` map — a deep `require()` into
  internal reasoning modules throws, by design.
