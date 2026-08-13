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
- Reasoning modules (`intent-router.js`, `product-reasoning.js`, `architecture-reasoning.js`,
  `engineering-reasoning.js`) never invent a fact — an unknown stays an explicit unknown rather than a
  guessed default. See any of their test files for the pattern.
- `lib/runtime/` is the only part of the codebase allowed to know about a specific AI provider
  (`claude-cli-adapter.js`); nothing else should import a vendor-specific detail directly.

## Questions about direction

Open an issue — see [`docs/VISION.md`](docs/VISION.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for what Juntia is trying to be, and [`docs/RUNTIME_INTEGRATION.md`](docs/RUNTIME_INTEGRATION.md) for the
runtime-integration boundary.
