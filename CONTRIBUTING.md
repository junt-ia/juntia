# Contributing

Juntia is in early development. A first real core and CLI exist (see `README.md`), but there's no released
package yet and no formal review process beyond normal git hygiene.

## Setup

```
git clone https://github.com/junt-ia/juntia.git
cd juntia
npm test
```

Zero dependencies beyond Node's own `node:test`/`node:assert`/`node:child_process` — nothing to install.

## Conventions

- Every module in `lib/` is a plain, dependency-free function (or a small set of them) with a real
  regression test in `test/` — no class hierarchies, no framework.
- Juntia classifies and governs; it does not reason about what to build. A module never interprets free text
  into anything beyond a classification (intent, workflow, governance level) — see `lib/governance/
  intent-model.js`/`lib/governance/governance-signals.js` for the pattern, and
  `phases/governance-level-dynamic-and-legacy-cleanup.md` for the phase that retired the earlier modules
  that crossed this line.
- `lib/runtime/` is the only part of the codebase allowed to know about a specific AI provider
  (`claude-cli-adapter.js`); nothing else should import a vendor-specific detail directly.
- Only `lib/index.js`'s exports are public. `package.json`'s `exports` map enforces this at the package
  level (a deep `require('@juntia/juntia/lib/...')` from outside the package fails) — adding a new
  internal module never requires touching that map; adding a new *public* function does, deliberately, so
  it can't happen by accident.

## Questions about direction

Open an issue — see [`docs/VISION.md`](docs/VISION.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for what Juntia is trying to be, and [`docs/RUNTIME_INTEGRATION.md`](docs/RUNTIME_INTEGRATION.md) for the
runtime-integration boundary.
