# Runtime integration boundary

This document defines the boundary between Juntia and any AI coding runtime it integrates with. One real
integration now exists (`juntia integrate claude-code`, Phase 12L), one real orchestrator coordinates it into
onboarding (`juntia setup`, Phase 13A), and — as of Phase 13D — Juntia no longer executes an AI runtime
internally at all: it prepares context (facts, decisions), a handoff (`.juntia/agent-instructions.md`, Phase
13D), and, as of Phase 14A, a governance layer (`.juntia/agent-rules.md`, `.juntia/workflows.md`) for
whichever agent the user already has open. Everything else on this page not explicitly marked **built**
remains design, not implementation.

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
  ├── agent-rules.md             <- how an agent should behave — Juntia's own standing policy (GENERATED, Phase 14A)
  ├── workflows.md               <- recommended sequence per kind of work (GENERATED, Phase 14A)
  ├── agent-instructions.md      <- how to propose a new interpretation, and where (GENERATED, Phase 13D)
  ├── PROJECT_STATE.md
  └── roles/

CLAUDE.md                    <- generated governance INDEX, Claude Code-specific (BUILT, Phase 12L; evolved Phase 14A)
AGENTS.md                    <- generated pointer, Codex-specific (not built — see below)
GEMINI.md                    <- generated pointer, Gemini-specific (not built — see below)
```

`agent-rules.md`/`workflows.md` answer "how should an agent behave here," never "what is this project" —
deliberately not named `rules.md`/`RULES.md`, since `.juntia/RULES.md` already exists as a distinct,
human-authored, project-specific constraints file (see `templates/RULES.md`) that this module never writes to
— different author, different content, different update cadence. See "Agent Governance" below.

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

The generated file is short and content-free by design — as of Phase 14A, a governance INDEX naming every
real file, not a copy of any of them:

```markdown
<!-- juntia:generated -->
# Claude Code instructions

Juntia is configured for this project. The files below are the real, current source of truth —
nothing here is a copy of their content, only where to find it.

- `.juntia/context.md` — what this project is: confirmed facts, technologies, structure.
- `.juntia/DECISIONS.md` — what has already been decided, and why. Confirmed only by a human, via
  `juntia confirm`.
- `.juntia/agent-rules.md` — how to work in a Juntia-governed project: analyze before modifying,
  respect confirmed decisions, ask when something conflicts.
- `.juntia/workflows.md` — the recommended sequence for a new feature or a bug fix.
- `.juntia/agent-instructions.md` — if asked to interpret or analyze this project for Juntia, follow
  this: the expected response format, how to cite evidence, and where to write your proposal
  (`.juntia/pending.json`) so Juntia can validate it and ask a human to confirm it.

Juntia does not control what you do — it defines the environment you work in. You reason within it.

