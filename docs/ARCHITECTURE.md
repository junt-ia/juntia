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

This is intentionally a one-diagram document at this stage of the product. Real module boundaries, APIs, and a CLI surface are scoped in a later phase (see `junt-ia/juntia-research` for how that decision gets made), not designed here.
