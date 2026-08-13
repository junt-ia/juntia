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
(product/architecture/engineering analysis, intent classification, a validated runtime-escalation bridge),
a deterministic project-inventory layer, and a real, installable package — verified end-to-end from a real
external project, not just this repository's own tests. There is no npm release yet, no runtime integration
beyond a Claude Code adapter used internally by the bridge, and no documented stability guarantee — treat
every export as subject to change before a real `1.0.0`.

## Installing

Package name: **`@juntia/juntia`**. Not published to npm yet (this is still early development). Once
published, installation will be:

```
npm install @juntia/juntia
```

Until then, install directly from a local clone — this is the exact mechanism verified against a real,
external project during this phase, not just described:

```
git clone https://github.com/junt-ia/juntia.git
cd juntia
npm pack                                   # builds @juntia/juntia-0.1.0.tgz
cd /path/to/your/project
npm install /path/to/juntia/juntia-juntia-0.1.0.tgz
```

## Using it

```
npx juntia init      # scaffolds .juntia/ in the current directory
npx juntia analyze   # prints a deterministic inventory of the current directory
```

`init` and `analyze` are the only two real commands today. `init` creates a `.juntia/` directory
(`config.yml`, `PROJECT_STATE.md`, `DECISIONS.md`, `RULES.md`, `ARCHITECTURE.md`, `roles/*.md`) in whatever
directory you run it from — nothing is read, analyzed, or sent anywhere, and running it again never
overwrites a file that's already there. `analyze` detects languages, declared dependencies, recognized
config files, and top-level structure — purely mechanical (no AI, no interpretation, no project "type"
guessed) and read-only (nothing is written to `.juntia/` yet). See [`docs/CLI.md`](docs/CLI.md) for the full
public command surface (`update`/`integrate` still designed, not built) and
[`docs/PROJECT_INTELLIGENCE.md`](docs/PROJECT_INTELLIGENCE.md) for `analyze`'s exact knowledge model.

The reasoning core is usable programmatically:

```js
const { classifyIntent, analyzeProduct, analyzeArchitecture, analyzeEngineering, interpretIntent } = require('@juntia/juntia');

const intent = classifyIntent('Quiero que los clientes VIP tengan un descuento del 10%');
```

Only this documented surface is importable — `require('@juntia/juntia/lib/...')` (any internal module) is
blocked by the package's own `exports` map, not just by convention. See [`lib/index.js`](lib/index.js) for
the exact exported surface. This is a real, tested API, not a stable one yet — no version has been
published, and the shape may still change.

## Where this comes from

Juntia was discovered during development work in [`junt-ia/juntia-research`](https://github.com/junt-ia/juntia-research) *(planned — not yet created)*, which preserves the full history of how Juntia came to exist, including rejected approaches. This repository is the product going forward, not a fork of that history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
