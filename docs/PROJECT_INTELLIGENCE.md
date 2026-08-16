# Project intelligence model

What Juntia needs to know about a project to support `juntia analyze`. All three tiers below are now real
and built: **Deterministic** (`lib/project-intelligence/`, exercised by `juntia analyze`), **AI Assisted**
(`juntia analyze --explain`, Phase 12J/12K — a genuine AI-runtime call over real facts, now persisted to
`.juntia/pending.json`), and **Human Decision** (`juntia confirm`, Phase 12K — the only step that can ever
create a decision, written to `.juntia/decisions.json` + `.juntia/DECISIONS.md`). See
[`docs/CLI.md`](CLI.md) for the exact current behavior of each command.

## Juntia does not try to understand everything

Only enough to maintain context, protect decisions, help an AI runtime work with accurate grounding, and
avoid knowledge loss — not exhaustive comprehension of a codebase. Unbounded analysis, unlimited context, and
automatic documentation with no evidenced value are explicitly out of scope.

## Categories of knowledge

| Category | What it covers | Example |
|---|---|---|
| **Project Identity** | Name, purpose, type, main technologies | "Unity game, C#" |
| **Structure** | Folders, relevant files, dependencies, repo organization | `Assets/`, `Scripts/`, `Scenes/` |
| **Architecture** | Systems, components, relationships, existing decisions | "Combat system: `PlayerController`, `HealthSystem`" |
| **State** | Decided, pending, unknowns, risks | "Decided: ScriptableObjects. Pending: multiplayer." |
| **Constraints** | Mandatory tech, hard limits, non-negotiables | "Must work offline." |
| **Conventions** | Naming, style, internal patterns | "Services end in `Service`." |

## Source of truth

Authority is per-category, not one global priority order:

| Category | Authoritative source |
|---|---|
| Structure, mechanical Project Identity facts | **Code** — read directly, never inferred |
| Decisions, Constraints, Conventions once recorded | **`.juntia/`** |
| New input during analysis | **The user** |
| Architecture summaries, purpose synthesis, risk proposals | **The AI runtime proposes — never authoritative alone**, must cite a real supplied fact or stay an explicit, unconfirmed proposal |

When two sources disagree, the conflict is reported explicitly — never resolved silently.

## Automation tiers

| Tier | Examples | AI required? | Status |
|---|---|---|---|
| **Deterministic** | Detect language, read `package.json`/lockfiles/`pyproject.toml`, list top-level folders, list declared dependencies, recognize config files | Never | **Built** — `juntia analyze` |
| **AI Assisted** | Summarize purpose, propose architecture components, draft candidate documentation | Only when it adds real value | **Built** (`analyze --explain`, Phase 12J/12K) — real runtime calls, persisted to `.juntia/pending.json` |
| **Human Decision** | Product decisions, approving a detected pattern as a binding rule, resolving a source conflict | Never automated | **Built** (`juntia confirm`, Phase 12K) |

Across every `.juntia/` file: **detecting and proposing content can be automated; writing it in as a
recorded, human-authored fact never is.** `DECISIONS.md` entries are appended only by `juntia confirm`, only
after a real human answers "yes" — never auto-generated, by definition; the AI Assisted tier can propose
(`pending.json`) but never write to `decisions.json`/`DECISIONS.md` itself. The built Deterministic tier
detects, prints, **and persists** (`.juntia/facts.json`, Phase 12I) — but that persisted file is
machine-only memory, not one of the human-facing files above; see
[`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md) for exactly where the FACT/INTERPRETATION/DECISION
tiers' own storage sits relative to `PROJECT_STATE.md`/`DECISIONS.md`/`RULES.md`/`ARCHITECTURE.md`.

## The Deterministic tier, concretely

`lib/project-intelligence/scanner.js` orchestrates five detectors
(`detectors/{manifest,language,dependency,structure,config}-detector.js`), each presence-only or
extraction-only — none of them interpret. `scanProject(projectRoot)` returns:

```js
{
  identity: { languages: [{ name, fileCount, evidence }], technologies: [{ name, source, evidence }] },
  structure: { directories: [], files: [] },
  dependencies: [{ name, version, source, evidence }],
  manifests: [],   // e.g. ["package.json"]
  evidence: [],     // flat log of every observation, same facts as above
}
```

Every fact carries its own `evidence` — a real file path or manifest key, never a bare claim. Finding a
`phaser` dependency is reported as exactly that; it is never promoted to "this is a game" — that
interpretation, if it ever happens, belongs to the AI Assisted tier, not this one. An empty/unrecognized
project returns empty arrays across the board — the honest representation of "genuinely unknown," not a
guess.

## Project files vs. Juntia-managed infrastructure (Phase 13B)

A real bug found during this migration's own first real dogfooding: a file Juntia itself generates (e.g.
`CLAUDE.md`, via `juntia integrate`/`setup`) is a real file on disk, so the deterministic scanner correctly
detected it — but reported it as `structure.file`, indistinguishable from a file the project's own developer
actually authored. A diff then read `Added: + structure.file: CLAUDE.md`, implying a new architectural
decision that never happened; a human just ran `juntia setup`.

`lib/project-intelligence/facts-store.js`'s `factsFromScanResult()` now classifies each detected file against
`RUNTIME_PROFILES` (`lib/project-intelligence/agent-integration.js`'s own single source of truth for which
filenames a real integration generates — currently just `CLAUDE.md`): a recognized filename becomes a
`managed.file` fact instead of `structure.file`. Deliberately minimal — no new taxonomy beyond one extra
category value, derived from data that already existed rather than a new, hand-maintained list. A real,
human-authored file happening to share that exact filename (e.g. a team's own, non-Juntia `CLAUDE.md`) is
still classified as `managed.file` — the filename itself, not its authorship or content, is what Juntia
recognizes as its own integration point; distinguishing "who wrote it" is what the generated-file marker
(Phase 12L) is for, a separate real mechanism this phase didn't need to touch. `.juntia/` itself needs no
classification here at all — it's excluded from scanning entirely (Phase 12I), never reaching this point.

## From facts to knowledge

Turning these deterministic facts into interpreted, then confirmed, knowledge (the AI Assisted and Human
Decision tiers above) is now real and built end-to-end — see
[`docs/CONTEXT_SYNTHESIS.md`](CONTEXT_SYNTHESIS.md) for the full FACT → INTERPRETATION → CONFIRMATION →
DECISION → CONTEXT model, without ever inventing a fact or silently promoting a guess into a recorded
decision without a real human saying yes.

## A shape this repo has real precedent for, even though the code that defined it is gone

`analyze`'s eventual output for the Architecture category, if built, need not invent a new data shape:
`known.existingArchitecture.components[]` (`{ name, description, relevantTo, files }`) was a real, tested
input shape the legacy `analyzeArchitecture()`/`analyzeEngineering()` modules accepted before they were
removed in the Governance Level Dynamic and Legacy Cleanup phase (see
`phases/governance-level-dynamic-and-legacy-cleanup.md`) — worth reusing as prior art if this category is ever
actually built, not something to redesign from scratch.

## Full reasoning

The complete category mapping (against Phase 02's original context model), source-of-truth reasoning,
automation-tier examples, four validated conceptual cases, and discarded alternatives live in
`junt-ia/juntia-research`'s `phases/12d-project-intelligence-model.md` *(that repository is planned, not yet
created — currently still `claude-toolkit`)*.
