# Public CLI

This is the complete public surface. Anything not listed here (the Knowledge Layer resolver, the Intent Model,
governance signal evaluation, provider adapters) is internal engine — a developer using Juntia should never
need to invoke one of those directly. See
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#public-api-vs-internal-engine) for why that boundary matters.

A second boundary exists *within* this public surface, as of Phase 13A: `setup` is the one **recommended**
command for a new user — everything else is real, fully-supported, but **advanced**: individually useful for
scripting a specific step, debugging, or CI, not required reading to get started. `setup` doesn't replace or
hide the advanced commands; it coordinates them.

| Command | Responsibility | Status | Consumes AI? |
|---|---|---|---|
| `juntia setup` | **Recommended entrypoint.** Coordinates every command below into one onboarding flow: init if needed, analyze, interpret + confirm once a runtime is configured, build context, ask which AI assistant you use, configure that integration. Idempotent; never re-implements the commands it calls. See [`docs/RUNTIME_INTEGRATION.md`](RUNTIME_INTEGRATION.md#the-setup-orchestrator-phase-13a) for the full contract. | **Built** (Phase 13A) | Yes, but only on a run where a runtime was already configured by a previous `setup`/`integrate` — never on a project's very first `setup`. |
| `juntia init` | Create a project-local `.juntia/` context directory (config, state, decisions, rules, architecture, roles). | **Built** | Never — pure, deterministic filesystem scaffolding. |
| `juntia analyze` | Print a deterministic inventory of an existing project — languages, declared dependencies, recognized config files, top-level structure, each traceable to real evidence — and persist it as a factual baseline (`.juntia/facts.json`), reporting Added/Removed/Changed against the previous baseline on every run after the first. Also checks any confirmed decisions against the fresh facts and flags (never deletes) ones whose evidence is now missing. See [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) for the full knowledge model. | **Built — inventory + factual memory + conflict check** | Never. Deterministic tier only. |
| `juntia analyze --explain` | Same scan/persist/diff/conflict-check as plain `analyze`, plus one AI-runtime interpretation of the real facts — printed to the console and saved as a pending item in `.juntia/pending.json`, never as a fact or a decision. Reads `.juntia/config.yml`'s `runtime.provider` and resolves the real adapter for it (Phase 13B) — never guesses; reports plainly if nothing is configured or the configured value can't be resolved. See [`docs/RUNTIME_INTEGRATION.md`](RUNTIME_INTEGRATION.md#runtime-resolution-for-project-interpretation-closed-phase-13b) for the contract. | **Built** | Yes, opt-in only, and only once a runtime is configured. Plain `analyze` (no flag) never does this. |
| `juntia confirm` | Walks through every pending item. For a fact interpretation, asks a real yes/no question. For a product/architecture decision request (Phase 15F), prompts for a real, free-text answer (or `skip`/`reject`). Either way, a real answer writes a real decision (`.juntia/decisions.json` + a plain-English line appended to `.juntia/DECISIONS.md`), refreshes `.juntia/context.md`, and — Decision Continuity phase — refreshes `.juntia/task-handoff.md` too, if the current task already has one, so a decision confirmed mid-task reaches the file an agent is actively working from, not only the project-wide summary. Reads `.juntia/pending.json` as either the canonical `{ schemaVersion, items }` document or a bare JSON array (Just-In-Time Governance phase) — the exact shape an external agent's own documented contract can plausibly produce. Never runs without a human present to answer (accepts piped, non-interactive input the same way, so an agent can relay a human's answer from within the same session), and an agent can never pre-fill its own answer — see [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-decision-tier-built-phase-12k) for the full contract. | **Built** (Phase 12K; decision requests Phase 15F; task-handoff refresh Decision Continuity phase; pending.json contract tolerance Just-In-Time Governance phase) | No — asks a human, never the runtime. |
| `juntia context` | Rebuilds and prints `.juntia/context.md` from confirmed facts and confirmed decisions only — safe to run any time, including with nothing confirmed yet. | **Built** (Phase 12K) | Never — purely mechanical assembly of already-confirmed data. |
| `juntia update` | Migrates a project still carrying the pre-Phase-15B legacy governance scheme (`.juntia/agent-rules.md`, `.juntia/workflows.md`, `.juntia/roles/*.md`) into the current, single source of truth (`.juntia/governance/`) — the first real, evidenced conflict-resolution rule this command needed (see [`#why-update-was-scoped-narrowly`](#why-update-was-scoped-narrowly)). Never overwrites a new-scheme file that has already diverged from Juntia's own default (reports a conflict instead); never deletes or edits a legacy file. Also refreshes the runtime pointer file and `.juntia/BOOTSTRAP.md` afterward. | **Built** (Single Governance Source of Truth phase) — scoped to this one migration, not a general scaffolded-file sync engine | Never — mechanical file comparison and copy. |
| `juntia integrate <runtime>` | Generate a small, runtime-specific entry-point file (e.g. `CLAUDE.md` for `claude-code`) at the path that runtime already reads on its own, pointing it at `.juntia/BOOTSTRAP.md` — the real navigation index (Phase 15D) — rather than naming every governance file directly. Also refreshes `.juntia/agent-instructions.md` and `.juntia/BOOTSTRAP.md`. Records the integration in `.juntia/config.yml`. | **Built** (Phase 12L; entry-point redesign Phase 15D) — `claude-code` only; others documented, not implemented | Never — no AI call, nothing sent anywhere; pure, deterministic file generation. |
| `juntia route "<request>" [--signal <name>]...` | Classifies a free-text request into `feature`/`bug`/`investigation`/`refactor`/`unknown` (numeric confidence, never a guess when signal is weak), resolves the matching `.juntia/governance/workflows/*.md` file, prints the Agent Context (`{ task, workflow, roles, skills, contextSources }`), and — only when a real workflow was resolved — writes `.juntia/task-handoff.md` for whichever AI agent reads it next, including a "Confirmed decisions" section seeded from whatever is already in `.juntia/decisions.json`; also refreshes `.juntia/BOOTSTRAP.md`. Scaffolds `.juntia/` first if it doesn't exist yet, same as `integrate`. The repeatable `--signal <name>` flag declares a governance signal (`.juntia/governance/rules/governance-signals.md`) that escalates or de-escalates the workflow's own default governance level — never inferred from the request's text, only ever what's explicitly declared. Not part of the primary `setup`/`analyze`/`integrate` experience an agent following `CLAUDE.md` → `BOOTSTRAP.md` needs — kept as a real, advanced command mainly useful for debugging what Juntia would resolve for a given request, per Phase 15D's own explicit "no eliminar todavía." | **Built** (Phase 15C, extended Phase 15D; dynamic governance level added in the Governance Level Dynamic and Legacy Cleanup phase) | Never — deterministic keyword classification + markdown parsing, no AI call. |

No command beyond these eight exists or is planned without new evidence. `route` (Phase 15C) is the one new
addition since that claim was first written — added because this phase's own real deliverable (turning a
request into a structured work framework) had no way to reach a developer or an external agent without a real
entrypoint; every other capability in this table already gets one. The Knowledge Layer resolver, the Intent
Model, and governance signal evaluation remain internal engine — reachable programmatically via
`require('juntia')` only through the two functions that actually power `route`
(`classifyTaskIntent`/`routeWorkflow`), never exposed as a command themselves and never exposed at all for
their own internal plumbing (`resolveWorkflowForIntent`, `parseWorkflowMarkdown`, `evaluateGovernanceLevel`).
A separate `juntia
explain` command was evaluated and deliberately not built (`analyze --explain` already covers it) — see
[`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#cli-surface-evaluated-not-assumed) for why. Phase 12K
also evaluated, and rejected, folding the whole cycle into one atomic command — Phase 13A's `setup` is not a
reversal of that: it's a *separate*, clearly-interactive command layered on top, never a change to `analyze`
or any other command's own scriptable behavior. See
[`docs/RUNTIME_INTEGRATION.md`](RUNTIME_INTEGRATION.md#why-this-is-not-the-monolithic-command-phase-12k-rejected)
for the distinction.

## Getting started: `juntia setup`

```
npx juntia setup
```

One command, coordinating everything below. Detects whether the project is initialized, analyzes it, asks an
AI runtime for an interpretation (only if a runtime is already configured, resolved from real
`.juntia/config.yml` state, never guessed — and never on the very first run, so no AI cost is ever spent
without a prior, explicit signal of consent), asks for confirmation before anything becomes a decision,
builds `.juntia/context.md`, asks which AI assistant you use, and configures that integration. Idempotent: running it again reports what's already done (`✓ Already initialized`, `✓ Facts
updated`, `✓ AI assistant already configured: claude-code`, `✓ CLAUDE.md already configured`) instead of
repeating work or duplicating a file, a decision, or a pending item. Never overwrites a real, non-Juntia
`CLAUDE.md` — same protection `integrate` already has, reused directly. A real runtime failure (e.g. Claude
Code isn't installed) is reported in plain language, never as a raw process error.

## The full cycle underneath: analyze → explain → confirm → context → integrate

```
juntia analyze              # facts.json created/updated; conflicts against existing decisions flagged
juntia analyze --explain    # + one AI interpretation, saved to pending.json — nothing decided yet
juntia confirm              # you answer yes/no for each pending item — only this step can create a decision
juntia context               # (implicitly refreshed by confirm too) — the human/agent-readable summary
juntia integrate claude-code # generates CLAUDE.md, pointing your agent at .juntia/context.md
```

Every step before `confirm` is safe to run non-interactively (CI, a script) — `analyze` and `analyze
--explain` never block waiting for input. `confirm` is the only interactive step, and the only one that can
ever write to `.juntia/decisions.json`. `integrate` is safe to run any time after `context` exists (even
with zero decisions confirmed yet) and is always idempotent.

## `integrate`: the context-consumption layer

See [`docs/RUNTIME_INTEGRATION.md`](RUNTIME_INTEGRATION.md#a-real-integration-claude-code-phase-12l) for the
full contract. In short: `juntia integrate claude-code` writes `CLAUDE.md` at the project root — never inside
`.juntia/`, because that's genuinely where Claude Code looks — containing a short pointer to
`.juntia/context.md`, never a copy of its content. The file starts with an invisible marker so a later
`integrate` run can tell "safe to regenerate" apart from "a real file a human already wrote"; if a
non-Juntia-generated file is already there, `integrate` refuses and explains rather than overwriting it.
Never modifies source code, facts, decisions, or `context.md` itself; never calls an AI runtime or sends
anything to an external service.

## What `analyze` does and doesn't do

`analyze` is the Deterministic tier of [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) plus
factual memory (Phase 12I) plus a decision-conflict check (Phase 12K): language/dependency/config/structure
detection, printed to the terminal, persisted to `.juntia/facts.json`, diffed against the previous baseline,
and cross-checked against any confirmed decisions. Without `--explain`, it deliberately does **not**:

- write anything into the *human-facing* `.juntia/` files (`PROJECT_STATE.md`/`ARCHITECTURE.md`/
  `DECISIONS.md` are never touched by plain `analyze` — only `confirm` writes to `DECISIONS.md`);
- call an AI runtime, summarize purpose, or propose architecture components;
- report a project "type," or interpret a change (a dependency removal is reported as exactly that — never
  as "the project got simpler" or any other reading of what it means);
- delete or rewrite a decision — a decision whose cited evidence disappeared is flagged `conflicted`, never
  silently dropped.

`--explain` adds a real AI-runtime interpretation, printed to the console and saved to
`.juntia/pending.json` — see
[`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-interpretation-tier-evaluated-phase-12j). It still
deliberately does **not**:

- create a decision (only `juntia confirm`, answered by a real human, can do that);
- ask a question of its own choosing (`questions` is a structurally forbidden field — see the validator);
- re-queue something that already has an active, confirmed decision for the same evidence (it says so
  instead: "This matches an already-confirmed decision...");
- guess which AI runtime to call (Phase 13B) — an unconfigured or unresolvable `runtime.provider` skips the
  interpretation step with a plain explanation; facts are still scanned and persisted either way.

A file Juntia itself generated (currently just `CLAUDE.md`, via `integrate`/`setup`) is detected and reported
as a real fact, but classified `managed.file`, never `structure.file` (Phase 13B) — a diff reads `Added:
managed.file: CLAUDE.md`, not something implying a human made a new architectural decision. See
[`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md#project-files-vs-juntia-managed-infrastructure-phase-13b).

## Why `update` was scoped narrowly

**`update`** needed a real conflict-resolution rule (what happens when a scaffolded file has since been
edited by a developer) before it could be built at all — `init`'s own "never overwrite" rule is deliberately
too conservative to reuse as-is for updating stale scaffolding, and building a general rule without real
evidence would have repeated the exact "speculative scaffolding" `junt-ia/juntia-research` rejected
independently in every phase since its own Phase 03. (`integrate` faced the same kind of gap until Phase 12L
found real, first-party evidence for one runtime's convention — see `docs/RUNTIME_INTEGRATION.md`.)

Dogfooding then found the first real case: a project still carrying the pre-Phase-15B legacy governance
scheme (flat `.juntia/agent-rules.md`/`.juntia/workflows.md`/`.juntia/roles/*.md`, generated by a since-removed
JS string builder) needed a real way to move onto the current Knowledge Layer (`.juntia/governance/`) without
losing anything hand-edited at either location. `update` is now built, scoped exactly to that one, real,
evidenced migration (`lib/project-intelligence/governance-migration.js` — see the Single Governance Source of
Truth phase). The general "sync any scaffolded file after any future template change" problem this section
originally described has no more real evidence behind it now than it did before — `update` remains that
narrow, not a general engine, until a second real case justifies widening it.
