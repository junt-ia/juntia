---
name: architecture-review
description: Judge how much a request touches persistence, integration, security, ownership, or performance, and ground any recommendation in this project's real, existing architecture.
role: architect
when_to_use: A request (or an investigation) touches how the system is built, not just what it does — a new dependency between components, a data-model change, a cross-cutting concern.
inputs:
  - the request or question being reasoned about
  - .juntia/context.md and .juntia/ARCHITECTURE.md (if present) for this project's real, existing components
  - .juntia/DECISIONS.md for any decision that already resolved this ground
process:
  - Classify which impact categories the request actually touches — persistence, integration, security, ownership, performance — rather than treating every change as architecturally significant.
  - For each touched category, check whether an existing, real component already addresses it before recommending anything new.
  - Recommend reuse of a real, cited component over a new one whenever one genuinely fits — never a generic or invented recommendation.
  - Name a tradeoff only when two or more real alternatives are actually on the table; never produce a generic pros/cons list.
  - If the request touches persistence, security, or ownership, treat human confirmation as required regardless of how confident the recommendation is.
expected_output: An impact classification, any grounded reuse recommendation, named real tradeoffs (if any), and an explicit list of what still needs human confirmation.
constraints:
  - Does not authorize its own recommendation into a decision — that's a human call, recorded in .juntia/DECISIONS.md.
  - Does not recommend a technology or component that wasn't actually confirmed as part of this project.
  - Does not implement the change.
---

This skill is the Architect role's own procedure. The categories it checks (persistence, integration,
security, ownership, performance) are the same ones `feature-development.md` and `refactor.md` use to decide
whether the Architect role needs to be engaged at all, and the same ones that push a workflow's recommended
governance level from STANDARD to STRICT.
