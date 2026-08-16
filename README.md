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

Beta (0.x). `@juntia/juntia` is a real, published, installable package: a deterministic reasoning pipeline
(product/architecture/engineering analysis, intent classification, a validated runtime-escalation bridge), a
full FACT → INTERPRETATION → CONFIRMATION → DECISION → CONTEXT project-memory cycle, a one-command onboarding
flow (`juntia setup`), a real Claude Code integration, and a complete, real CI/release pipeline — all
verified end-to-end against real external projects, not just this repository's own tests. It stays in `0.x`
deliberately: the user experience is still evolving, real dogfooding beyond this project's own validation
isn't done yet, and the public API can still change. See [`docs/RELEASE.md`](docs/RELEASE.md) for what
version numbers mean here and [`CHANGELOG.md`](CHANGELOG.md) for exactly what shipped in each one.

## Installing

```
npm install -D @juntia/juntia   # recommended: pinned per-project, works the same for every teammate and in CI
npm install -g @juntia/juntia   # simpler for a quick, single-machine try — not recommended for a real team project
```

See [`docs/RELEASE.md`](docs/RELEASE.md#installing-juntia-local-vs-global-evaluated) for the full local-vs-global
evaluation.

## Using it

```
npx juntia setup
```

That's it for getting started — `setup` walks through everything: it initializes the project if needed,
analyzes it, reviews anything your AI agent already proposed (if `.juntia/pending.json` has items from an
earlier session — your confirmation before anything is recorded as a decision), builds `.juntia/context.md`,
asks which AI assistant you use, and configures that integration. Safe to run again any time — it never
repeats a step that's already done, and never overwrites a real file it didn't create itself.

```
$ npx juntia setup

Welcome to Juntia.

Initializing project...
✓ Created .juntia

Analyzing project...

Detected:

✓ TypeScript
✓ Phaser
✓ Vite

Generating project understanding...
✓ Facts generated

✓ Context refreshed

Which AI assistant do you use?
  1. Claude Code
> 1

Configuring Claude Code...
✓ CLAUDE.md created
✓ Connected project context

Juntia is ready.
Open Claude Code — it will find CLAUDE.md and load Juntia's governance from there.
```

### Advanced: the individual commands

`setup` coordinates these — none of them went away, and each is still fully usable and scriptable on its own:

```
npx juntia init                 # scaffolds .juntia/ in the current directory
npx juntia analyze              # inventories the current directory and remembers what it found
npx juntia analyze --explain    # also refreshes .juntia/agent-instructions.md, the handoff for your own AI agent
npx juntia confirm              # you review each pending interpretation — yes becomes a decision, no discards it
npx juntia context              # (re)builds .juntia/context.md from confirmed facts + confirmed decisions
npx juntia integrate claude-code  # generates CLAUDE.md so Claude Code finds everything above automatically
npx juntia route "<what you want to do>"  # classifies a request and resolves the workflow to follow
```

`init` creates a `.juntia/` directory (`config.yml`, `PROJECT_STATE.md`, `DECISIONS.md`, `RULES.md`,
`ARCHITECTURE.md`, and the Knowledge Layer under `governance/` — `rules/`, `workflows/`, `roles/`, `skills/`,
`conventions/`) in whatever directory you run it from — nothing is read, analyzed, or sent anywhere, and
running it again never overwrites a file that's already there; every file scaffolded is a static, declarative
artifact you're free to edit once it exists, never silently regenerated later. `analyze` detects languages,
declared dependencies, recognized config files, and top-level structure — purely mechanical (no AI, no
interpretation, no project "type" guessed) — and persists what it found to `.juntia/facts.json`
(git-ignored by default): the first run creates that baseline, every run after that reports what's
Added/Removed/Changed since last time.

Juntia does not execute an AI runtime itself, for any command — `--explain` (opt-in, plain `analyze` never
touches it) refreshes `.juntia/agent-instructions.md`: a deterministic handoff explaining, to whichever AI
agent you already have open, how to interpret those same real facts and where to write its proposal
(`.juntia/pending.json`). Every claim it makes must cite a real fact by an exact identifier; a citation that
doesn't match a real fact is rejected outright, not silently trusted, before a human ever sees it.

Nothing becomes a decision until a human says so: `juntia confirm` walks you through each valid pending
interpretation and asks. Answering yes writes a real, traceable decision to `.juntia/decisions.json` and
appends a plain-English line to `.juntia/DECISIONS.md`; answering no discards it. A confirmed decision is
never deleted or silently rewritten by a later `analyze` — if the facts it cited change, it's flagged
`conflicted` for you to review, not erased. `juntia context` assembles `.juntia/context.md` from confirmed
facts and confirmed decisions only — never from something still pending.

Juntia's context is only useful if an agent actually reads it: `juntia integrate claude-code` generates
`CLAUDE.md` at your project root — a minimal, real **entry point** (Phase 15D), never a full index: it says
this project uses Juntia Governance and points Claude Code at `.juntia/BOOTSTRAP.md`, which is where the real
navigation lives (`context.md`, `DECISIONS.md`, the Knowledge Layer, `agent-instructions.md`, and how to get
the workflow/roles/skills for a *specific* request via `juntia route`, without reading everything up front). No
copy of any of their content, no AI call, nothing sent anywhere, and it never overwrites a `CLAUDE.md` you
already wrote yourself. Other runtimes (Codex, Gemini, Cursor) are architecturally supported but not built
yet — no real evidence for their own conventions exists in this repo yet, so nothing was guessed at.

`juntia route "<request>"` (Phase 15C, extended Phase 15D) is the Workflow Routing Engine: it classifies a
free-text request into one of `feature`/`bug`/`investigation`/`refactor` (or `unknown`, when there isn't
enough signal — it never guesses a workflow), resolves the matching `.juntia/governance/workflows/*.md` file,
and prints an Agent Context — `{ task: { intent, confidence }, workflow: { name, governanceLevel }, roles,
skills, contextSources }`, navigation only, never a solution — plus writes `.juntia/task-handoff.md` for
whichever AI agent you're working with. Juntia still never decides *how* to build anything; it only decides
which process applies. `route` also refreshes `.juntia/BOOTSTRAP.md`, so it always reflects whether a task
handoff currently exists.

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
the exact exported surface. This is a real, tested API, not a stable one yet — Juntia is still in `0.x`
(see [`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x)), so the shape may still change.

## Where this comes from

Juntia was discovered during development work in [`junt-ia/juntia-research`](https://github.com/junt-ia/juntia-research) *(planned — not yet created)*, which preserves the full history of how Juntia came to exist, including rejected approaches. This repository is the product going forward, not a fork of that history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
