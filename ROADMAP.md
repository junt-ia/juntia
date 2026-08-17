# Roadmap

What's next, given real evidence — not a speculative feature list. Juntia's own standing practice (see
`docs/RELEASE.md`, `docs/CLI.md`) is to build a capability only once real evidence names it as needed, so this
file names candidates and the evidence that would justify each, not commitments.

## Just landed

Decision Continuity: `juntia confirm` now refreshes `.juntia/task-handoff.md`, not only `.juntia/context.md`,
closing the real gap a first live Snake dogfooding session found (a confirmed decision that didn't reliably
reach the agent mid-task). See `CHECKPOINTS.md` and `phases/decision-continuity.md`.

## What the first live-agent session found, unresolved by this phase

- **Re-run the Snake experiment.** This phase closed the mechanism the first session found broken, verified by
  unit/integration tests reproducing the exact failure mode — it did not itself re-run the live session. Doing
  that, and checking whether confirmed decisions now actually land in the game's code, is the single
  highest-value next validation.
- **No evidence yet that Juntia improves code quality.** All three arms of the Snake experiment (no Juntia,
  Juntia legacy, current Juntia Governance) passed 11/11 functional checks; the governed arm's real, measured
  cost was roughly +40% tokens and +47% tool calls. Juntia's demonstrated value so far is governance and
  decision traceability, not code quality or cost — nothing in this phase, or planned, claims otherwise.
- **Only one runtime integration (Claude Code) is built.** Codex/Gemini/Cursor are architecturally supported,
  not built — no real evidence yet for any of their own conventions.
- **`juntia update` is designed, not built** (`docs/CLI.md#why-update-isnt-built-yet`) — needs a real
  conflict-resolution rule for a scaffolded file a developer has since edited; no evidence yet dictates the
  right one.
- **No automatic role/skill invocation.** Juntia names the process; an agent still reads and follows it
  manually. Whether that should change needs evidence from the live-agent session above, not a guess now.

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
