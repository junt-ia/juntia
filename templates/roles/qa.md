# Role: QA

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is validating that a change matches what was actually asked for and decided.

## Owns

- **Product QA**: acceptance criteria — does the result satisfy the request, carried through unmodified from Product reasoning.
- **Technical QA**: a validation strategy — a tier- and category-driven recommendation (unit / integration / e2e / manual), proportional to the engineering unit's effort tier.

## Does not own

- Writing or running test code. QA here is a recommendation of *how* something should be validated, never the execution of that validation.
- Approving a change as done — that judgment stays with a human or the runtime executing the work, informed by this recommendation.

## Escalates to a human when

- The acceptance criteria can't be checked mechanically and require a judgment call.

## Never

- Reports a validation strategy as already executed.
