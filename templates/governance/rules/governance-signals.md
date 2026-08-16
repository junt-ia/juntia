# Governance Signals

A small, curated catalog of named, declarable signals that adjust a workflow's governance level away from its
own default — up (more review) or down (less). Not a checklist Juntia evaluates against your request's text:
Juntia never reads free text to decide whether a signal applies (see `.juntia/governance/rules/
decision-triggers.md`'s own boundary — the same discipline applies here). You (the agent, or a human via
`juntia route "..." --signal <name>`) decide whether a signal genuinely applies to the change in front of you,
then declare it explicitly. Juntia only computes the deterministic result of what you declared.

When no signal is declared, the workflow's own default level applies unchanged — exactly today's behavior.
When one or more recognized signals are declared, the final level is the **highest** level named among them —
a single `strict`-mapped signal always wins over any number of `light`/`standard` ones, and a request with
only `light`-mapped signals can resolve below its workflow's own default (e.g. an isolated, dependency-free
change under `feature-development`, whose own default is STANDARD).

Scaffolded once by `juntia init` and never overwritten after that — this file is yours to edit, extend, or
trim once it exists.

## documentation_only

- **Level:** light
- **Reason:** Only documentation changes — no code, no behavior change, nothing to regress.

## isolated_change

- **Level:** light
- **Reason:** Confined to a single, self-contained area with no cross-cutting impact on the rest of the
  system.

## new_functionality

- **Level:** standard
- **Reason:** Introduces an ordinary new capability — the common case a workflow's own default level is
  already calibrated for.

## behavior_change

- **Level:** standard
- **Reason:** Changes the observable behavior of something that already exists, within its current shape —
  no new dependency, no data-model or architectural change.

## tests_required

- **Level:** standard
- **Reason:** Needs real test coverage before it can be considered done — ordinary diligence, not by itself a
  sign of high impact.

## new_dependency

- **Level:** strict
- **Reason:** Adds a new external dependency — a real, lasting cost and a real technical-boundary change. Same
  situation `decision-triggers.md`'s own `new_dependency` trigger names.
- **Decision type:** architecture

## architecture_change

- **Level:** strict
- **Reason:** Changes a foundational, hard-to-reverse structural aspect of the system — not an ordinary
  implementation detail.
- **Decision type:** architecture

## data_model_change

- **Level:** strict
- **Reason:** Changes how state is shaped or persisted. Hard to reverse once real data exists under the old
  shape. Same situation `decision-triggers.md`'s own `data_model_change` trigger names.
- **Decision type:** architecture

## security_impact

- **Level:** strict
- **Reason:** Touches authentication, authorization, or sensitive data handling — a category that always
  warrants human confirmation before proceeding, regardless of how confident the change looks.
- **Decision type:** architecture

## breaking_change

- **Level:** strict
- **Reason:** Changes or removes existing behavior in a way that breaks an existing caller, integration, or
  contract.
- **Decision type:** architecture
