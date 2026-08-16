# Context

What Juntia (the project) is right now — a snapshot for whoever picks up work next, human or agent. Distinct
from `.juntia/context.md`, which is Juntia's own gitignored, self-hosted dogfooding instance (this repo
governing its own development), not project-level documentation. See `README.md` for the full pitch and
`docs/ARCHITECTURE.md`/`docs/CLI.md` for the detailed model — this file is the short version, kept current.

## What Juntia is, in one line

A deterministic governance layer for AI-assisted development — not an agent, not a reasoning engine. "AI
interprets. Juntia governs."

## Current architecture (post governance-level-dynamic-and-legacy-cleanup)

- **Core** (`lib/governance/`) — `intent-model.js` (classifies a request into
  feature/bug/investigation/refactor/unknown), `workflow-knowledge.js` (resolves the matching
  `.juntia/governance/workflows/*.md`), `workflow-router.js` (composes the two, plus governance signal
  evaluation, into the real route), `governance-signals.js` (declared-signal → level evaluation),
  `governance-levels.js` (what LIGHT/STANDARD/STRICT mean), `decision-model.js`/`decision-triggers.js`
  (product/architecture decision escalation), `agent-context.js`/`task-handoff.js`/`bootstrap.js` (what an
  external agent actually reads).
- **Knowledge Layer** (`.juntia/governance/`, scaffolded once by `juntia init`, project-editable after that) —
  `workflows/`, `roles/`, `skills/`, `rules/` (including `agent-rules.md`, `decision-triggers.md`,
  `governance-signals.md`), `conventions/`.
- **Agent** — whichever external AI coding runtime the developer already uses (Claude Code today; Codex/
  Gemini/Cursor architecturally supported, not built). Reasons, implements, and makes technical decisions
  entirely on its own, guided by what Juntia hands it.

A single architecture now — the earlier "legacy reasoning" layer (intent router, product/architecture/
engineering reasoning, an internal AI runtime bridge) was fully removed; see
`phases/governance-level-dynamic-and-legacy-cleanup.md`.

## Status

Public beta (`0.x`, currently `0.11.0` on npm — see `CHANGELOG.md` for exactly what shipped in each version).
Real known limitations, named plainly in `README.md`: no live-agent session has been run end-to-end yet, only
Claude Code is a built runtime integration, and the public API/CLI surface can still change.

## Where things live

| Question | File |
|---|---|
| What can I run? | `docs/CLI.md` |
| Why is it shaped this way? | `docs/ARCHITECTURE.md`, `docs/RUNTIME_INTEGRATION.md` |
| What's been decided about Juntia itself? | `DECISIONS.md` (this directory) |
| What's next? | `ROADMAP.md` |
| What did we learn building it? | `LEARNINGS.md` |
| What phases have landed? | `CHECKPOINTS.md`, `CHANGELOG.md`, `phases/` |
