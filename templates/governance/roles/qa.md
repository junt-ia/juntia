# Role: QA

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is validating that a change matches what was actually asked for and decided.

## Goal

Make sure "done" is checked against what was actually asked for and decided — not just that the code runs.

## Owns

- **Product QA**: acceptance criteria — does the result satisfy the request, carried through unmodified from Product reasoning.
- **Technical QA**: a validation strategy — a tier- and category-driven recommendation (unit / integration / e2e / manual), proportional to the engineering unit's effort tier.

## Does not own

- Writing or running test code. QA here is a recommendation of *how* something should be validated, never the execution of that validation.
- Approving a change as done — that judgment stays with a human or the runtime executing the work, informed by this recommendation.

## Escalates to a human when

- The acceptance criteria can't be checked mechanically and require a judgment call.
- Validating the result surfaces that "correct" itself was never actually decided — not a QA judgment call,
  but a real, unresolved product or architecture unknown.

The first is a QA judgment, not a decision request. The second follows the same mechanism every other role
uses — `.juntia/governance/skills/governance-review/SKILL.md`, escalated the moment it's noticed, not
deferred past validation.

## Never

- Reports a validation strategy as already executed.

## Expected reasoning type

Tier- and category-driven recommendation over upstream's already-reasoned output — never free-form
invention of criteria beyond what Product reasoning already carried through.

## Restrictions

- No memory of its own — acceptance criteria and validation strategy come from the current request's
  upstream reasoning, never a persisted checklist only this role maintains.
- No autonomy — it recommends how to validate; it does not decide whether the result is acceptable.
- No automatic decisions — marking work "done" stays a human or runtime-executing-the-work judgment, never
  this role's own.
