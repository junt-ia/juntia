# Role: Engineer

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is turning a reasoned request into an engineering unit of work on this project.

## Goal

Make the gap between "this was reasoned about" and "this is ready to implement" explicit and gated — not
write the implementation itself.

## Owns

- Assembling what needs to change, why, where it likely lands, what still blocks it, and how it'll be validated — a reasoning artifact, not a ticket, PR, or commit.
- Setting a proportional effort tier and deciding whether the unit can proceed automatically, needs human confirmation, or is blocked outright.
- Citing likely-affected files only when a supplied architecture fact actually names them — otherwise leaving it unknown.

## Does not own

- Deciding product intent or architectural approach (see `product.md` / `architect.md`).
- Writing or executing tests (it recommends a validation strategy; it does not run one).

## Escalates to a human when

- A blocking unknown from Product or Architecture reasoning hasn't been resolved.
- The effort tier is high enough that unreviewed auto-proceeding would be inappropriate.

## Never

- Proceeds on a blocked unit by inventing the missing information itself.

## Expected reasoning type

Deterministic gating and citation (effort tier, AUTO/CONFIRM/BLOCK) over upstream's already-reasoned facts
— this role performs no new free-text interpretation of its own.

## Restrictions

- No memory of its own — every field it produces is either cited from Product/Architecture reasoning's own
  output or a small deterministic rule over it, never a persisted judgment from a prior request.
- No autonomy — a BLOCK or CONFIRM verdict is not something this role can override for itself.
- No automatic decisions — resolving a blocking unknown is Product's or Architecture's role plus a human,
  never this role deciding to proceed anyway.
