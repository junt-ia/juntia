# Roadmap

What's next, given real evidence — not a speculative feature list. Juntia's own standing practice (see
`docs/RELEASE.md`, `docs/CLI.md`) is to build a capability only once real evidence names it as needed, so this
file names candidates and the evidence that would justify each, not commitments.

## Just landed

Single Governance Source of Truth & Governance In-Flow: `juntia update` (finally built — migrates a legacy
governance scheme into `.juntia/governance/`, non-destructively) and Task Status
(`ACTIVE`/`WAITING_HUMAN_CONFIRMATION`/`READY_TO_CONTINUE` in `.juntia/task-handoff.md`, marked via `juntia
confirm`, no new command). See `CHECKPOINTS.md` and `phases/single-governance-source-of-truth.md`. Builds
directly on Just-In-Time Governance/Decision Continuity (same underlying dogfooding evidence), unreleased
alongside them.

## What the first live-agent session found, unresolved so far

- **Re-run the Snake experiment.** Every phase above closed a mechanism the first session found broken,
  verified by unit/integration tests reproducing the exact failure modes — none re-ran the live session itself.
  Doing that, and checking whether a blocking decision now actually stops an agent mid-task in practice, is the
  single highest-value next validation.
- **No evidence yet that Juntia improves code quality.** All three arms of the Snake experiment (no Juntia,
  Juntia legacy, current Juntia Governance) passed 11/11 functional checks; the governed arm's real, measured
  cost was roughly +40% tokens and +47% tool calls. Juntia's demonstrated value so far is governance and
  decision traceability, not code quality or cost — nothing in this phase, or planned, claims otherwise.
- **Only one runtime integration (Claude Code) is built.** Codex/Gemini/Cursor are architecturally supported,
  not built — no real evidence yet for any of their own conventions.
- **No automatic role/skill invocation, and Task Status is honest, not enforced.** Juntia names the process
  and computes whether work is blocked; an agent still reads and follows it manually, including the choice to
  actually stop when told to. Whether that should change needs evidence from re-running the live-agent session
  above, not a guess now.
- **`juntia confirm <id>` for a single pending item, not the whole queue.** A real, named friction point,
  found again while verifying Task Status (multiple unrelated pending items get visited together in one
  `confirm` run) — degrades safely today (an unanswered item stays pending, never mis-answered), left unsolved
  pending real evidence it's a recurring problem, not a theoretical one.
- **`juntia update` cannot merge two independently-customized copies of the same governance file, and never
  auto-splits a legacy `.juntia/workflows.md`.** Both report clearly and touch nothing rather than guess — a
  human still resolves either by hand. No evidence yet that either needs more automation than that.

## Candidates worth watching, not yet justified

- Whether `governance-signals.md`'s initial 10-entry catalog is the right size/shape — needs real usage
  (declared `--signal` values from an actual session) before extending or trimming it, the same evidence
  discipline `decision-triggers.md` was built under.
- Whether a signal should ever be able to name more than one level's worth of tie-breaking nuance (e.g. a
  signal that's STRICT only in combination with another) — no real case has needed this yet; the current flat
  per-signal level is deliberately the simplest thing that satisfies the brief's own worked examples.

## Not planned without new evidence

AI-based risk classification, a plugin system, additional CLI commands beyond `docs/CLI.md`'s documented
eight, or npm publication of this phase's work — all explicitly out of scope for this phase and not implied
as "next" by anything above.
