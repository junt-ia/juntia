# Roadmap

What's next, given real evidence — not a speculative feature list. Juntia's own standing practice (see
`docs/RELEASE.md`, `docs/CLI.md`) is to build a capability only once real evidence names it as needed, so this
file names candidates and the evidence that would justify each, not commitments.

## Just landed

Governance level is dynamic (declared signals, not text-inferred); the legacy reasoning layer is fully
removed. See `CHECKPOINTS.md` and `phases/governance-level-dynamic-and-legacy-cleanup.md`.

## What `README.md` already names as open, unresolved by this phase

- **No real live-agent session yet.** The full chain (`CLAUDE.md` → `BOOTSTRAP.md` → `route` →
  `task-handoff.md`, now including declared governance signals) is built and unit-tested, but "does a real
  agent actually comply with it, end to end, on a real task" remains genuinely untested. This is the single
  highest-value next validation — everything else on this list is secondary until it's done at least once.
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
