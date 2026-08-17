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
  (product/architecture decision escalation — the latter's own `Requires confirmation` field is the
  declarative BLOCKING/non-blocking definition, never inferred from text), `agent-context.js`/
  `task-handoff.js`/`bootstrap.js` (what an external agent actually reads, including — since Decision
  Continuity/Just-In-Time Governance — a "Confirmed decisions" section refreshed the moment `juntia confirm`
  records one, at any point in a task, not only at its start).
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

Public beta (`0.x`), currently `0.13.0` on npm (Decision Continuity + Just-In-Time Governance). See
`CHANGELOG.md` for exactly what shipped in each version.

A first real live-agent dogfooding session has now run (a three-arm Snake experiment: no Juntia, Juntia
legacy, current Juntia Governance). It confirmed the governed arm behaves differently (discovers Juntia, runs
`route`/`governance-review`, produces and confirms real decisions) at a real cost (~+40% tokens, ~+47% tool
calls), with no evidence yet that Juntia improves code quality (11/11 functional checks passed in all three
arms), and found two real gaps: a confirmed decision not reliably reaching the agent mid-task
(`phases/decision-continuity.md`), and — found in that same session, closed together in one phase — an
external agent's own `pending.json` write being rejected by a contract Core didn't actually accept, plus
`governance-review` asking its questions only once the agent had practically finished implementing rather
than while it could still act on the answer (`phases/just-in-time-governance.md`). Real known limitations
remain, named plainly in `README.md`: only Claude Code is a built runtime integration, the public API/CLI
surface can still change, and the session has not yet been re-run to check whether these fixes hold in
practice.

## Where things live

| Question | File |
|---|---|
| What can I run? | `docs/CLI.md` |
| Why is it shaped this way? | `docs/ARCHITECTURE.md`, `docs/RUNTIME_INTEGRATION.md` |
| What's been decided about Juntia itself? | `DECISIONS.md` (this directory) |
| What's next? | `ROADMAP.md` |
| What did we learn building it? | `LEARNINGS.md` |
| What phases have landed? | `CHECKPOINTS.md`, `CHANGELOG.md`, `phases/` |
