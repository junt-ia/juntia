# Vision

## The core split

**AI interprets. Juntia governs.**

Juntia does not compete with AI coding runtimes at the thing they're good at — understanding free-text intent, reasoning about code, generating implementations. It owns the layer around that: the parts of building software that stay true regardless of which runtime or model is doing the interpreting.

## What Juntia is responsible for

- **Context** — what the project is, what's already been decided, what the architecture looks like, what's still unknown.
- **Decisions** — surfacing them explicitly, recording them, never letting them get silently invented by whichever runtime happens to be generating code at the time.
- **Rules and governance** — the constraints a project has (technical, product, organizational) that any implementation, human- or AI-authored, needs to respect.
- **Validation** — checking that what got built matches what was actually asked for and decided.
- **Workflows** — the proportional shape of how a task should move from intent to a validated result, scaled to the task's own complexity.
- **Runtime integration** — the boundary Juntia exposes to whichever AI coding runtime a developer is using, so that runtime can request context and report back without needing to know anything about the developer's other tools.

## What external models are responsible for

- **Interpretation** of free-text human intent.
- **Reasoning** about how to satisfy that intent given the code and context available.
- **Generation** of the actual implementation.

## Why this split

A developer using AI to write code still has to be the one who understands the system being built — what was built, why, and what tradeoffs were made. Juntia's job is to make that understanding possible to sustain even as the pace and volume of AI-generated change increases, without trying to be the thing doing the generating.
