# Runtime integration boundary

This document defines the boundary between Juntia and any AI coding runtime it integrates with. One real
integration now exists (`juntia integrate claude-code`, Phase 12L), one real orchestrator coordinates it into
onboarding (`juntia setup`, Phase 13A), and — as of Phase 13D — Juntia no longer executes an AI runtime
internally at all: it prepares context (facts, decisions), a handoff (`.juntia/agent-instructions.md`, Phase
13D), and a Knowledge Layer (`.juntia/governance/` — rules, workflows, roles, skills; Phase 14A's
`agent-rules.md`/`workflows.md` moved here and became static declarative files in Phase 15B) for whichever
agent the user already has open. Everything else on this page not explicitly marked **built** remains design,
not implementation.

## Source of truth

`.juntia/` (created by `juntia init`) is the single source of truth for a project's context, decisions,
rules, and role responsibilities, regardless of which runtime a developer is using. As of Phase 12K,
`.juntia/context.md` is the specific, real file that matters most here: a mechanical assembly of confirmed
facts and confirmed decisions, safe for any external reader.

## How Juntia should stop being the only thing that reads its own context

Phase 12L's own central question. Three consumption tiers were evaluated, not assumed:

1. **Manual** — a developer copies `.juntia/context.md` into a chat. Zero setup, works today, requires no
   code at all — but requires the developer to remember to do it every session.
2. **A pointer file at a conventional path** — a short file the runtime already reads on its own (e.g.
   `CLAUDE.md`) that tells it where the real context lives. **This is what `juntia integrate` builds.**
   Minimal, agnostic of what's inside `.juntia/context.md`, and works the moment the runtime starts a
   session — no manual copy-paste needed.
3. **Deep, native integration** (an IDE extension, a hook that injects context automatically, a
   runtime-specific plugin) — explicitly out of scope this phase, and every phase before it. No evidence yet
   for what any of these should look like.

Tier 2 is the minimum viable version of "an agent doesn't start from zero" — it was chosen because it's the
smallest real step that removes the manual-copy burden without guessing at a deep-integration format nothing
has validated yet.

## What an integration does

An integration reads from `.juntia/` and generates a runtime-specific adaptation of it — never the other way
around:

```
.juntia/                        <- source of truth, runtime-agnostic
  ├── context.md                <- what this project is: confirmed facts + confirmed decisions (Phase 12K)
  ├── DECISIONS.md               <- what's been decided, and why (human-facing narrative; appended to by `confirm`)
  ├── RULES.md                   <- this project's OWN constraints, human-authored (Phase 00-era scaffold, never auto-written)
  ├── agent-instructions.md      <- how to propose a new interpretation, and where (GENERATED, Phase 13D)
  ├── PROJECT_STATE.md
  └── governance/                <- the Knowledge Layer (SCAFFOLDED once, Phase 15B — see "The Knowledge Layer" below)
        ├── rules/agent-rules.md      <- how an agent should behave — Juntia's own standing policy
        ├── workflows/*.md             <- recommended process per kind of work (feature-development, bug-fix, investigation, refactor)
        ├── roles/*.md                  <- the perspective to reason from (product, architect, engineer, qa)
        └── skills/*/SKILL.md            <- specialized procedures (feature-planning, architecture-review, implementation, testing-strategy)

CLAUDE.md                    <- generated governance INDEX, Claude Code-specific (BUILT, Phase 12L; evolved Phase 14A/15B)
AGENTS.md                    <- generated pointer, Codex-specific (not built — see below)
GEMINI.md                    <- generated pointer, Gemini-specific (not built — see below)
```

`.juntia/governance/` answers "how should an agent behave here," never "what is this project" — its `rules/`
subdirectory is deliberately not named `rules.md`/`RULES.md` at the top level, since `.juntia/RULES.md`
already exists as a distinct, human-authored, project-specific constraints file (see `templates/RULES.md`)
that nothing under `governance/` ever writes to — different author, different content, different update
cadence. See "The Knowledge Layer" below.

A generated adaptation is a small **pointer**, not a copy — it tells the runtime where to look, it never
duplicates `context.md`'s own content. It is disposable and regeneratable: editing a generated file directly
is a dead end (the next `juntia integrate` run regenerates it); real edits belong in `.juntia/`, made through
`juntia confirm`.

