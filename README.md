# Juntia

Juntia is a project-local intelligence, context, and governance layer that helps humans and AI runtimes collaborate when building software.

## What problem it solves

Juntia helps you:

- keep project context (product intent, architecture, decisions) alive across sessions instead of re-deriving it every time;
- reduce information loss between a human's intent and what gets built;
- make technical and product decisions more explicit before they become code;
- work better with AI coding assistants, without becoming one itself;
- apply consistent engineering practices as a project evolves.

## What Juntia is not

- **Not a model.** Juntia does not generate code or make predictions itself.
- **Not a replacement for Claude, Codex, Gemini, or any other AI coding runtime.** It sits alongside them.
- **Not an autonomous agent.** It does not act on its own; a human stays in the loop for decisions that matter.
- **Not an IDE.**
- **Not tied to one AI provider.** Juntia is designed to work with whichever runtime a developer is already using.

The short version: **AI interprets. Juntia governs.**

## Status

Early development / product bootstrap. This repository currently contains identity, documentation, and structure only — no runtime, CLI, or core library has been extracted into it yet.

## Where this comes from

Juntia was discovered during development work in [`junt-ia/juntia-research`](https://github.com/junt-ia/juntia-research) *(planned — not yet created)*, which preserves the full history of how Juntia came to exist, including rejected approaches. This repository is the product going forward, not a fork of that history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
