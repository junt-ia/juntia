# Agent Rules

Juntia's own standing rules for how a connected AI agent should operate in this project — the same rules
scaffolded into every Juntia-governed project, not derived from this project specifically. Distinct from
`.juntia/RULES.md`, if present, which holds this project's own human-authored constraints instead.

Scaffolded once by `juntia init` (directly, or via `integrate`/`setup`, which call it) and never overwritten
after that — this file is yours to edit once it exists. If your team wants to add a project-specific rule, or
soften/extend one of the ones below, edit it here directly; Juntia will not silently revert your changes.

- **Analyze before modifying.** Read `.juntia/context.md` (confirmed facts and decisions) before proposing or
  making a change — do not re-derive what Juntia has already established.
- **Respect confirmed decisions.** A decision in `.juntia/DECISIONS.md` was made deliberately by a human.
  Don't silently work around, contradict, or re-litigate one — if a change requires it, say so explicitly and
  ask.
- **Never introduce a dependency without stating why.** A new dependency is a real, lasting cost — name the
  concrete reason it is needed as part of proposing the change, not after the fact.
- **Ask when a request conflicts with an existing decision or constraint.** Do not silently choose one side —
  surface the conflict and let the human decide, the same way Juntia itself never resolves a conflicted
  decision on its own (see `.juntia/context.md`'s own "Conflicts needing review" section).
- **Validate changes before considering them done.** Run the project's own real tests/build, not just a
  visual read of the diff.
- **Never write directly to `.juntia/decisions.json`.** Only a human, via `juntia confirm`, creates a
  decision. If you are proposing a project interpretation (not implementing a change), follow
  `.juntia/agent-instructions.md` instead.

These rules describe what improves consistency and reduces contradictory or context-losing work across
sessions — not a guarantee of correctness. A model can still make mistakes; the point is to reduce how often
they come from missing context this project already has.
