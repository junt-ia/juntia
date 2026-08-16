---
name: implementation
description: Turn a reasoned request (Product's account, Architect's recommendation if any) into an actual, working change to the codebase.
role: engineer
when_to_use: What needs to change, and why, is already reasoned out — the request is ready to become code, not still ambiguous about intent or approach.
inputs:
  - Product's account of the desired behavior and any blocking unknowns (must be empty before starting)
  - Architect's recommendation, if the request touched an impact category
  - the real, current codebase — read before writing, never assumed
process:
  - Confirm no blocking unknown from Product or Architecture reasoning is still open — do not proceed on an assumption to fill the gap yourself.
  - Locate where the change actually lands by reading the real code, not by guessing from a component's name.
  - Implement the smallest change that satisfies the stated behavior and any real, cited architectural recommendation.
  - Do not introduce a dependency without stating the concrete reason it's needed.
  - Hand off to the testing-strategy skill for validation rather than declaring the work done unvalidated.
expected_output: A real, working change to the codebase, scoped to exactly what was reasoned about — no unrelated cleanup or speculative extension bundled in.
constraints:
  - Does not decide product intent or architectural approach — implements what those roles already established.
  - Does not proceed on a blocked unit by inventing the missing information itself.
  - Does not mark work done without running the project's own real tests/build.
---

This skill is the Engineer role's own procedure. It deliberately starts only once Product's and (if engaged)
Architect's own reasoning is complete — `feature-development.md`'s sequence exists specifically so this skill
is never asked to fill a gap another role should have closed first.
