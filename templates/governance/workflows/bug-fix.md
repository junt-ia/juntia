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

If, at step 2 or 3, what "correct" behavior actually means turns out to be genuinely undecided (see "Decisions
this workflow may require" below) — escalate it via `governance-review` right then, and pause only the part
of the fix that depends on the answer. This is rare for an ordinary bug fix; when it happens, it usually means
step 2 uncovered more than a local logic error.

## Roles involved

- **QA** — first and last: confirms the bug is real and reproducible before any change, and confirms the fix
  actually resolves it afterward.
- **Engineer** — investigates the real cause and implements the fix.
- **Architect** — only if the root cause turns out to be architectural (e.g. a real data-model or
  ownership issue, not a local logic error) — most bug fixes never need this.

## Skills recommended

- `implementation` — for the investigate/modify steps.
- `testing-strategy` — for reproducing and validating.
- `governance-review` — only if investigating the cause surfaces a genuine "Decisions this workflow may
  require" unknown below; most bug fixes never need it.

## Decisions this workflow may require

- **Architecture decision** — only if the root cause turns out to be architectural (see "Roles involved"
  above) and fixing it correctly requires a real, hard-to-reverse tradeoff.
  - `regression_source` — which real, prior change actually introduced the regression, when that itself is
    unclear.
  - `compatibility` — whether the fix can stay backward-compatible, or a real breaking change is unavoidable.
- **Product decision** — rare: an ordinary bug fix corrects a deviation from an already-decided behavior, it
  doesn't introduce a new one. Only when the "correct" behavior itself turns out to be genuinely undecided.
  - `expected_behavior` — what "correct" actually means here, when no existing decision already says so.

Write either as a `type: "product"` or `type: "architecture"` pending item in `.juntia/pending.json` — a
question, never a proposed answer (see `.juntia/governance/rules/agent-rules.md`) — surface it rather than
guessing what "correct"/"compatible" should mean.

## Expected outputs

- A fix whose reproduction case now passes, with no observed regression elsewhere.
- If the cause was a misunderstanding of an existing decision (not the code itself), that gap is worth
  surfacing explicitly rather than only patching the symptom.

## Recommended governance level

**LIGHT** by default — an ordinary bug fix needs no human confirmation to proceed once the fix is validated.
Escalates to **STANDARD** if the fix touches a category `architecture-review` would flag (persistence,
integration, security, ownership, performance); escalates further to **STRICT** only if the root cause is
itself an architectural issue requiring a real decision, not just a code change.
