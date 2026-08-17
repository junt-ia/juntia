# Architecture (conceptual)

This document describes the conceptual shape of where Juntia sits, not an implementation. No API, module boundary, or technology choice is finalized here.

```
Developer
   |
   v
IDE / AI coding runtime  (Claude Code, Codex, Gemini, ...)
   |
   v
Juntia
   |
   v
Project
```

- The **developer** expresses intent, and remains the one who needs to understand what gets built.
- The **AI coding runtime** is whatever tool the developer is already using to interpret intent and generate code. Juntia does not replace it.
- **Juntia** sits between the runtime and the project: supplying context, applying governance, and validating outcomes, regardless of which runtime is in use.
- The **project** is the actual codebase being built and evolved.

Juntia is designed to be runtime-agnostic at this layer — nothing in this shape assumes a specific AI provider.

## Public API vs. internal engine

Inside the "Juntia" box above, there are two layers a developer should think about differently:

```
Juntia
  |
  ├── Public API            juntia setup | init | analyze [--explain] | confirm | context
  |                         | integrate <runtime> | update | route "<request>" [--signal <name>]...
  |                         require('juntia') -- classifyTaskIntent, routeWorkflow
  |
  └── Internal engine       the Knowledge Layer resolver, the Intent Model, the
                             Workflow Routing Engine behind `route`, governance
                             signal evaluation, provider adapters (see docs/CLI.md)
```

A single architecture, not two: an earlier "legacy reasoning" layer (intent router, product/architecture/
engineering reasoning, a runtime bridge that called an AI model from inside Juntia to interpret a request) was
removed in the Governance Level Dynamic and Legacy Cleanup phase — see
[`../phases/governance-level-dynamic-and-legacy-cleanup.md`](../phases/governance-level-dynamic-and-legacy-cleanup.md).

A developer using Juntia should only ever need to think in terms of the Public API — "I want to add a
feature," not "I need to run architecture reasoning." The internal engine decides which of its own pieces a
request needs; none of those pieces are meant to become their own CLI command without real evidence a
developer needs to invoke them directly. See [`docs/CLI.md`](CLI.md) for the public command definitions and
[`docs/RUNTIME_INTEGRATION.md`](RUNTIME_INTEGRATION.md) for how the internal engine talks to an AI runtime.

This is intentionally a small, low-detail document at this stage of the product. Real module boundaries, APIs, and a CLI surface are scoped in a later phase (see `junt-ia/juntia-research` for how that decision gets made), not designed here.
