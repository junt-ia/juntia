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

## The provider adapter interface (already real, already built)

Juntia is provider-agnostic not just as a stated intention but as a real, already-implemented interface —
`lib/intent-runtime-bridge.js`'s `interpretIntent(text, { adapter, deterministicOnly, adapterOptions })`
never imports a concrete provider; it accepts any `adapter` object exposing:

```
adapter.interpret(text, adapterOptions) -> Promise<RuntimeResponse>
```

`lib/runtime/claude-cli-adapter.js` is the one real implementation of this shape today, and the only file
in the codebase allowed to know Claude-CLI-specific detail (binary resolution, CLI flags, JSON envelope
parsing) — the bridge itself never references it directly; a caller injects it. A second real adapter
(Codex, Gemini, a local model) would satisfy the same two-argument, promise-returning shape and could be
swapped in with zero changes to the bridge, validator, or governance logic — this was directly verified
during the phase that built the bridge (every unit test in `test/intent-runtime-bridge.test.js` already
injects a hand-constructed mock adapter instead of the real one). `lib/runtime/reasoning-guideline.js` (the
system prompt sent to whichever adapter is used) is written to be provider-neutral by construction — no
model name, no vendor terminology, no assumption of conversational memory.

**What's still missing**: nothing selects an adapter from configuration today — `interpretIntent()`'s
`adapter` parameter is supplied by whoever calls it in code, not read from `.juntia/config.yml`. Closing
that gap needs a small provider-name → adapter-module lookup, not a new abstraction (the abstraction above
already exists); not built in this phase, named as the concrete next step in `phases/12c-runtime-user-
experience.md`.

## Configuring a provider (schema only, not consumed yet)

`.juntia/config.yml` (scaffolded by `juntia init`) reserves a `runtime:` block for this future selection:

```yaml
runtime:
  provider: null   # e.g. "claude-code", "codex", "gemini", "ollama"
  model: null       # optional, provider-specific
```

No code reads this block yet. It exists so the eventual `provider → adapter` lookup above has a place to
read from without a project needing to re-scaffold its `.juntia/` directory once that lookup is built.

## When Juntia uses AI at all

Per the cost principle: determinism first, always. `classifyIntent()` alone resolves the large majority of
real requests with zero AI calls (Phase 04's own dataset: 48/48; Phase 11's full-corpus validation: 143
real texts). The runtime bridge escalates to an adapter only when the deterministic router is genuinely
`AMBIGUOUS`, or a separate, corpus-validated signal flags a specific false-confidence risk pattern — never
for mechanical operations (creating files, syncing templates, simple presence checks). `juntia init`,
`update`, and the file-generation part of `integrate` never call AI, by design, for exactly this reason —
each is a deterministic, mechanical operation with one correct answer given its inputs, not an
interpretation problem.

## Why `integrate` isn't built yet

No integration command exists because no evidence yet dictates the right shape for even one runtime's
adaptation format, let alone a design that generalizes across several — the same "don't build ahead of
evidence" discipline `junt-ia/juntia-research` applied for eleven prior phases before ever wiring a real
runtime call. `juntia init` (§ see `README.md`) is deliberately the only real command today, specifically
because it needed no such evidence: local scaffolding has one obviously correct shape regardless of which
runtime a project eventually integrates with.
