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

Early development / product bootstrap. A first, real core exists: a deterministic reasoning pipeline
(product/architecture/engineering analysis, intent classification, a validated runtime-escalation bridge)
and a minimal CLI. There is no packaged release, no runtime integration beyond a Claude Code adapter used
internally by the bridge, and no documented stability guarantee yet — treat every export as subject to
change until a real version is published.

## Installing / using it today

Not published to npm yet. To try it from a local clone:

```
git clone https://github.com/junt-ia/juntia.git
cd juntia
npm test        # 267/267, zero dependencies beyond Node itself
node bin/juntia.js init   # scaffolds .juntia/ in the current directory
```

`juntia init` is the only real command today. It creates a `.juntia/` directory (`config.yml`,
`PROJECT_STATE.md`, `DECISIONS.md`, `RULES.md`, `ARCHITECTURE.md`, `roles/*.md`) in whatever directory you
run it from — nothing is read, analyzed, or sent anywhere, and running it again never overwrites a file
that's already there. See [`docs/CLI.md`](docs/CLI.md) for the full public command surface (including
`analyze`/`update`/`integrate`, designed but not built yet) and
[`docs/RUNTIME_INTEGRATION.md`](docs/RUNTIME_INTEGRATION.md) for how Juntia talks to an AI runtime and why
nothing beyond `init` exists yet.

The reasoning core is usable programmatically:

```js
const { classifyIntent, analyzeProduct, analyzeArchitecture, analyzeEngineering, interpretIntent } = require('juntia');

const intent = classifyIntent('Quiero que los clientes VIP tengan un descuento del 10%');
```

See [`lib/index.js`](lib/index.js) for the exact exported surface. This is a real, tested API, not a
stable one yet — no version has been published, and the shape may still change.

## Where this comes from

Juntia was discovered during development work in [`junt-ia/juntia-research`](https://github.com/junt-ia/juntia-research) *(planned — not yet created)*, which preserves the full history of how Juntia came to exist, including rejected approaches. This repository is the product going forward, not a fork of that history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
