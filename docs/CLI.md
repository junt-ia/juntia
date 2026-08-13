# Public CLI

This is the complete public surface. Anything not listed here (intent routing, product/architecture/
engineering reasoning, validation, the runtime bridge, provider adapters) is internal engine — a developer
using Juntia should never need to invoke one of those directly. See
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#public-api-vs-internal-engine) for why that boundary matters.

| Command | Responsibility | Status | Consumes AI? |
|---|---|---|---|
| `juntia init` | Create a project-local `.juntia/` context directory (config, state, decisions, rules, architecture, roles). | **Built** | Never — pure, deterministic filesystem scaffolding. |
| `juntia analyze` | Understand an existing project: detect technologies, analyze structure, create initial context, surface unknowns, prepare base documentation. See [`docs/PROJECT_INTELLIGENCE.md`](PROJECT_INTELLIGENCE.md) for the full knowledge model. | **Designed, not built** | Only for the parts that genuinely need interpretation (see below) — detecting a `package.json`/language/framework is mechanical and would not call AI. |
| `juntia update` | Update Juntia's own scaffolded files in a project without destroying real project content the developer has since edited. | **Designed, not built** | Never — same class of operation as `init`, mechanical file sync. |
| `juntia integrate <runtime>` | Connect a specific AI coding runtime (Claude Code, Codex, Gemini, ...) — configure it and generate its runtime-specific adaptation of `.juntia/`. | **Designed, not built** | Never for the mechanical file-generation part; the runtime itself does no interpretation as part of being integrated. |

No command beyond these four exists or is planned without new evidence. In particular: no command exposes
`classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/`analyzeEngineering`/`interpretIntent` directly —
those are the internal engine's own functions, reachable programmatically via `require('juntia')` for a
caller that genuinely needs them (e.g. a runtime integration built later), not meant to be typed by a
developer at a terminal.

## Why `analyze`/`update`/`integrate` aren't built yet

Each needs a real design decision this repository has no evidence to make yet:

- **`analyze`** needs a decided answer to "what does 'understand a project' actually mean, concretely" —
  which file signals map to which technology, how much structure analysis is enough, what an initial
  `.juntia/` context looks like when seeded from a real, non-empty codebase instead of a blank `init`. None
  of this has been tested against a real project.
- **`update`** needs a real conflict-resolution rule (what happens when a scaffolded file has since been
  edited by a developer) — `init`'s own "never overwrite" rule is deliberately too conservative to reuse
  as-is for updating stale scaffolding.
- **`integrate`** needs at least one real runtime-adaptation format actually worked out end-to-end (what
  exactly goes in a generated `.claude/CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`, and how it stays
  regeneratable without clobbering real edits) — nothing in this repository has attempted that yet.

Building any of them now, without that evidence, would repeat the exact "speculative scaffolding"
`junt-ia/juntia-research` rejected independently in every phase since its own Phase 03.
