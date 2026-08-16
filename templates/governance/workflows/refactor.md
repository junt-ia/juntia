# Workflow: Refactor

Scaffolded once by `juntia init` — Juntia's own recommended process for this kind of work, the same for every
project. Edit freely once scaffolded; Juntia does not regenerate this file.

## Goal

Restructure existing code — naming, organization, module boundaries — without changing its observable
behavior. The test of a correct refactor is that nothing outside the code itself notices it happened.

## When to use

The request is explicitly about structure (reorganize, extract, rename, move to modules, clean up) with no
stated change in what the system does.

## Sequence

1. Confirm the change is genuinely behavior-preserving — if it isn't, it's a `feature-development.md` or
   `bug-fix.md` request wearing a refactor's name, not this workflow.
2. Review the existing architecture and any decision that shaped the code being touched — a refactor that
   quietly reverses a real, documented decision is not a pure refactor anymore.
3. Implement.
4. Validate — the existing test suite is the primary evidence a refactor stayed behavior-preserving; a
   refactor with no test coverage over the area it touches is a real, worth-naming risk, not a green light.

## Roles involved

- **Engineer** — always: does the restructuring itself.
- **Architect** — only if the refactor touches a category `architecture-review` would flag (e.g. a large
  module boundary change with real cross-cutting impact) — most refactors do not need this.

## Skills recommended

- `implementation` — for the restructuring itself.
- `testing-strategy` — specifically for regression coverage, since correctness here means "nothing changed,"
  not "something new works."

## Expected outputs

- Restructured code with identical observable behavior, confirmed by the existing (or extended, if coverage
  was thin) test suite.
- No new `.juntia/DECISIONS.md` entry expected — if one seems necessary, the change stopped being a pure
  refactor partway through, and that's worth naming explicitly rather than quietly proceeding.

## Recommended governance level

**STANDARD** by default — regression validation is the real gate, not human confirmation. Escalates to
**STRICT** only if the refactor touches persistence, security, or ownership (e.g. reshaping a data model,
even without changing its meaning) — the same categories that always require confirmation regardless of
confidence.
