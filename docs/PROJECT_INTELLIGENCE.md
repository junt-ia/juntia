# Project intelligence model (conceptual)

What Juntia would need to know about a project to eventually support `juntia analyze` — a design, not an
implementation. No scanner, parser, or AI call exists yet; see [`docs/CLI.md`](CLI.md) for `analyze`'s
current status.

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

| Tier | Examples | AI required? |
|---|---|---|
| **Deterministic** | Detect language, read `package.json`/`Cargo.toml`/`*.csproj`, list folders, list dependencies | Never |
| **AI Assisted** | Summarize purpose, propose architecture components, draft candidate documentation | Only when it adds real value |
| **Human Decision** | Product decisions, approving a detected pattern as a binding rule, resolving a source conflict | Never automated |

Across every `.juntia/` file: **detecting and proposing content can be automated; writing it in as a
recorded fact never is.** `DECISIONS.md` entries in particular are never auto-generated, by definition.

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
