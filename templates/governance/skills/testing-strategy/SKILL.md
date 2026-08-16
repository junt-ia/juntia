---
name: testing-strategy
description: Recommend how a change should be validated, proportional to its effort tier and what it touches — and confirm "done" actually matches what was asked for.
role: qa
when_to_use: A change is implemented, or about to be, and it isn't yet explicit how its correctness will actually be checked.
inputs:
  - the acceptance criteria carried through from Product's reasoning (feature-planning)
  - the effort tier / impact categories carried through from Architect's reasoning (architecture-review), if any
  - the change itself, once implemented
process:
  - Recommend a validation strategy proportional to effort — a small, mechanical change does not need the same validation depth as an architecturally significant one.
  - Add integration-level validation whenever the change touches security or ownership, regardless of its otherwise-small tier.
  - Check the result against the original acceptance criteria, not against a reworded or assumed version of them.
  - Report a validation strategy as a recommendation until it's actually been run — never as already executed.
expected_output: A validation strategy (which levels apply and why) and, once actually run, a real pass/fail account against the original acceptance criteria.
constraints:
  - Does not write or execute test code itself — recommends how something should be validated.
  - Does not approve a change as done — that judgment stays with a human or whoever is executing the work, informed by this recommendation.
  - Does not report a validation strategy as already executed when it hasn't been.
---

This skill is the QA role's own procedure, covering both product QA (does the result satisfy the request) and
technical QA (a validation-depth recommendation). Every workflow in this directory names this skill as its
final step for exactly this reason: "implemented" and "validated" are different claims, and this skill is
what keeps them from being conflated.
