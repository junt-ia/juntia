# Roadmap

What's next, given real evidence — not a speculative feature list. Juntia's own standing practice (see
`docs/RELEASE.md`, `docs/CLI.md`) is to build a capability only once real evidence names it as needed, so this
file names candidates and the evidence that would justify each, not commitments.

## Just landed

Just-In-Time Governance: two consecutive fixes from the same Phase 16B dogfooding session — `pending.json`
now accepts the bare-array shape an external agent's own documented contract could plausibly produce, and
`governance-review` is a standing, just-in-time capability instead of a single pre-implementation checkpoint.
See `CHECKPOINTS.md` and `phases/just-in-time-governance.md`. Builds directly on Decision Continuity (same
session's other finding — `juntia confirm` refreshing `.juntia/task-handoff.md`, not only `.juntia/context.md`
— `phases/decision-continuity.md`), unreleased alongside it.

## What the first live-agent session found, unresolved so far

- **Re-run the Snake experiment.** Both phases above closed mechanisms the first session found broken,
  verified by unit/integration tests reproducing the exact failure modes — neither re-ran the live session
  itself. Doing that, and checking whether confirmed decisions now actually land in the game's code via a
  just-in-time escalation rather than a final pass, is the single highest-value next validation.
- **No evidence yet that Juntia improves code quality.** All three arms of the Snake experiment (no Juntia,
  Juntia legacy, current Juntia Governance) passed 11/11 functional checks; the governed arm's real, measured
  cost was roughly +40% tokens and +47% tool calls. Juntia's demonstrated value so far is governance and
  decision traceability, not code quality or cost — nothing in this phase, or planned, claims otherwise.
- **Only one runtime integration (Claude Code) is built.** Codex/Gemini/Cursor are architecturally supported,
  not built — no real evidence yet for any of their own conventions.
- **`juntia update` is designed, not built** (`docs/CLI.md#why-update-isnt-built-yet`) — needs a real
  conflict-resolution rule for a scaffolded file a developer has since edited; no evidence yet dictates the
  right one. Newly relevant: this phase's own Knowledge Layer edits (`agent-rules.md`, role/workflow files)
  won't reach a project that already ran `juntia init` before this phase, for exactly this reason.
- **No automatic role/skill invocation.** Juntia names the process; an agent still reads and follows it
  manually — including the moment to escalate a decision, which this phase makes easier to notice but cannot
  mechanically enforce. Whether that should change needs evidence from re-running the live-agent session
  above, not a guess now.
- **`juntia confirm <id>` for a single pending item, not the whole queue.** A real, named friction point this
  phase found while verifying the just-in-time flow (multiple unrelated pending items get visited together in
  one `confirm` run) — degrades safely today (an unanswered item stays pending, never mis-answered), left
  unsolved pending real evidence it's a recurring problem, not a theoretical one.

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
