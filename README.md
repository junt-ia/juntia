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
(product/architecture/engineering analysis, intent classification, a validated runtime-escalation bridge), a
full FACT → INTERPRETATION → CONFIRMATION → DECISION → CONTEXT project-memory cycle, a real Claude Code
integration, and a complete, real CI/release pipeline (`.github/workflows/ci.yml`,
`.github/workflows/release.yml`) — verified end-to-end against real external projects, not just this
repository's own tests. **There is no npm release yet** (nothing has been published under `@juntia/juntia`),
no runtime integration beyond Claude Code, and no documented stability guarantee — treat every export as
subject to change before a real `1.0.0`. See [`docs/RELEASE.md`](docs/RELEASE.md) for what publishing will
actually involve and what version numbers will mean once it happens.

## Installing

Package name: **`@juntia/juntia`**. Not published to npm yet. Once published:

```
npm install -D @juntia/juntia   # recommended: pinned per-project, works the same for every teammate and in CI
npm install -g @juntia/juntia   # simpler for a quick, single-machine try — not recommended for a real team project
```

See [`docs/RELEASE.md`](docs/RELEASE.md#installing-juntia-local-vs-global-evaluated) for the full local-vs-global
evaluation. Until a real release exists, install directly from a tarball — this is the exact mechanism
verified against multiple real, external projects, not just described:

```
git clone https://github.com/junt-ia/juntia.git
cd juntia
npm pack                                   # builds @juntia/juntia-0.1.0.tgz
cd /path/to/your/project
npm install -D /path/to/juntia/juntia-juntia-0.1.0.tgz
```

## Using it

```
npx juntia init                 # scaffolds .juntia/ in the current directory
npx juntia analyze              # inventories the current directory and remembers what it found
npx juntia analyze --explain    # also asks an AI runtime for an interpretation, saved as pending
npx juntia confirm              # you review each pending interpretation — yes becomes a decision, no discards it
npx juntia context              # (re)builds .juntia/context.md from confirmed facts + confirmed decisions
npx juntia integrate claude-code  # generates CLAUDE.md so Claude Code reads that context automatically
```

`init`, `analyze`, `confirm`, `context`, and `integrate` are the real commands today. `init` creates a
`.juntia/` directory (`config.yml`, `PROJECT_STATE.md`, `DECISIONS.md`, `RULES.md`, `ARCHITECTURE.md`,
`roles/*.md`) in whatever directory you run it from — nothing is read, analyzed, or sent anywhere, and
running it again never
overwrites a file that's already there. `analyze` detects languages, declared dependencies, recognized
config files, and top-level structure — purely mechanical (no AI, no interpretation, no project "type"
guessed) — and persists what it found to `.juntia/facts.json` (git-ignored by default): the first run
creates that baseline, every run after that reports what's Added/Removed/Changed since last time.

`--explain` (opt-in only — plain `analyze` never calls an AI runtime or spends anything) sends those same
real facts to the same authenticated Claude Code CLI session already used for intent interpretation, prints
its interpretation to the console — clearly labeled as non-authoritative — and saves it as a pending item in
`.juntia/pending.json`. Every claim it makes must cite a real fact by an exact identifier; a citation that
doesn't match a real fact is rejected outright, not silently trusted.

Nothing becomes a decision until a human says so: `juntia confirm` walks you through each pending
interpretation and asks. Answering yes writes a real, traceable decision to `.juntia/decisions.json` and
appends a plain-English line to `.juntia/DECISIONS.md`; answering no discards it. A confirmed decision is
never deleted or silently rewritten by a later `analyze` — if the facts it cited change, it's flagged
`conflicted` for you to review, not erased. `juntia context` assembles `.juntia/context.md` from confirmed
facts and confirmed decisions only — never from something still pending.

Juntia's context is only useful if an agent actually reads it: `juntia integrate claude-code` generates a
short `CLAUDE.md` at your project root pointing Claude Code at `.juntia/context.md` — no copy of the content,
no AI call, nothing sent anywhere, and it never overwrites a `CLAUDE.md` you already wrote yourself. Other
runtimes (Codex, Gemini, Cursor) are architecturally supported but not built yet — no real evidence for their
own conventions exists in this repo yet, so nothing was guessed at.

See [`docs/CLI.md`](docs/CLI.md) for the full public command surface (`update` still designed, not built) and
[`docs/PROJECT_INTELLIGENCE.md`](docs/PROJECT_INTELLIGENCE.md) /
[`docs/CONTEXT_SYNTHESIS.md`](docs/CONTEXT_SYNTHESIS.md) / [`docs/RUNTIME_INTEGRATION.md`](docs/RUNTIME_INTEGRATION.md)
for the full model.

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