## A real integration: Claude Code (Phase 12L)

`juntia integrate claude-code` generates `CLAUDE.md` at the **project root** — not inside `.claude/`, and not
inside `.juntia/`, because that is genuinely where Claude Code looks for it. This wasn't guessed: this
migration's own real validation data already contained two real, independent, human-authored `CLAUDE.md`
files at project roots (`app-podcaster`'s and `restaurant-game`'s, both found during Phase 12I/12J/12K's own
real-project validation) — first-party evidence, not documentation lookup, for exactly the convention this
phase needed.

The generated file is short and content-free by design. Through Phase 14A/15B it grew into a full governance
INDEX, naming every real file directly — real, but exactly what Phase 15D's own brief says an entry point must
never be ("no debe decir 'lee todos estos archivos siempre'"). Phase 15D shrinks it back to a real bootstrap
*trigger*, moving the index one level deeper into `.juntia/BOOTSTRAP.md` (see "The Workflow Routing Engine"
below):

```markdown
<!-- juntia:generated -->
# Claude Code instructions

This project uses Juntia Governance — a deterministic layer that classifies work and points you at
the right process, context, roles, and skills. It never reasons for you and never implements anything.

Load `.juntia/BOOTSTRAP.md` before acting on any request in this project. It explains what to read for
a first session, how to get the workflow/roles/skills that actually apply to a specific request
(`juntia route`), and where everything else lives — you should not need to read the whole Knowledge
Layer up front.

Generated by `juntia integrate claude-code` — safe to delete and regenerate any time. Never
hand-edit it directly: real corrections belong in `.juntia/`, made via `juntia confirm`.
```

Real, checkable properties of this new shape: the content is now identical for every project (it no longer
varies by whether `.juntia/RULES.md` exists — that awareness moved to `BOOTSTRAP.md`), and no individual
governance file (`context.md`, `DECISIONS.md`, `agent-rules.md`, `agent-instructions.md`, ...) is named here
at all — verified directly by test (`test/agent-integration.test.js`), not just described in prose.

The leading HTML comment is a real, checkable marker — not a convention taken on faith. `integrate` refuses
to overwrite a `CLAUDE.md` that doesn't start with it, printing why instead of guessing. This was validated
against real, private, in-use files, not a synthetic case: both `app-podcaster` and `restaurant-game` already
had their own real, human-authored `CLAUDE.md` (pointing at an unrelated internal toolkit's own guidelines
file) when this phase ran `integrate` against them for real — in both cases, the real file was correctly
left untouched, and `integrate` explained exactly why instead of clobbering it.

`juntia integrate` also records the integration in `.juntia/config.yml`'s `integrations:` list (mechanical
text editing, not a YAML library — see `lib/project-intelligence/agent-integration.js`), idempotently: running
it twice for the same runtime never duplicates the entry or rewrites an unchanged `CLAUDE.md` differently.

**Codex, Gemini, and Cursor are architecturally supported but not built** — adding a real profile is one new
entry in `agent-integration.js`'s `RUNTIME_PROFILES` map (`{ file, label }`), nothing else changes. Each was
left undocumented-as-built specifically because this phase had no equivalent first-party evidence for their
own conventions the way it did for Claude Code's — building one from general knowledge instead of real,
observed usage would be exactly the kind of unevidenced guess this migration has avoided since Phase 03.

## The Knowledge Layer (Phase 14A → Phase 15B) — memory, behavior, and where it lives

Phase 13D gave a connected agent memory: real facts, real confirmed decisions, a real handoff for producing a
new interpretation. None of that guarantees the agent *behaves* consistently with it — analyzing before
modifying, respecting a decision it could technically ignore, asking rather than guessing when a request
conflicts with something already settled. Phase 14A built that second half as two generated files
(`.juntia/agent-rules.md`, `.juntia/workflows.md`); Phase 15B moved that same responsibility into
`.juntia/governance/` — a real, declarative directory (`rules/`, `workflows/`, `roles/`, `skills/`,
`conventions/`) instead of individual generated files, per Phase 15A's own audit finding that this content
was Knowledge Layer material trapped in JS string builders (`lib/project-intelligence/agent-governance.js`,
removed this phase).

