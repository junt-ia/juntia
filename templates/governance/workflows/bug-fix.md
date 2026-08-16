# Workflow: Bug fix

Scaffolded once by `juntia init` — Juntia's own recommended process for this kind of work, the same for every
project. Edit freely once scaffolded; Juntia does not regenerate this file.

## Goal

Correct a real deviation from expected behavior — without guessing at a fix for a symptom before the actual
cause is understood.

## When to use

Something should work but doesn't — the request describes a deviation or failure, not a new capability.

## Sequence

```
QA (reproduce) -> Engineer (fix) -> QA (validate)
```

1. Reproduce the bug for real before changing anything.
2. Investigate the real cause — do not guess at a fix for a symptom.
3. Modify.
4. Validate — confirm the original reproduction no longer fails, and nothing else regressed.

## Roles involved

- **QA** — first and last: confirms the bug is real and reproducible before any change, and confirms the fix
  actually resolves it afterward.
- **Engineer** — investigates the real cause and implements the fix.
- **Architect** — only if the root cause turns out to be architectural (e.g. a real data-model or
  ownership issue, not a local logic error) — most bug fixes never need this.

## Skills recommended

- `implementation` — for the investigate/modify steps.
- `testing-strategy` — for reproducing and validating.

## Expected outputs

- A fix whose reproduction case now passes, with no observed regression elsewhere.
- If the cause was a misunderstanding of an existing decision (not the code itself), that gap is worth
  surfacing explicitly rather than only patching the symptom.

## Recommended governance level

**LIGHT** by default — an ordinary bug fix needs no human confirmation to proceed once the fix is validated.
Escalates to **STANDARD** if the fix touches a category `architecture-review` would flag (persistence,
integration, security, ownership, performance); escalates further to **STRICT** only if the root cause is
itself an architectural issue requiring a real decision, not just a code change.
