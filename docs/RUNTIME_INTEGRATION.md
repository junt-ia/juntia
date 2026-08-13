# Runtime integration boundary (conceptual)

This document defines the boundary between Juntia and any AI coding runtime it integrates with. It is a
design, not an implementation — no `juntia integrate <runtime>` command exists yet.

## Source of truth

`.juntia/` (created by `juntia init`) is the single source of truth for a project's context, decisions,
rules, and role responsibilities, regardless of which runtime a developer is using.

## What an integration does

An integration reads from `.juntia/` and generates a runtime-specific adaptation of it — never the other
way around. For example (illustrative, none of these are built):

```
.juntia/                    <- source of truth, runtime-agnostic
  ├── PROJECT_STATE.md
  ├── DECISIONS.md
  ├── RULES.md
  └── roles/

.claude/CLAUDE.md            <- generated adaptation, Claude Code-specific
AGENTS.md                    <- generated adaptation, Codex-specific
GEMINI.md                    <- generated adaptation, Gemini-specific
```

A generated adaptation is a projection of `.juntia/`'s content into whatever format a given runtime expects
— it is disposable and regeneratable. Editing a generated file directly is expected to be a dead end (the
next `juntia integrate` run would overwrite it); real edits belong in `.juntia/`.

## What Juntia never delegates to a runtime

Per [`docs/VISION.md`](VISION.md)'s governance/interpretation split: a runtime is never handed the authority
to authorize a change, skip validation, or modify `.juntia/`'s own state automatically. It interprets and
generates; Juntia's own logic decides what happens with the result.

## Why this isn't built yet

No integration command exists because no evidence yet dictates the right shape for even one runtime's
adaptation format, let alone a design that generalizes across several — the same "don't build ahead of
evidence" discipline `junt-ia/juntia-research` applied for eleven prior phases before ever wiring a real
runtime call. `juntia init` (§ see `README.md`) is deliberately the only real command today, specifically
because it needed no such evidence: local scaffolding has one obviously correct shape regardless of which
runtime a project eventually integrates with.
