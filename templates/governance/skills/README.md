# Skills

A skill is a unit of operational knowledge for an agent — a specialized procedure for a specific kind of task,
not a role (a perspective to reason from) and not a workflow (the process for a whole kind of work). A
workflow recommends which skills apply at which step; a skill describes how to actually do that step well.

A skill does **not**:

- execute code;
- decide anything automatically;
- replace the agent using it.

A skill **defines**:

- when to use it;
- its objective;
- the inputs it expects;
- a recommended process;
- the expected output;
- its constraints — what it explicitly does not cover or authorize.

## Format

Each skill lives in its own directory under `.juntia/governance/skills/<skill-name>/SKILL.md`, with a YAML
frontmatter block followed by a short explanatory body:

```markdown
---
name: skill-name
description: One sentence — what this skill is for.
role: which role this skill is normally used from (product | architect | engineer | qa) — or a short
  cross-cutting description when a skill is genuinely usable from any role (see governance-review/SKILL.md)
when_to_use: A short, concrete trigger condition.
inputs:
  - what this skill needs to be given before it's useful
process:
  - step 1
  - step 2
expected_output: What a completed use of this skill produces.
constraints:
  - what this skill explicitly does not do or authorize
---

A short prose explanation, for a human or agent reading the file directly rather than parsing the
frontmatter.
```

No skill engine reads or executes this format yet — these files are read directly by whichever agent is
doing the work, the same way `.juntia/agent-instructions.md` and the role files already are. See
`phases/15b-knowledge-layer.md` for why a skill executor is deliberately not built this phase.

This directory starts with seven skills — enough to validate the model, not a full library:

- `feature-planning/` (Product)
- `architecture-review/` (Architect)
- `implementation/` (Engineer)
- `testing-strategy/` (QA)
- `product-decision-making/` (Product) — recognizing and escalating a real product unknown as a decision
  request, rather than guessing (Phase 15F).
- `architecture-decision-record/` (Architect) — documenting a real technical tradeoff and escalating it as a
  decision request (Phase 15F).
- `governance-review/` (any role) — recognizing the moment a workflow-declared decision area becomes
  concretely relevant, whatever step of the workflow you're in, checking whether it's already pending or
  decided, and escalating it right then — not saved up for one pass before implementing starts, and not
  discovered only once a value has already been silently guessed into code (Phase 15G; timing fixed in the
  Just-In-Time Governance phase after a second real dogfooding session found the single-pass version
  recreated the exact gap it was built to close).