Every file under `governance/` is now **scaffolded once by `juntia init`** (directly, or via
`integrate`/`setup`, which call it), copied verbatim from `templates/governance/`, using the exact same
never-overwrite mechanism every other scaffold file (`RULES.md`, `roles/*.md` before this phase) already had
— not generated fresh from a JS template-literal builder on every `integrate` call, the way
`agent-rules.md`/`workflows.md` used to be. **This is a real, deliberate trade-off, not an oversight**: the
old model guaranteed every project always had Juntia's current, canonical rules (regenerated every run); the
new model means a project's own copy is genuinely theirs to edit once scaffolded, and won't reflect a future
Juntia version's changes to the default content unless the project re-scaffolds by hand. The brief's own
framing — "artefactos declarativos versionables" — treats this as the correct trade-off: a Knowledge Layer
file is meant to be a project's own, adaptable artifact, not a value Juntia continuously re-asserts.

Four workflows are scaffolded (`feature-development.md`, `bug-fix.md`, `investigation.md`, `refactor.md`),
each naming its own goal, when to use it, the roles and skills involved, expected outputs, and a recommended
governance level (LIGHT/STANDARD/STRICT, per Phase 15A's own conceptual definition) — process, never a
solution. Four skills are scaffolded (`feature-planning`, `architecture-review`, `implementation`,
`testing-strategy`, one per role), each a `SKILL.md` with YAML frontmatter (`name`, `description`, `role`,
`when_to_use`, `inputs`, `process`, `expected_output`, `constraints`) plus a short prose explanation — no
skill engine reads or executes this format; it's read directly by whichever agent is doing the work. Roles
(`product.md`, `architect.md`, `engineer.md`, `qa.md`) are the same Phase 00-era content, moved (not
rewritten) from `.juntia/roles/` to `.juntia/governance/roles/`. `conventions/` is scaffolded with a contract
explanation only (`README.md`) — no real convention content existed anywhere to migrate.

`juntia integrate` (and `setup`, which calls it) evolved `CLAUDE.md` from a two-file pointer (`context.md`,
`agent-instructions.md`) into a real governance **index** naming every file this project has — `context.md`,
`DECISIONS.md`, `RULES.md` (if it exists), `.juntia/governance/` (with its own sub-bullets for rules/
workflows/roles/skills), `agent-instructions.md` — never copying any of their content into `CLAUDE.md` itself.
**Superseded by Phase 15D**: that index now lives in `.juntia/BOOTSTRAP.md` instead, and `CLAUDE.md` shrank
back to a single real trigger pointing at it — see "The Agent Consumption Model (Phase 15D)" below for why an
entry point that names everything directly turned out to be the wrong shape, and what replaced it. The
philosophy this phase holds to explicitly: **Juntia does not control what an agent does — it defines the
environment the agent works in.** No obedience guarantee is claimed or attempted; the goal is reduced
contradiction and reduced context loss across sessions, not a correctness guarantee a model's own judgment can
still override.

**Compatibility, not destructive migration**: a project that scaffolded `.juntia/roles/*.md`,
`.juntia/agent-rules.md`, or `.juntia/workflows.md` under the old (pre-15B) scheme keeps them exactly as they
are — nothing in this codebase deletes, moves, or rewrites them. Re-running `init`/`integrate`/`setup` on such
a project scaffolds the new `.juntia/governance/` tree alongside the old files (never instead of them,
because `init` only ever creates a file that doesn't already exist at its own path); `CLAUDE.md`'s regenerated
index stops referencing the old paths, since the new ones are now the real source of truth. A developer who
wants to fully retire the old files can review and remove them by hand; automating that removal was
considered and rejected (see `phases/15b-knowledge-layer.md`) — deleting a file that might have been
hand-edited without knowing so would be a real, avoidable data-loss risk.

## The Workflow Routing Engine (Phase 15C) — connecting Core to the Knowledge Layer

Phase 15B built the Knowledge Layer as real, declarative files — but nothing in the codebase yet turned a
developer's actual request into a real read of that content; a project's `.juntia/governance/workflows/*.md`
existed for an agent to happen to open, not for Juntia to route toward. Phase 15C closes that gap with
`juntia route "<request>"`, built from three small, composed modules under `lib/governance/`:

- `intent-model.js` — `classifyTaskIntent(text)`. A four-intent classifier (`feature`/`bug`/`investigation`/
  `refactor`, mapped 1:1 to the four real workflow files Phase 15B shipped), numeric `[0, 1]` confidence
  instead of a string label, and `unknown` — with `needsClarification: true` — whenever there isn't enough
  signal, the top two candidates tie, or confidence falls below a threshold. Deliberately not an extension of
  the legacy `lib/intent-router.js`'s nine-intent taxonomy (module since deleted — see
  `phases/governance-level-dynamic-and-legacy-cleanup.md`).
- `workflow-knowledge.js` — `resolveWorkflowForIntent(projectRoot, intent)`. Reads the real
  `.juntia/governance/workflows/<file>.md` for a classified intent and parses its already-existing
  `## Roles involved` / `## Skills recommended` / `## Recommended governance level` sections — the same
  structure `test/knowledge-layer.test.js` already required every workflow file to have since Phase 15B. No
  template file was changed to make this parseable; it already was. The only thing hardcoded in JS is the
  intent → filename correspondence (`INTENT_WORKFLOW_FILE`), never a workflow's roles/skills/governance level.
- `workflow-router.js` — `routeWorkflow(text, projectRoot)`. Composes the two above into the real contract:
  `{ intent, confidence, workflow, governanceLevel, roles, skills, needsClarification, reason }`. Never invents
  a workflow: an `unknown` intent, or a real intent whose Knowledge Layer file can't be resolved (project never
  ran `init`, or a hand-edited file this parser can't read), both return `workflow: null` and
  `needsClarification: true`.
- `governance-levels.js` — a small, extensible LIGHT/STANDARD/STRICT registry (label, description, examples,
  `mayRequireRoles`, `humanConfirmationRequired`). Not a risk classifier — a request's BASE level is always
  read from its resolved workflow file, never computed here. Per this phase's own explicit restriction: "no
  crear todavía una clasificación perfecta de riesgo." (The Governance Level Dynamic and Legacy Cleanup phase
  later added `governance-signals.js` alongside this registry — see that phase's own doc — to let a request's
  FINAL level move away from that base via declared, deterministic signals; this registry itself, and what
  each level means, is unchanged.)

