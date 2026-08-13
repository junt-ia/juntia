# Project intelligence model

What Juntia needs to know about a project to support `juntia analyze`. The **Deterministic** tier below is
real and built (`lib/project-intelligence/`, exercised by `juntia analyze`) — the AI Assisted and Human
Decision tiers remain design only, no AI call exists yet. See [`docs/CLI.md`](CLI.md) for `analyze`'s exact
current behavior.

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
| **AI Assisted** | Summarize purpose, propose architecture components, draft candidate documentation | Only when it adds real value | Designed, not built |
| **Human Decision** | Product decisions, approving a detected pattern as a binding rule, resolving a source conflict | Never automated | Designed, not built |

Across every `.juntia/` file: **detecting and proposing content can be automated; writing it in as a
recorded fact never is.** `DECISIONS.md` entries in particular are never auto-generated, by definition. The
built Deterministic tier only ever detects and prints — it does not yet write anything into `.juntia/`.

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

## Reuses an existing, already-tested contract

`analyze`'s eventual output for the Architecture category is not a new data shape — it's a real instance of
`known.existingArchitecture.components[]` (`{ name, description, relevantTo, files }`), the same input
`analyzeArchitecture()` and `analyzeEngineering()` already accept and have real tests against. No new
contract is designed here.

## Full reasoning

The complete category mapping (against Phase 02's original context model), source-of-truth reasoning,
automation-tier examples, four validated conceptual cases, and discarded alternatives live in
`junt-ia/juntia-research`'s `phases/12d-project-intelligence-model.md` *(that repository is planned, not yet
created — currently still `claude-toolkit`)*.
