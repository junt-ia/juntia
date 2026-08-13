# Public CLI

This is the complete public surface. Anything not listed here (intent routing, product/architecture/
engineering reasoning, validation, the runtime bridge, provider adapters) is internal engine — a developer
using Juntia should never need to invoke one of those directly. See
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#public-api-vs-internal-engine) for why that boundary matters.

| Command | Responsibility | Status | Consumes AI? |
|---|---|---|---|
| `juntia init` | Create a project-local `.juntia/` context directory (config, state, decisions, rules, architecture, roles). | **Built** | Never — pure, deterministic filesystem scaffolding. |
| `juntia analyze` | Print a deterministic inventory of an existing project — languages, declared dependencies, recognized config files, top-level structure, each traceable to real evidence — and persist it as a factual baseline (`.juntia/facts.json`), reporting Added/Removed/Changed against the previous baseline on every run after the first. See [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) for the full knowledge model. | **Built — inventory + factual memory** | Never. Still the Deterministic tier only; it persists and diffs facts, never interprets what a change means (no project "type" is ever reported). |
| `juntia analyze --explain` | Same scan/persist/diff as plain `analyze`, plus one AI-runtime interpretation of the real facts, printed to the console only — never written to a file, never treated as a fact or a decision. See [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-interpretation-tier-evaluated-phase-12j) for the full contract. | **Built — evaluation stage** (Phase 12J) | Yes, opt-in only. Plain `analyze` (no flag) never does this. |
| `juntia update` | Update Juntia's own scaffolded files in a project without destroying real project content the developer has since edited. | **Designed, not built** | Never — same class of operation as `init`, mechanical file sync. |
| `juntia integrate <runtime>` | Connect a specific AI coding runtime (Claude Code, Codex, Gemini, ...) — configure it and generate its runtime-specific adaptation of `.juntia/`. | **Designed, not built** | Never for the mechanical file-generation part; the runtime itself does no interpretation as part of being integrated. |

No command beyond these four exists or is planned without new evidence. In particular: no command exposes
`classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/`analyzeEngineering`/`interpretIntent` directly —
those are the internal engine's own functions, reachable programmatically via `require('juntia')` for a
caller that genuinely needs them (e.g. a runtime integration built later), not meant to be typed by a
developer at a terminal.

## What `analyze` does and doesn't do yet

`analyze` today is the Deterministic tier of [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) plus
factual memory (Phase 12I): language/dependency/config/structure detection, printed to the terminal, and
persisted to `.juntia/facts.json` (git-ignored by default via a scoped `.juntia/.gitignore` this command
also creates). First run creates the baseline; every run after that compares against it and reports
Added/Removed/Changed, then updates the baseline. Without `--explain`, it deliberately does **not**:

- write anything into the *human-facing* `.juntia/` files (no `PROJECT_STATE.md`/`ARCHITECTURE.md`
  seeding — `facts.json` is a separate, machine-only file, per
  [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md)'s FACT/INTERPRETATION/DECISION tiering);
- call an AI runtime, summarize purpose, or propose architecture components;
- report a project "type," or interpret a change (a dependency removal is reported as exactly that — never
  as "the project got simpler" or any other reading of what it means).

`--explain` (Phase 12J) adds a real AI-runtime interpretation of those same facts, printed to the console
only — see [`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md#the-interpretation-tier-evaluated-phase-12j).
It still deliberately does **not**:

- persist the interpretation anywhere (no `.juntia/pending.json` — evaluated, not built this phase);
- surface it as a question, an unknown to resolve, or anything requiring a response;
- feed it back into a future `analyze` run's `EXISTING CONTEXT` (there is currently nothing to feed back);
- run automatically — plain `analyze` never spends anything or calls out to a runtime.

A noise threshold for what's worth surfacing and a real confirmation UX (for whenever persistence is
eventually built) still don't exist. See `phases/12e-deterministic-project-intelligence.md`,
`phases/12h-project-context-synthesis-design.md`, `phases/12i-project-facts-persistence.md`, and
`phases/12j-context-synthesis-runtime-evaluation.md` in the research repo for the full history.

## Why `update`/`integrate` aren't built yet

- **`update`** needs a real conflict-resolution rule (what happens when a scaffolded file has since been
  edited by a developer) — `init`'s own "never overwrite" rule is deliberately too conservative to reuse
  as-is for updating stale scaffolding.
- **`integrate`** needs at least one real runtime-adaptation format actually worked out end-to-end (what
  exactly goes in a generated `.claude/CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`, and how it stays
  regeneratable without clobbering real edits) — nothing in this repository has attempted that yet.

Building either now, without that evidence, would repeat the exact "speculative scaffolding"
`junt-ia/juntia-research` rejected independently in every phase since its own Phase 03.
