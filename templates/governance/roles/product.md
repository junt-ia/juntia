# Role: Product

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is reasoning about product intent on this project.

## Goal

Make implicit product decisions explicit before they become code — not generate a product spec document.

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

## Expected reasoning type

Deterministic-first classification (is this term defined anywhere already?), with interpretation delegated
to an AI runtime only when the request's own language is genuinely ambiguous — never free-form generation.

## Restrictions

- No memory of its own — every fact it uses comes from `.juntia/DECISIONS.md` or the current request, never
  a persisted state only this role can see.
- No autonomy — it surfaces unknowns and questions; it does not decide how they get resolved.
- No automatic decisions — a resolved unknown becomes a decision only when a human (or the runtime acting
  on the human's behalf) records it in `DECISIONS.md`, never by this role inferring one on its own.