`juntia route` prints the JSON result and, only when a real workflow was resolved, writes
`.juntia/task-handoff.md` (`lib/governance/task-handoff.js`) — a second, distinct handoff alongside
`agent-instructions.md` (Phase 13D): that file answers "what is this project," this one answers "what should I
do with *this* request" (task type, workflow, governance level, suggested roles/skills, then pointers — never
copies — to `.juntia/governance/workflows/<workflow>.md`, the relevant role/skill files, and `context.md`/
`DECISIONS.md`). Same "pointer, not a copy" discipline as every other generated file in this codebase.

**What this still doesn't do**, per the phase's own explicit restrictions: no role is automatically invoked, no
skill is executed, no workflow runs anything — `route` only *names* the process; an external agent still reads
`.juntia/governance/` and `task-handoff.md` and decides, reasons, and implements entirely on its own. At the
time this phase shipped, the legacy free-text reasoning modules (`lib/intent-router.js`, `product-reasoning.js`,
`architecture-reasoning.js`, `engineering-reasoning.js`, `intent-runtime-bridge.js`) remained exactly as
unwired as Phase 15A/15B had left them — this phase built a real, smaller, differently-scoped classifier
rather than extending or retiring them. They were fully removed later, in the Governance Level Dynamic and
Legacy Cleanup phase — see `phases/governance-level-dynamic-and-legacy-cleanup.md` — once this classifier and
its own Knowledge Layer routing had real evidence behind them as the sole architecture.

## The Agent Consumption Model (Phase 15D) — Juntia Bootstrap, Agent Context, and a real Claude Code contract

Phase 15C connected Juntia Core to the Knowledge Layer; nothing yet defined *how an external agent consumes*
that connection without a human explaining the whole architecture manually, every session. Phase 15D closes
that gap with three additions, none of them a new reasoning capability — all of them presentation and
discovery over what Phase 15C already computes.

