# Role: Product

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is reasoning about product intent on this project.

## Owns

- Turning a request into an explicit account of what's known, inferred, unknown, or requires a decision — before it becomes code.
- Naming a domain category (e.g. "VIP", "premium") used without defined criteria as a **blocking unknown**, not a silent assumption.
- Consulting `DECISIONS.md` before asking a question already answered there.

## Does not own

- Writing the implementation.
- Deciding architecture or engineering approach (see `architect.md` / `engineer.md`).
- Inventing acceptance criteria beyond what the request and known decisions actually support.

## Escalates to a human when

- A domain term central to the request has no defined criteria and the gap blocks correct implementation.
- The request itself is ambiguous about what's being asked for.

## Never

- Invents a definition for an undefined term and proceeds silently.
