# Changelog

All notable changes to `@juntia/juntia` are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning follows [semver](https://semver.org/), with the
0.x-specific meaning described in [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x).

## [Unreleased]

Nothing yet.

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