**`.juntia/BOOTSTRAP.md` (new, `lib/governance/bootstrap.js`)** — the real navigation index that used to live
directly inside `CLAUDE.md`. Explains, in order: what Juntia is (one paragraph, the same "classifies, never
reasons or implements" boundary every generated file in this codebase states); what to read once per session
for a first-time orientation (`context.md`, `PROJECT_STATE.md`, `DECISIONS.md`, and `RULES.md` only when it
exists); how to get the workflow/roles/skills for a *specific* request (`juntia route`, never "read everything
up front"); and a short, final pointer list to the Knowledge Layer's own subdirectories and
`agent-instructions.md`. Regenerated on every `integrate`/`route` call — the same "always current, never
hand-edited" policy `agent-instructions.md`/`CLAUDE.md` already had, not the Knowledge Layer's own
"scaffold once" one, since this file only ever describes real, current filesystem state (does `RULES.md`
exist, does a task handoff already exist), never a project's own opinion. `CLAUDE.md` itself shrank to a
single real trigger pointing here — see "A real integration: Claude Code" above for its exact new shape.

**Agent Context (new, `lib/governance/agent-context.js`)** — a pure, additive reshaping of `routeWorkflow()`'s
flat Phase 15C result into the brief's own exact nested contract:

```json
{
  "task": { "intent": "feature", "confidence": 0.9, "needsClarification": false, "reason": "..." },
  "workflow": { "name": "feature-development", "governanceLevel": "standard" },
  "roles": ["product", "architect", "engineer", "qa"],
  "skills": ["feature-planning", "architecture-review", "implementation", "testing-strategy"],
  "contextSources": [".juntia/context.md", ".juntia/governance/workflows/feature-development.md"]
}
```

`contextSources` is deliberately minimal — `context.md` always, plus the resolved workflow's own file when one
was resolved — never an exhaustive index of every role/skill file (an agent already has those from `roles`/
`skills` plus the Knowledge Layer's own well-known directory convention). This is the object `juntia route`
now prints to the console (Phase 15C printed `routeWorkflow()`'s flat shape directly; the flat shape is
unchanged as `route`'s programmatic return value, only the console/task-handoff presentation changed), and the
same object is embedded as a fenced JSON block inside `.juntia/task-handoff.md`'s own new "## Agent Context"
section — real navigation, machine-parseable, never a solution.

**Claude Code as the first, real consumer, `.juntia/` as the only source of truth** — checked directly, not
just asserted: nothing in `agent-integration.js`, `bootstrap.js`, or `task-handoff.js` ever reads from a
`.claude/` directory or any Claude-Code-specific state; every one of those modules only ever reads real
`.juntia/` files (or their own existence) and writes a runtime-specific *adapter* file (`CLAUDE.md` at the
project root, which is Claude Code's own root-level convention, not part of its `.claude/` settings
directory). No `.claude/`-directory generation was built this phase — the same "no first-party evidence yet
for this convention" discipline Phase 12L already applied to Codex/Gemini/Cursor; if a real, evidenced need for
Claude-Code-specific adapter content under `.claude/` appears later, it would be generated *from* `.juntia/`
state, never the reverse, and `.juntia/` would remain readable and complete on its own regardless.

**What this phase did not build**, per its own explicit restrictions: no automatic role invocation, no skill
execution, no automatic role switching, no Claude plugin integration, no Codex/Cursor integration, no learning
mechanism, no automatic modification of governance content. `juntia route` was kept (not removed) as a real,
advanced debugging command — the primary experience (`setup` → an agent opening `CLAUDE.md` → `BOOTSTRAP.md`
→, if needed, that agent itself running `route`) does not require a developer to type it manually. See
`phases/15d-agent-consumption-model.md` for the full account.

## The Setup Orchestrator (Phase 13A)

Phase 13A's own central question: can Juntia prepare a whole project for AI-assisted work through one
command, hiding facts/interpretations/decisions/integrations as internal concepts the user never has to
learn? `juntia setup` is that command — and structurally, it is *only* a coordinator: it introduces no new
scanning, persistence, interpretation, confirmation, or file-generation logic of its own. Every real
operation is the exact same function `analyze`/`confirm`/`context`/`integrate` already call
(`scanProject()`, `saveFacts()`, `synthesizeContext()`, `recordDecision()`, `generateContext()`,
`integrateRuntime()`, ...) — `runSetup()` in `bin/juntia.js` only sequences them and owns its own, shorter,
onboarding-appropriate console output. `runIntegrate()` itself gained one small, backward-compatible
addition (`{ silent: true }`) specifically so `setup` could reuse it byte-for-byte instead of re-printing or
re-implementing its safety checks.

The real sequencing decision worth naming: **AI interpretation only runs if a runtime was already configured
by a *previous* `setup`/`integrate` run** — never on a project's first-ever `setup`. On a first run, the
assistant question (step 8 of the brief's own numbered flow) comes *after* the point where interpretation
would happen (step 5) — so the very first `setup` on a new project never spends anything or calls an AI
runtime the user hasn't even confirmed they use yet. The second run (and every one after) has a known,
configured runtime, so the interpret → confirm cycle runs for real. This was real, live-validated behavior,
not just designed: a real project run twice showed exactly this — silence on run one, a genuine AI
interpretation and confirmation prompt on run two.

Idempotency is inherited, not reimplemented: every step `setup` calls was already safe to re-run before this
phase existed (`init`'s "never overwrite," `saveFacts`'s baseline-or-diff behavior, `integrateRuntime`'s
generated-file marker check, `recordDecision`'s per-id upsert). `setup` adds exactly one new idempotency
concern of its own — skipping the assistant question entirely once `runtime.provider` is already set,
reporting `✓ AI assistant already configured: claude-code` instead of asking again.

## Why this is not the monolithic command Phase 12K rejected

Phase 12K's own `docs/CONTEXT_SYNTHESIS.md` evaluated, and rejected, folding `analyze` → `confirm` →
`context` into one atomic command — reasoning that it "would force an interactive confirmation prompt (or a
silent AI call) inside what might be a scripted/CI `analyze` invocation." `juntia setup` does not reverse
that conclusion; it satisfies the same concern a different way. `analyze` (and `analyze --explain`,
`confirm`, `context`, `integrate`) are **completely unchanged** — still exactly as scriptable, non-interactive
(where they always were), and safe to run in CI as before. `setup` is a new, separate, unambiguously
interactive command a script would simply never invoke by accident — nothing about any existing command's
own contract changed to make this possible. The distinction that matters: Phase 12K rejected making one of
the *existing* commands secretly do more; Phase 13A added a *new*, honestly-named command that does what its
name says.

## What Juntia never delegates to a runtime

Per [`docs/VISION.md`](VISION.md)'s governance/interpretation split: a runtime is never handed the authority
to authorize a change, skip validation, or modify `.juntia/`'s own state automatically. It interprets and
generates; Juntia's own logic decides what happens with the result. `integrate` itself never calls a runtime,
never sends anything to an external service, and never modifies project source code, `.juntia/facts.json`,
`.juntia/decisions.json`, `.juntia/pending.json`, or `.juntia/context.md` — it only ever reads `context.md`
(to confirm it exists before generating a pointer to it) and writes the runtime pointer file, its own
bookkeeping line in `config.yml`, the generated handoff file (`agent-instructions.md` — fully regeneratable,
no second source of truth), and — via `init`, only if not already present — the `.juntia/governance/`
Knowledge Layer tree, scaffolded once from static templates and never a second source of truth for anything
`.juntia/`'s own real stores already hold, but (unlike `agent-instructions.md`) not regenerated on every run
once it exists — see "The Knowledge Layer" above for why.

## Two separate configuration concerns — do not conflate them

`.juntia/config.yml` carries two independent blocks, deliberately never merged into one:

```yaml
runtime:
  provider: null   # which assistant the user said they use. WRITTEN by `setup` (13A); READ by `analyze --explain` (13B).
  model: null

integrations: []   # which runtimes have a generated context pointer (Phase 12L). REAL, read/written by `integrate`/`setup`.
```

`runtime:` is about *which AI answers a question Juntia asks*. `juntia setup` writes a real value here (the
assistant the user said they use) — and as of Phase 13B, `analyze --explain` (and `setup`'s own explain step)
reads it back for real, to select the actual adapter for that project-interpretation call (see "Runtime
resolution" below). `integrations:` is about *which external tools Juntia hands context to, unprompted*
(built Phase 12L, also written by `setup`). The two fields stay structurally independent — writing or reading
one never implies or requires the other.

## Runtime resolution for project interpretation — built (Phase 13B), then retired (Phase 13D)

Phase 13B built real `runtime.provider` → adapter resolution for `analyze --explain`/`setup`
(`lib/runtime/provider-registry.js`, `bin/juntia.js`'s `resolveConfiguredAdapter()`). Phase 13C then found,
via a real dogfooding failure (`spawn("claude") ENOENT`) and a concrete piece of environmental evidence (a
real Claude Code user's `claude` binary is often not reachable by subprocess at all — VS Code
extension/desktop app users especially), that resolving to an internally-*executed* adapter was the wrong
mechanism, not just missing a detection check. Phase 13D deleted `provider-registry.js` and
`lib/runtime/claude-cli-adapter.js` outright, along with `resolveConfiguredAdapter()`/
`formatRuntimeFailure()`/`formatUnresolvedRuntime()`. Nothing in the current codebase resolves
`runtime.provider` to an executable adapter anymore — see "What Juntia never delegates to a runtime" and
"When Juntia uses AI at all" below, both rewritten for this.

`runtime.provider`'s own *storage* is unaffected — `setup`/`integrate` still read/write it in
`.juntia/config.yml`, to select which pointer-file convention (`RUNTIME_PROFILES`) to generate. Only its
*meaning* changed: from "the model Juntia executes" to "the assistant Juntia prepares an environment for."

## The AI Handoff (Phase 13D) — how an interpretation gets produced now

`.juntia/agent-instructions.md` (`lib/project-intelligence/agent-handoff.js`) replaces the retired mechanism
above. Generated by `analyze --explain`/`setup`/`integrate`, deterministic, no AI involved in generating it:
the same FACTS/CHANGES/EXISTING CONTEXT rendering (`context-synthesis-bridge.js`'s `buildRequestText`,
unchanged since Phase 12J) and the same rules (`project-interpretation-guideline.js`'s `SYSTEM_PROMPT`,
unchanged since Phase 12J) that used to be sent to an internally-spawned adapter, now read directly by
whichever agent the user has open. The agent proposes an interpretation by writing to
`.juntia/pending.json`; `juntia confirm` validates it (`project-interpretation-validator.js`'s
`validateProjectInterpretation` — the same anti-hallucination check, unmodified, now run against every
pending item regardless of who wrote it) before a human is ever asked to confirm or reject it.

## The provider adapter interface — retired

`lib/intent-runtime-bridge.js`'s `interpretIntent(text, { adapter, deterministicOnly, adapterOptions })` — the
one remaining internal path that called an AI model *from inside Juntia* (routing a free-text request through
`lib/intent-router.js`'s own reasoning modules, Phase 04/11C) — was deleted in the Governance Level Dynamic
and Legacy Cleanup phase, along with the rest of the legacy reasoning layer it belonged to (see
[`../phases/governance-level-dynamic-and-legacy-cleanup.md`](../phases/governance-level-dynamic-and-legacy-cleanup.md)).
`lib/runtime/claude-cli-adapter.js`, the concrete Claude CLI implementation of the same adapter shape, had
already been deleted earlier (Phase 13D). No adapter interface remains anywhere in this codebase.

## When Juntia uses AI at all

**Never, anywhere, for any CLI command or any exported function.** Every command — `init`, `analyze` (with or
without `--explain`), `confirm`, `context`, `integrate`, `route`, `setup` — is deterministic and mechanical,
with no subprocess, no API key, no model configuration required to run any of them. `analyze --explain`
refreshes a handoff file instead of calling a runtime; the actual interpretation happens inside whatever AI
agent session the user already has open, on their own dime, outside Juntia's process entirely — see "The AI
Handoff" above. This was already true for every CLI command since Phase 13D; the Governance Level Dynamic and
Legacy Cleanup phase closed the one remaining programmatic exception (`interpretIntent()`, above), so it is
now true of the entire public API, not just the commands.

## Why `update` still isn't built

No evidence yet dictates the right conflict-resolution rule for updating a scaffolded file a developer has
since edited — `init`'s own "never overwrite" rule is deliberately too conservative to reuse as-is. Unlike
`integrate`, which found real evidence for one runtime's convention this phase, `update` has no equivalent
evidence yet. Building it now would repeat the exact "speculative scaffolding" `junt-ia/juntia-research`
rejected independently in every phase since its own Phase 03.
