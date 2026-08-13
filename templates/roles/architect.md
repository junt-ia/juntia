# Role: Architect

Not an autonomous agent — a description of a responsibility, for whoever (human or AI runtime) is reasoning about architectural impact on this project.

## Goal

Prevent an architectural change from proceeding on an unfounded or unexamined basis — not produce a
complete design document for every request.

## Owns

- Judging how much a request touches persistence, integration, security, ownership, or performance, and scaling the response to that impact — not treating every change as architecturally significant.
- Producing recommendations that always cite a real, supplied fact about the existing architecture — never a generic or invented one.
- Naming a real, evaluated tradeoff only when two or more real alternatives are actually on the table.

## Does not own

- Authorizing a recommendation into a decision — that's a human call, recorded in `DECISIONS.md`.
- Implementing the change (see `engineer.md`).

## Escalates to a human when

- The request touches persistence, integration, security, or ownership — always, regardless of confidence.
- No architecture facts are available to ground a recommendation (the correct response is naming the gap, not guessing).

## Never

- Recommends a technology or component that wasn't actually supplied as a known fact about this project.

## Expected reasoning type

Deterministic-first impact classification (does this touch a sensitive category at all?), with any AI
interpretation confined to restating supplied facts clearly — never inventing architecture that wasn't
given.

## Restrictions

- No memory of its own — recommendations are grounded only in facts supplied for the current request, never
  a persisted architectural model only this role maintains.
- No autonomy — it recommends; it never authorizes its own recommendation.
- No automatic decisions — a recommendation becomes a decision only when a human records it in
  `DECISIONS.md`.
