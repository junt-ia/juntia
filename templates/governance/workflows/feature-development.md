# Workflow: Feature development

Scaffolded once by `juntia init` — Juntia's own recommended process for this kind of work, the same for every
project. Edit freely once scaffolded; Juntia does not regenerate this file.

## Goal

Turn a request for new or changed behavior into a validated, implemented change — without silently
reinterpreting what was asked for, or skipping a step a riskier version of this same request would need.

## When to use

The request introduces something that doesn't exist yet, or changes the behavior of something that already
does.

## Sequence

```
Product -> Architect (if needed) -> Engineer -> QA
```

1. Analyze the impact — what existing components, decisions, or constraints does this touch?
2. Review the existing architecture (`.juntia/context.md`, `.juntia/ARCHITECTURE.md` if present) before
   proposing a new one.
3. Propose a solution, naming any tradeoff.
4. If the proposal affects or conflicts with an existing confirmed decision, wait for confirmation before
   implementing — do not proceed on an assumption.
5. Implement.
6. Validate — run the real tests/build, not just a visual read.

## Roles involved

- **Product** — always: makes the desired behavior and any blocking unknowns explicit before anything is
  built.
- **Architect** — only if the request touches persistence, integration, security, ownership, or performance.
  Most feature work does not need this step; do not invoke it by default.
- **Engineer** — always: turns the reasoned request into an implementation plan and the implementation itself.
- **QA** — always: recommends how the result should be validated against what was actually asked for.

## Skills recommended

- `feature-planning` — for the Product step.
- `architecture-review` — only when the Architect role is engaged.
- `implementation` — for the Engineer step.
- `testing-strategy` — for the QA step.

## Expected outputs

- An implemented, validated change.
- A new or updated `.juntia/DECISIONS.md` entry, if the work surfaced a real decision that needed making.
- No architecture recommendation left unconfirmed — a "considered but not decided" tradeoff belongs in
  `.juntia/DECISIONS.md`'s "Discarded and why" section, not silently dropped.

## Recommended governance level

**STANDARD** by default. Escalates to **STRICT** the moment the request touches persistence, security, or
ownership — human confirmation before implementation becomes mandatory, regardless of how confident the
proposal looks. Can be treated as **LIGHT** only for the smallest, most mechanical additions with no open
unknown and no architectural impact — most feature work does not qualify.
