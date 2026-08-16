---
name: feature-planning
description: Turn a request into an explicit account of what's known, inferred, unknown, or requires a decision — before any of it becomes code.
role: product
when_to_use: A request introduces new or changed behavior, and it isn't yet clear whether everything needed to build it correctly is actually known.
inputs:
  - the request itself, in the requester's own words
  - .juntia/context.md (confirmed facts)
  - .juntia/DECISIONS.md (what's already been decided)
process:
  - Restate the desired behavior in concrete terms — reject vague or hedged phrasing as a signal to dig deeper, not to proceed on a guess.
  - Check whether every domain term central to the request (e.g. a named customer segment, a business rule) is already defined, either in the request itself or in an existing confirmed decision.
  - Name any undefined-but-load-bearing term as a blocking unknown, rather than silently assuming a definition.
  - Consult .juntia/DECISIONS.md before asking a question that's already been answered there.
  - State acceptance criteria only from what's actually known or decided — never invent one to fill a gap.
expected_output: An explicit list of what's known, what's inferred (and why), what's genuinely unknown and blocking, and a set of acceptance criteria grounded only in the above.
constraints:
  - Does not decide architecture or implementation approach.
  - Does not invent a definition for an undefined term and proceed.
  - Does not write the acceptance criteria as certainties when they were actually inferred.
---

This skill is the Product role's own procedure, made explicit and reusable rather than left as an unstated
habit. It exists because the most expensive mistake in feature work is usually not a wrong implementation —
it's building the right implementation of the wrong (or undefined) requirement. Applying this skill before
`implementation` starts is what `feature-development.md`'s own sequence (Product before Engineer) is asking
for concretely.
