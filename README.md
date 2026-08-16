# Juntia

**Governance layer for AI-assisted development.**

Juntia is not an AI assistant, not an autonomous agent, and not a reasoning engine. It's the deterministic
layer that sits next to whichever AI coding tool you already use — Claude Code today — and gives it project
context, memory, decisions, rules, workflows, roles, skills, and a real routing/handoff contract, so that tool
can work inside your project's actual, accumulated understanding instead of starting cold every session.

The short version: **AI interprets. Juntia governs.**

## What problem it solves

Juntia helps you:

- keep project context (product intent, architecture, decisions) alive across sessions instead of re-deriving it every time;
- reduce information loss between a human's intent and what gets built;
- make technical and product decisions more explicit before they become code;
- give a connected AI agent a real, discoverable process to follow — which workflow applies, which roles and
  skills matter, what context to read — without a human re-explaining the project's architecture every time;
- apply consistent engineering practices as a project evolves.

## What Juntia is not

- **Not an AI assistant.** It doesn't chat, answer questions, or generate responses.
- **Not an autonomous agent.** It never reasons about what to build, never decides a technical solution, never
  implements anything, and never acts without a human confirming what matters.
- **Not a reasoning engine.** It classifies the *kind* of work a request is and points at the right process —
  it does not interpret free text into a plan the way an AI model does.
- **Not a replacement for Claude Code, Codex, Cursor, or any other AI coding runtime.** It sits alongside them,
  preparing the environment they work in.
- **Not an IDE.**
- **Not tied to one AI provider.** Juntia is designed to work with whichever runtime a developer is already
  using — Claude Code is the first real integration; others are architecturally supported, not yet built.

## What Juntia provides

- **Context** — what the project is: confirmed facts, technologies, structure (`.juntia/context.md`).
- **Project memory** — a persisted, diffable factual baseline that survives across sessions.
- **Decisions** — a real record of what's been confirmed by a human, and why (`.juntia/DECISIONS.md`).
- **Rules** — both project-specific (`.juntia/RULES.md`, human-authored) and Juntia's own standing governance
  rules (`.juntia/governance/rules/agent-rules.md`).
- **Workflows** — the recommended process per kind of work: feature development, bug fix, investigation,
  refactor (`.juntia/governance/workflows/`).
- **Roles** — the perspective to reason from for a given piece of work: product, architect, engineer, QA
  (`.juntia/governance/roles/`).
- **Skills** — specialized procedures for a given task (`.juntia/governance/skills/`).
- **Routing** — classifies a free-text request and resolves which workflow/roles/skills/governance level apply
  (`juntia route`).
- **Handoff for external agents** — deterministic, generated files (`CLAUDE.md`, `.juntia/BOOTSTRAP.md`,
  `.juntia/task-handoff.md`) that let a connected agent discover all of the above on its own.

## Status

**Public beta (0.x).** `@juntia/juntia@0.8.0` is the current beta: a deterministic Knowledge Layer (rules,
workflows, roles, skills), a Workflow Routing Engine connecting free-text requests to that layer, a real Agent
Consumption Model (`CLAUDE.md` → `.juntia/BOOTSTRAP.md` → `route` → `.juntia/task-handoff.md`) for Claude Code,
and the full FACT → INTERPRETATION → CONFIRMATION → DECISION → CONTEXT project-memory cycle — all verified
end-to-end against real external projects and a genuinely external (tarball) install, not just this
repository's own tests. It stays in `0.x` deliberately: real dogfooding with a live AI agent hasn't been done
yet, only one runtime (Claude Code) is integrated, and the public API/CLI surface can still change. See
[`docs/RELEASE.md`](docs/RELEASE.md) for what version numbers mean here and [`CHANGELOG.md`](CHANGELOG.md) for
exactly what shipped in each one.

**Known limitations of this beta**, named explicitly rather than left implicit:

- No real session has been run with a live AI agent actually following the generated handoff/bootstrap files
  end to end — the artifact chain is built and tested, but "does a real agent comply with it" remains open.
- Only Claude Code is a real, built integration; Codex/Gemini/Cursor are architecturally supported, not built.
- No automatic role invocation or skill execution — Juntia names the process, an agent still has to read and
  follow it manually.
- Governance levels (LIGHT/STANDARD/STRICT) are a static per-workflow default, not a dynamic risk classifier.
- The six legacy free-text reasoning modules (`classifyIntent`, `analyzeProduct`, `analyzeArchitecture`,
  `analyzeEngineering`, `interpretIntent`) remain in the package for compatibility but are not part of the
  current architecture's vision — see "Programmatic API" below.

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

## The core flow

| Command | What it does |
|---|---|
| `juntia setup` | The recommended entrypoint. Creates the Knowledge Layer (`.juntia/governance/`) if it doesn't exist, analyzes the project, and integrates your AI agent — one command, coordinating everything below. |
| `juntia analyze` | Analyzes the project and updates `.juntia/facts.json` — a deterministic inventory (languages, dependencies, structure), diffed against the previous run. |
| `juntia update` | **Designed, not built yet.** Intended to sync a project's scaffolded Juntia files after an upgrade, without discarding a developer's own edits — see [`docs/CLI.md`](docs/CLI.md#why-update-isnt-built-yet) for why this isn't real yet. |
| `juntia route "<request>"` | Advanced command for inspecting the workflow Juntia would select for a given request — which intent, workflow, governance level, roles, and skills apply — useful for debugging the routing/handoff chain directly. Most of the time an AI agent runs this on its own, discovered via `CLAUDE.md`; a developer doesn't need to type it. |

Juntia is designed to work *alongside* whichever AI coding runtime you already have open — it never replaces
it, never calls it, and never executes any AI model itself. Every command above is fully deterministic.

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

## Programmatic API

The Workflow Routing Engine that powers `juntia route` is also directly importable — the same, current
governance surface, not a separate reasoning layer:

```js
const { classifyTaskIntent, routeWorkflow } = require('@juntia/juntia');

const route = routeWorkflow('Implement VIP customers in the restaurant.', process.cwd());
// -> { intent: 'feature', confidence: 0.9, workflow: 'feature-development', governanceLevel: 'standard',
//      roles: [...], skills: [...], needsClarification: false, reason: '...' }
```

Two older exports (`classifyIntent`, `interpretIntent`) and three (`analyzeProduct`, `analyzeArchitecture`,
`analyzeEngineering`) remain exported for compatibility — a nine-intent, free-text classifier and a
product/architecture/engineering reasoning pipeline built early in this project's history, before the current
Knowledge Layer/routing architecture existed. **They are not part of Juntia's current direction**: attempting
to interpret *what should be built* is exactly the kind of reasoning Juntia's own governing definition keeps
out of scope ("AI interprets. Juntia governs."). They're kept, not removed, because removing tested, working,
still-reachable code without real evidence it's safe to drop would be its own kind of unjustified change — not
because they're recommended for new use. Prefer `classifyTaskIntent`/`routeWorkflow` for anything new.

Only the documented surface above is importable — `require('@juntia/juntia/lib/...')` (any internal module) is
blocked by the package's own `exports` map, not just by convention. See [`lib/index.js`](lib/index.js) for the
exact exported surface. This is a real, tested API, not a stable one yet — Juntia is still in `0.x` (see
[`docs/RELEASE.md`](docs/RELEASE.md#versioning-while-0x)), so the shape may still change.

## Where this comes from

Juntia was discovered during development work in [`junt-ia/juntia-research`](https://github.com/junt-ia/juntia-research) *(planned — not yet created)*, which preserves the full history of how Juntia came to exist, including rejected approaches. This repository is the product going forward, not a fork of that history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