Generated by `juntia integrate claude-code` — safe to delete and regenerate any time. Never
hand-edit it directly: real corrections belong in `.juntia/`, made via `juntia confirm`.
```

`.juntia/RULES.md` is listed too, but only when it actually exists — never claimed if the project never ran
`init`, and never presented as Juntia-authored, since a human is its real author.

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

## Agent Governance (Phase 14A) — memory vs. behavior

Phase 13D gave a connected agent memory: real facts, real confirmed decisions, a real handoff for producing a
new interpretation. None of that guarantees the agent *behaves* consistently with it — analyzing before
modifying, respecting a decision it could technically ignore, asking rather than guessing when a request
conflicts with something already settled. Phase 14A is that second half: `.juntia/agent-rules.md` and
`.juntia/workflows.md` (`lib/project-intelligence/agent-governance.js`), generated alongside the handoff file
by `juntia integrate`/`setup`.

Both are **fixed, deterministic content — the same for every project, no AI involved, no per-project
derivation**. This is deliberate, not a limitation worked around: these are Juntia's own standing rules for
how *any* connected agent should operate in a Juntia-governed project, not a summary of this specific
project's own facts (that's `context.md`) and not a log of what's already been decided (that's
`DECISIONS.md`). "Generated by Juntia, never invented by Claude" only makes sense as a guarantee if the
content really is fixed and Juntia-authored — an AI-derived "rules" file would just be a second, unvalidated
interpretation layer, exactly what Phase 13D retired Juntia *from* being.

`juntia integrate` (and `setup`, which calls it) evolved `CLAUDE.md` from a two-file pointer (`context.md`,
`agent-instructions.md`) into a real governance **index** naming every file this project has — `context.md`,
`DECISIONS.md`, `RULES.md` (if it exists), `agent-rules.md`, `workflows.md`, `agent-instructions.md` — never
copying any of their content into `CLAUDE.md` itself. The philosophy this phase holds to explicitly: **Juntia
does not control what an agent does — it defines the environment the agent works in.** No obedience
guarantee is claimed or attempted; the goal is reduced contradiction and reduced context loss across
sessions, not a correctness guarantee a model's own judgment can still override.

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
bookkeeping line in `config.yml`, and the generated governance files (`agent-instructions.md`,
`agent-rules.md`, `workflows.md`) — all fully regeneratable, none a second source of truth for anything
`.juntia/`'s own real stores already hold.

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

## The provider adapter interface — still real for the INTENT domain, no longer the project-interpretation one

`lib/intent-runtime-bridge.js`'s `interpretIntent(text, { adapter, deterministicOnly, adapterOptions })` — a
genuinely different, narrower, internal domain (routing a free-text request among Juntia's own reasoning
modules, Phase 04/11C) explicitly kept out of scope by both Phase 13C and 13D — still never imports a
concrete provider; it accepts any `adapter` object exposing:

```
adapter.interpret(text, adapterOptions) -> Promise<RuntimeResponse>
```

and is still exported on the public API (`require('@juntia/juntia').interpretIntent`) for a caller to supply
their own adapter. `lib/runtime/claude-cli-adapter.js` — the concrete Claude CLI implementation of this shape
— **no longer exists in this codebase** (deleted Phase 13D, along with the project-interpretation domain's
own use of it); a caller of `interpretIntent()` must supply their own adapter implementation. No CLI command
currently drives `interpretIntent()` directly.

## When Juntia uses AI at all

As of Phase 13D: **never, internally, for any CLI command.** Every command — `init`, `analyze` (with or
without `--explain`), `confirm`, `context`, `integrate`, `setup` — is deterministic and mechanical, with no
subprocess, no API key, no model configuration required to run any of them. `analyze --explain` refreshes a
handoff file instead of calling a runtime; the actual interpretation happens inside whatever AI agent session
the user already has open, on their own dime, outside Juntia's process entirely — see "The AI Handoff" above.

The one place AI still enters this codebase is `lib/intent-runtime-bridge.js`'s `interpretIntent()` — the
intent-classification domain, reachable only programmatically (`require('@juntia/juntia').interpretIntent`),
never from a CLI command, and only ever called with a caller-supplied adapter. `classifyIntent()` alone
resolves the large majority of real requests with zero AI calls (Phase 04's own dataset: 48/48; Phase 11's
full-corpus validation: 143 real texts); the bridge escalates to an adapter only when the deterministic
router is genuinely `AMBIGUOUS`, or a separate, corpus-validated signal flags a specific false-confidence
risk pattern.

## Why `update` still isn't built

No evidence yet dictates the right conflict-resolution rule for updating a scaffolded file a developer has
since edited — `init`'s own "never overwrite" rule is deliberately too conservative to reuse as-is. Unlike
`integrate`, which found real evidence for one runtime's convention this phase, `update` has no equivalent
evidence yet. Building it now would repeat the exact "speculative scaffolding" `junt-ia/juntia-research`
rejected independently in every phase since its own Phase 03.
