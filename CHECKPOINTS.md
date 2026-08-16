# Checkpoints

A lightweight log of completed phases — where things stand, checkpoint by checkpoint, so picking work back up
doesn't require re-reading the full `CHANGELOG.md`/`phases/` history. Newest first. Each entry links to the
real detail (a `phases/*.md` doc, or the matching `CHANGELOG.md` version) rather than duplicating it.

## Governance Level Dynamic & Legacy Reasoning Cleanup — 2026-08-16

Two objectives, both landed:

- **Dynamic governance level.** `governanceLevel` now escalates or de-escalates from a workflow's static base
  via declared signals (`.juntia/governance/rules/governance-signals.md`, `juntia route --signal <name>`) —
  never inferred from a request's text. Byte-identical to the old static behavior when no signals are
  declared.
- **Legacy reasoning cleanup.** Eight modules deleted (`intent-router.js`, `product-reasoning.js`,
  `architecture-reasoning.js`, `engineering-reasoning.js`, `intent-runtime-bridge.js`,
  `runtime/reasoning-guideline.js`, `runtime/validator.js`, `runtime/false-confidence-risk-signal.js`).
  `lib/index.js` public API breaking change: `classifyIntent`/`analyzeProduct`/`analyzeArchitecture`/
  `analyzeEngineering`/`interpretIntent` removed.

Full account: [`phases/governance-level-dynamic-and-legacy-cleanup.md`](phases/governance-level-dynamic-and-legacy-cleanup.md).
Test suite: 427 tests passing (682 before this phase's deletions; 255 removed with their modules), zero
failures.

## 0.10.0 — Decision Discovery & Governance Triggers

Named decision areas per workflow, `decision-triggers.md`, `decisionGuidance` per governance level, the
`governance-review` skill. Full detail: `CHANGELOG.md`'s `[0.10.0]` entry.

## Phases 15B – 15G — Knowledge Layer, Workflow Routing, Agent Consumption Model, Decision Model

The Core/Knowledge Layer/Agent architecture this repo now runs on: `.juntia/governance/` as real, declarative
files; `juntia route` connecting a free-text request to that layer; `CLAUDE.md` → `BOOTSTRAP.md` → `route` →
`task-handoff.md` as the real agent-consumption chain; product/architecture decision requests via
`.juntia/pending.json` + `juntia confirm`. Full detail: `CHANGELOG.md`'s `[0.8.0]`–`[0.10.0]` entries.

## Earlier

Phases 04 through 13D built, then began retiring, the legacy reasoning layer this checkpoint's own top entry
just finished removing — intent classification, product/architecture/engineering reasoning, the AI Handoff
model replacing an earlier internal-runtime design. See `CHANGELOG.md` for the full, dated history.
