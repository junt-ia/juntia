# Changelog

All notable changes to `@juntia/juntia` are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning follows [semver](https://semver.org/), with the
0.x-specific meaning described in [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x).

## [Unreleased]

Nothing yet.

## [0.4.0] - 2026-08-14

The AI Handoff: Juntia no longer executes an AI runtime internally. Closes the real dogfooding finding from
`restaurant-game` (`analyze --explain` → `spawn("claude") ENOENT`) at its structural root — evaluated
architecturally first (see `phases/13c-ai-handoff-architecture.md`), implemented this phase.

### Changed

- `juntia analyze --explain` no longer spawns a subprocess or calls any AI runtime. It refreshes
  `.juntia/agent-instructions.md` — deterministic, generated from the same facts/diff `analyze` already
  computed — and reports how many interpretations are already pending. No `claude` binary, `PATH`, API key,
  or model configuration is required for any command to work.
- `juntia setup` no longer calls an AI runtime either. It reviews whatever proposals are already sitting in
  `.juntia/pending.json` (written by an external AI agent following the handoff instructions), asks which
  assistant you use, integrates it, and tells you to open it and follow `.juntia/agent-instructions.md`.
- `juntia integrate <runtime>` now also generates/refreshes `.juntia/agent-instructions.md` alongside the
  runtime-specific pointer file (`CLAUDE.md` for Claude Code). The pointer file itself now mentions the
  handoff file as a guide, without copying its content.
- `juntia confirm` now validates every pending item — shape, forbidden governance fields, and fact-grounding
  — before presenting it to a human, since a proposal can now arrive from an external AI agent, not only
  from Juntia's own (retired) internal call. An invalid or hallucinated proposal is dropped silently, never
  shown, never confirmable. A proposal that already matches a confirmed decision is recognized and dropped
  without asking again.

### Added

- `.juntia/agent-instructions.md` (`lib/project-intelligence/agent-handoff.js`, new) — the AI Handoff: a
  generated, deterministic file explaining to whatever AI agent reads it (Claude Code today) how to
  interpret the project from the same FACTS Juntia already verified, and where to write its proposal
  (`.juntia/pending.json`) for Juntia to validate.

### Removed

- `lib/runtime/claude-cli-adapter.js` and `lib/runtime/provider-registry.js` — the internal
  subprocess-execution mechanism this phase retires. `runtime.provider` in `.juntia/config.yml` keeps its
  storage and meaning (which assistant you use) but is no longer resolved to an internally-invoked adapter.
- `context-synthesis-bridge.js`'s `synthesizeContext` (the part that invoked an injected adapter) —
  `buildRequestText`, the deterministic FACTS/CHANGES/EXISTING CONTEXT renderer, stays and is now reused by
  `agent-handoff.js`.
- `resolveConfiguredAdapter`/`formatRuntimeFailure`/`formatUnresolvedRuntime` (bin/juntia.js) and the
  `adapter`/`adapterOptions` options on `runAnalyze`/`runSetup` — no longer meaningful once nothing in the
  primary CLI flow calls an adapter.

## [0.3.0] - 2026-08-14

Two real problems found during this migration's own first real dogfooding, both closed:

### Fixed

- `juntia analyze --explain` (and `setup`'s own explain step) no longer silently defaults to the Claude CLI
  adapter regardless of configuration. Both now read `.juntia/config.yml`'s `runtime.provider`, resolve the
  real adapter for it (`lib/runtime/provider-registry.js`, new), and report plainly — never guess — when
  nothing is configured (`No AI assistant configured yet — run \`juntia setup\`...`) or the configured value
  isn't a runtime Juntia has an adapter for (`"<name>" is configured, but ...`). A resolved-but-unavailable
  runtime (e.g. Claude Code not installed) still reports in plain language, not a raw process error — that
  guarantee is unchanged, now shared by `analyze --explain` too, not just `setup`.
- A file Juntia itself generates (currently `CLAUDE.md`, via `integrate`/`setup`) is now classified as a
  `managed.file` fact, never `structure.file` — it's real evidence of something, just not of the project's
  own architecture. Previously, `juntia analyze` could report `Added: structure.file: CLAUDE.md` as if a
  human had made a new architectural decision, when a human had actually just run `juntia setup`.

### Added

- `lib/runtime/provider-registry.js` — the real `providerName -> adapter` lookup Phase 12C named as the
  concrete next step, closing it for the project-interpretation domain (`analyze --explain`). The intent-
  classification domain (`interpretIntent()`) is unaffected — no CLI command currently drives it directly.

## [0.2.0] - 2026-08-14

`juntia setup` — the new recommended entrypoint. One command orchestrates the existing capabilities
(init → analyze → explain → confirm → context → integrate) into a single, plain-language onboarding flow,
so a new user never has to learn what a "fact," "interpretation," "decision," or "integration" is just to
get a project ready. Every underlying command (`init`/`analyze`/`confirm`/`context`/`integrate`) is unchanged
and still available directly for anyone who wants the detail or wants to script a specific step.

### Added

- `juntia setup` — detects whether the project is initialized, analyzes it, generates an AI interpretation
  and asks for confirmation once an assistant is configured, refreshes context, asks which AI assistant you
  use (Claude Code today; OpenAI Codex/Gemini CLI/Cursor listed as not-yet-available), and configures that
  integration — idempotent on every re-run, never overwrites a real file it didn't generate, and reports a
  plain-language message (never a raw process error) if the chosen assistant isn't actually available.
- `.juntia/config.yml`'s previously-unused `runtime.provider` field is now written by `setup` (and readable
  via `juntia integrate`'s own internals) as a real record of which assistant you use — not yet consumed to
  select an adapter for `analyze --explain`'s own AI calls, which remains a separate, still-open gap.

## [0.1.0] - 2026-08-14

First public release. 0.x — the CLI surface and public API are real and working, but not yet under a
stability guarantee; see [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x) for what that means in
practice.

### Added

- `juntia init` — scaffolds a project-local `.juntia/` context directory.
- `juntia analyze` — deterministic project inventory (languages, dependencies, config files, structure),
  each fact traceable to real evidence; persists a factual baseline to `.juntia/facts.json` and reports
  Added/Removed/Changed against it on every later run.
- `juntia analyze --explain` — a real AI-runtime interpretation of the persisted facts, validated against a
  fact-grounding check, saved as a pending item in `.juntia/pending.json`.
- `juntia confirm` — the only command that can create a decision: walks every pending interpretation and
  asks; a "yes" writes `.juntia/decisions.json` and appends a line to `.juntia/DECISIONS.md`.
- `juntia context` — assembles `.juntia/context.md` from confirmed facts and confirmed decisions only.
- `juntia integrate claude-code` — generates a `CLAUDE.md` pointer file so Claude Code finds
  `.juntia/context.md` on its own, without duplicating its content.
- A public, documented programmatic API (`require('@juntia/juntia')`): `classifyIntent`, `analyzeProduct`,
  `analyzeArchitecture`, `analyzeEngineering`, `interpretIntent`.
- A protected internal/public boundary enforced by `package.json`'s `exports` map — a deep `require()` into
  internal reasoning modules throws, by design.
