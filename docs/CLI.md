# Public CLI

This is the complete public surface. Anything not listed here (intent routing, product/architecture/
engineering reasoning, validation, the runtime bridge, provider adapters) is internal engine — a developer
using Juntia should never need to invoke one of those directly. See
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#public-api-vs-internal-engine) for why that boundary matters.

| Command | Responsibility | Status | Consumes AI? |
|---|---|---|---|
| `juntia init` | Create a project-local `.juntia/` context directory (config, state, decisions, rules, architecture, roles). | **Built** | Never — pure, deterministic filesystem scaffolding. |
| `juntia analyze` | Print a deterministic inventory of an existing project — languages, declared dependencies, recognized config files, top-level structure, each traceable to real evidence — and persist it as a factual baseline (`.juntia/facts.json`), reporting Added/Removed/Changed against the previous baseline on every run after the first. Also checks any confirmed decisions against the fresh facts and flags (never deletes) ones whose evidence is now missing. See [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) for the full knowledge model. | **Built — inventory + factual memory + conflict check** | Never. Deterministic tier only. |
| `juntia analyze --explain` | Same scan/persist/diff/conflict-check as plain `analyze`, plus one AI-runtime interpretation of the real facts — printed to the console and saved as a pending item in `.juntia/pending.json`, never as a fact or a decision. See [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-interpretation-tier-evaluated-phase-12j) for the contract. | **Built** | Yes, opt-in only. Plain `analyze` (no flag) never does this. |
| `juntia confirm` | Walks through every pending interpretation and asks a real yes/no question. Yes writes a real decision (`.juntia/decisions.json` + a plain-English line appended to `.juntia/DECISIONS.md`) and refreshes `.juntia/context.md`; no discards it. Never runs without a human present to answer. See [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-decision-tier-built-phase-12k) for the full contract. | **Built** (Phase 12K) | No — asks a human, never the runtime. |
| `juntia context` | Rebuilds and prints `.juntia/context.md` from confirmed facts and confirmed decisions only — safe to run any time, including with nothing confirmed yet. | **Built** (Phase 12K) | Never — purely mechanical assembly of already-confirmed data. |
| `juntia update` | Update Juntia's own scaffolded files in a project without destroying real project content the developer has since edited. | **Designed, not built** | Never — same class of operation as `init`, mechanical file sync. |
| `juntia integrate <runtime>` | Generate a small, runtime-specific pointer file (e.g. `CLAUDE.md` for `claude-code`) at the path that runtime already reads on its own, so it finds `.juntia/context.md` without being told. Records the integration in `.juntia/config.yml`. | **Built** (Phase 12L) — `claude-code` only; others documented, not implemented | Never — no AI call, nothing sent anywhere; pure, deterministic file generation. |

No command beyond these six exists or is planned without new evidence. In particular: no command exposes
`classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/`analyzeEngineering`/`interpretIntent` directly —
those are the internal engine's own functions, reachable programmatically via `require('juntia')` for a
caller that genuinely needs them, not meant to be typed by a developer at a terminal. A separate `juntia
explain` command and a monolithic `juntia update` that runs the whole cycle in one step were both evaluated
and deliberately not built — see
[`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#cli-surface-evaluated-not-assumed) for why.

## The full cycle: analyze → explain → confirm → context → integrate

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
  instead: "This matches an already-confirmed decision...").

## Why `update` isn't built yet

**`update`** needs a real conflict-resolution rule (what happens when a scaffolded file has since been
edited by a developer) — `init`'s own "never overwrite" rule is deliberately too conservative to reuse as-is
for updating stale scaffolding. No evidence yet dictates the right rule, so it isn't built — building it now
would repeat the exact "speculative scaffolding" `junt-ia/juntia-research` rejected independently in every
phase since its own Phase 03. (`integrate` faced the same kind of gap until Phase 12L found real,
first-party evidence for one runtime's convention — see `docs/RUNTIME_INTEGRATION.md`.)
