# Context synthesis

How Juntia turns `analyze`'s deterministic facts into project knowledge, without inventing anything. All
four stages are now real and built: **FACT** (Phase 12I: `.juntia/facts.json`), **INTERPRETATION** (Phase
12J/12K: `juntia analyze --explain`, now persisted to `.juntia/pending.json` rather than console-only),
**CONFIRMATION** (Phase 12K: `juntia confirm`, the only human-operated step, and the only thing that can
ever create a decision), and **DECISION** (Phase 12K: `.juntia/decisions.json` + `.juntia/DECISIONS.md`).
**CONTEXT** (Phase 12K: `.juntia/context.md`) assembles the last two into one human/agent-readable summary.
Full reasoning: `phases/12h-project-context-synthesis-design.md` (design),
`phases/12i-project-facts-persistence.md` (FACT), `phases/12j-context-synthesis-runtime-evaluation.md`
(INTERPRETATION, evaluation), and `phases/12k-context-lifecycle.md` (CONFIRMATION/DECISION/CONTEXT, closing
the full cycle) in `junt-ia/juntia-research` *(planned, not yet created — currently still `claude-toolkit`)*.

## Three tiers, never collapsed

| | FACT | INTERPRETATION | DECISION |
|---|---|---|---|
| Example | `package.json` has a `phaser` dependency | "This looks like a Phaser game" | "This project will keep using Phaser" |
| Who creates it | The deterministic scanner | An AI runtime, via the existing adapter interface | A human |
| Confidence | N/A — observed or not | `high` / `medium` / `low` (the same three values `lib/runtime/project-interpretation-validator.js` defines directly — originally shared with `lib/runtime/validator.js`, which was removed in the Governance Level Dynamic and Legacy Cleanup phase) | N/A |
| Lives in | `.juntia/facts.json` (**built**) | `.juntia/pending.json` (**built**, Phase 12K — Phase 12J's console-only output now also persists here) | `.juntia/decisions.json` + `.juntia/DECISIONS.md` (**built**, Phase 12K) |
| Promotes automatically to the next tier? | Eligible to be cited | **Never** — only `juntia confirm`, answered `y` by a real human, creates a decision | Terminal — but never silently deleted either; see "Decisions and change" below |

A fifth artifact, `.juntia/context.md` (**built**, Phase 12K, via `juntia context`), is not itself a tier —
it's a read-only, regenerable *projection* of the FACT and DECISION tiers, assembled for whatever reads a
project's context next (a human, or a future AI coding runtime). It never contains a pending, unconfirmed
INTERPRETATION.

A fact never becomes knowledge by itself. An interpretation never becomes a decision by itself. This was the
same KNOWN/INFERRED/DECISION_REQUIRED discipline the internal reasoning engine (`lib/product-reasoning.js`,
`lib/architecture-reasoning.js` — both since removed, see `phases/governance-level-dynamic-and-legacy-cleanup.md`)
enforced per-request — applied here to persistent project context for the first time, not a new rule.

## The AI runtime's role

Reuses the existing `adapter.interpret(text, options) -> Promise<RuntimeResponse>` shape (Phase 12F) as-is
— no new adapter method (Phase 12J generalized `lib/runtime/claude-cli-adapter.js` to accept an optional
`systemPrompt`/`schema` pair, defaulting to the original intent guideline, so a second interpretation domain
could plug in without a second adapter file). What surrounds it: `lib/runtime/
project-interpretation-guideline.js` (the system prompt + JSON schema sent to the runtime — serializes
facts + detected changes + existing context into `text`, real-fact identifiers only) and `lib/runtime/
project-interpretation-validator.js` (rejects any response trying to sneak in a `fact`, `decision`,
`confirmed`, `action`, `questions`, or `authorization` field — the same anti-hallucination discipline
`lib/runtime/validator.js` applied to intent interpretation before it was removed, extended to this new
interpretation type). `lib/project-intelligence/context-synthesis-bridge.js` composes all three, mirroring
the shape `lib/intent-runtime-bridge.js` used before it, too, was removed (see
`phases/governance-level-dynamic-and-legacy-cleanup.md`). As of Phase 12K, `EXISTING CONTEXT` in the request text is real,
not a placeholder: it lists every currently-confirmed decision's text (flagging a `conflicted` one inline)
so the runtime can avoid re-proposing something already settled — closing a gap Phase 12J's own text left
open (it always claimed "none persisted yet," which became false the moment `decisions.json` became real).

## When a human gets asked

- A fact is detected → never asks, facts are self-evident.
- An interpretation would be written into a decision-tier file for the first time → **always** confirm,
  regardless of confidence — this is now real: `juntia confirm` asks exactly this question, for every
  pending item, one at a time, and is the only code path that can ever write `.juntia/decisions.json`.
- An interpretation matches a fact set an existing decision already covers → `analyze --explain` says so
  ("This matches an already-confirmed decision...") and does not create a duplicate pending item — skipping
  asking again would be redundant.
- A pending item's cited evidence no longer exists in the current facts → `confirm` does not ask about it
  either; it explains why and discards it, since confirming it would create a decision whose own evidence is
  already gone. The right next step is a fresh `analyze --explain`, not a stale confirmation.

## The FACT tier, concretely (built, Phase 12I)

`.juntia/facts.json` holds a flat, diffable list — one entry per language/technology/dependency/manifest/
config/structure item, each with its own `evidence`, tagged with a `schemaVersion` so an incompatible future
format is detected and treated as `UNKNOWN` rather than misread. `juntia analyze`'s first run on a project
creates this baseline; every run after that loads the previous one, compares it against a fresh scan, and
reports exactly three kinds of change — **Added**, **Removed**, **Changed** (only for facts with a real,
comparable value, like a dependency's version) — never an interpretation of what a change means. The file
is git-ignored by default (`.juntia/.gitignore`, created alongside it) since it's a machine-regenerated
snapshot, not human-authored narrative like `DECISIONS.md`.

## The INTERPRETATION tier, built (Phase 12J design/evaluation, Phase 12K persistence)

`juntia analyze --explain` (opt-in only — plain `analyze` never calls a runtime or spends anything) sends
the real facts `.juntia/facts.json` just persisted, the real diff against the previous baseline, and every
currently-confirmed decision, to the same authenticated Claude Code CLI session Phase 11C already uses for
intent interpretation. Each fact is rendered with a bracket-delimited identifier (`- id:[dependency:phaser]
value:"^3.60.0" evidence:package.json`) that the runtime is instructed to cite verbatim in `basedOn` — found
necessary via a real, live run in Phase 12J: an earlier, unbracketed rendering led a real response to cite
`"dependency:phaser (value: 49)"` as if the trailing annotation were part of the identifier, which the
validator correctly rejected. The validator's grounding check (cross-referencing every `basedOn` entry
against the real fact list) is the one thing this domain's validator does that the intent domain's does
not — the intent domain has a downstream governance layer to catch a fabricated citation later;
INTERPRETATION has no such layer, so this validator is the only line of defense against it, and does not
defer the check.

A valid interpretation is now persisted to `.juntia/pending.json` (Phase 12K — Phase 12J deliberately did not
build this, since no lifecycle policy existed yet; Phase 12K's own `confirm`/`reject` transitions are that
policy). Its id is a deterministic hash of its own `basedOn` set, not the free-text interpretation itself —
two live calls answering "the same question" (same evidence) refresh one pending item instead of piling up
duplicates; a genuinely different evidence set gets a genuinely different id.

## The DECISION tier, built (Phase 12K)

The only code path in this codebase allowed to write `.juntia/decisions.json` is `bin/juntia.js`'s
`runConfirm()`, and it only runs after a real "y" answer to a real, printed question — no AI code path
imports `lib/project-intelligence/decisions-store.js` to write to it. `juntia confirm` walks every pending
item, re-validates its `basedOn` against the *current* `facts.json` (not just trusted from when it was
generated — facts can change between `--explain` and `confirm`), and asks. A stale item (citing a fact that
no longer exists) is never asked about; it's explained and discarded.

**What gets stored is the original interpretation text, verbatim** — never mechanically reworded from a
hedge ("appears to be") into an unqualified claim. Rewording is itself a text-generation step nothing in
this phase performs or the user actually authored; storing exactly the text a human said "yes" to is the
only way the frozen `confidence`/`basedOn`/`unknowns` stay honestly attached to what was really confirmed.

Two writes happen on confirmation, not one: `.juntia/decisions.json` (the structured, machine-consumable
record) and a plain-English line appended to `.juntia/DECISIONS.md` (reusing the file `juntia init` already
scaffolds and its existing "## Active decisions" bullet convention — not a second, competing narrative
format). See "Where decisions live" below for why both exist, evaluated rather than assumed.

## Decision types: interpretation, product, architecture (Phase 15F)

The DECISION tier described above was originally shaped for exactly one kind of uncertainty: "what does the
evidence suggest is true about this project" (an INTERPRETATION, always grounded in real `basedOn` fact
citations). Real dogfooding (`restaurant-game`, M04, against the published `0.8.0` beta) found a second,
structurally different kind: "what should this behave like" — a product decision (a wait-timeout duration, a
reputation-penalty magnitude) or an architecture decision (where a piece of state should live), neither of
which is grounded in a project fact at all. The pre-15F model had no way to represent this — `.juntia/
pending.json`/`decisions.json` never got used for it; `.juntia/DECISIONS.md` was hand-edited directly instead,
completely bypassing Juntia's own structured mechanism. See `phases/15f-decision-model.md` for the full,
real evidence.

`.juntia/decisions.json` now carries a `type` field (`"interpretation"` | `"product"` | `"architecture"`,
defaulting to `"interpretation"` for any record written before this phase — fully backward compatible, no
migration). A product/architecture decision has its own real shape (`question`, `context`, `options`,
`evidence` — free-text, never fact-validated — and `text`, the human's actual answer) instead of
`basedOn`/`confidence`; `detectConflicts()` and `context-generator.js`'s rendering both branch on `type`
explicitly, so a product decision can never be mistaken for (or accidentally validated as) an interpreted
fact, and vice versa.

The mechanism an agent uses to propose one: a decision REQUEST — `{ "type": "product"|"architecture",
"question", "context", "options" }` — written to `.juntia/pending.json`, validated by
`lib/governance/decision-model.js`'s `validateDecisionRequest()` before `juntia confirm` ever asks about it.
That validator forbids the same fields `validateProjectInterpretation` already forbids, plus `text`/
`decision`/`confirmedAt`/`source`/`confidence`/`basedOn` — an agent may propose the QUESTION, never the
ANSWER. `juntia confirm` prompts for a real, human-typed answer for a decision request (free text, or `skip`/
`reject`), the same human-in-the-loop gate the interpretation flow already had, adapted to a genuinely
open-ended question instead of a yes/no one.

## Decision discovery: helping a decision appear before it's guessed into code (Phase 15G)

Phase 15F gave decisions a real model once they appear; it still depended entirely on an agent remembering to
use it. Phase 15G's own real question: can Juntia help a real decision surface *before* an agent silently picks
a value and writes it into code — without Juntia itself deciding anything, or blocking automatically. Two
small, additive, Knowledge-Layer-sourced pieces answer it:

Each workflow file can now name specific, real decision AREAS within a type (`## Decisions this workflow may
require`'s existing bullets gained indented sub-bullets — `feature-development.md`'s `product` bullet now
lists `behavior`/`user_experience`/`scope`/`balancing`) — parsed into `workflow.decisionAreas` and surfaced as
a "## Potential decisions" section in `.juntia/task-handoff.md`, alongside a governance-level-specific
instruction (`workflow.decisionGuidance`, from `governance-levels.js`'s own registry: LIGHT needs no review by
default, STANDARD/STRICT escalate the moment an area becomes concrete — not, as originally written here, in a
single pass "before implementing"; see `phases/just-in-time-governance.md` for why that phrase itself turned
out to be the problem a later dogfooding session found).

A small, separate catalog, `.juntia/governance/rules/decision-triggers.md` (`lib/governance/
decision-triggers.js` reads it), names a handful of common, real situations (a new dependency, a tunable
numeric value with no objectively correct answer, a data-model change, ...) worth recognizing as a possible
decision. Neither piece is ever matched against a request automatically — both are real, checkable properties
of the code, not just a stated intention (`decision-triggers.js`'s own loader takes no request text as an
argument at all, structurally incapable of "detecting" anything on its own). An agent reads them and applies
its own judgment, the same way it already reads a role or a skill file.

## Decisions and change: never deleted, always reviewable

A confirmed decision is never rewritten or deleted when the facts it cited change — `lib/project-
intelligence/decisions-store.js`'s `detectConflicts()` runs on every `analyze` (not just `--explain`; purely
deterministic, no AI) and flags a decision `status: 'conflicted'` when any fact in its `basedOn` is missing
from the fresh scan. The decision's own text, evidence, and confidence stay exactly as originally recorded —
only the status field changes. `juntia analyze` prints newly-found conflicts once, when they're first
detected; `juntia context`'s own "Conflicts needing review" section always lists every outstanding one,
so nothing gets buried after the one-time announcement scrolls past.

## The CONTEXT tier, built (Phase 12K)

`juntia context` (also run automatically at the end of `juntia confirm`) assembles `.juntia/context.md` from
confirmed facts and confirmed decisions only — `lib/project-intelligence/context-generator.js`'s
`generateContext(facts, decisions)` has no third parameter for a pending interpretation, so there is nothing
to leak structurally, not just by convention. No placeholder "Constraints"/"Rules" sections are invented —
this phase found no real, evidenced source for those yet, so they're left out entirely rather than filled
with empty scaffolding. (A decision "type" taxonomy — interpretation/product/architecture — did not exist
when this was originally written; see "Decision types" above for Phase 15F, which closed that specific gap.)

## Decision continuity: reaching the active task, not just `context.md` (Decision Continuity phase)

`context.md` being refreshed on every `confirm` (above) is necessary but was not sufficient — a real, live
Snake dogfooding session confirmed a decision that genuinely contradicted a provisional value an agent had
already proposed, and the confirmation never reached the agent: `.juntia/task-handoff.md`, the file the agent
was actually mid-task against, was written once by `juntia route` and never touched again. Two of four
confirmed decisions never reached the game's real code because of exactly this gap.

The fix stays inside this same cycle rather than adding a new one: `juntia confirm` now also calls
`refreshTaskHandoffDecisions` (`lib/governance/task-handoff.js`) whenever `.juntia/task-handoff.md` currently
exists — the same "regenerate a derived, never-hand-edited file" precedent `route`/`integrate` already
established for `.juntia/BOOTSTRAP.md`. The regenerated file gains one new section, `## Confirmed decisions`,
split into:

- **Confirmed since this task started** — anything with `confirmedAt` after this specific task's own
  `generatedAt` (recovered from a small, machine-only `<!-- juntia:task-meta ... -->` comment the file already
  carries), regardless of decision type. Flagged explicitly as something that may supersede a provisional
  value already chosen or written — this is the exact case the Snake session found broken.
- **Already known when this task started** — decisions confirmed before that point, filtered to this
  workflow's own declared `decisionTypes` (the same relevance filter `## Potential decisions` already uses) so
  this section stays bounded, never a full `DECISIONS.md` dump.

No new decision status is persisted to make this work. Juntia never asserts a decision WAS applied to code —
it cannot verify that without patching source itself, which it must not do. "New" is scoped to the task's own
lifetime instead: a fresh `juntia route` call resets `generatedAt`, so a later, unrelated task never keeps
re-flagging something an earlier task already had the chance to act on. See
`phases/decision-continuity.md` for the full account, including why this was evaluated as the smallest
sufficient mechanism rather than a persisted `pending → confirmed → applied` state machine.

## Task Status: a real signal a blocking decision must stop work, without Juntia stopping anything itself (Governance In-Flow phase)

Decision Continuity closed how a confirmed decision reaches the active task; it left open how an agent — or a
brand-new session with no memory of the conversation — discovers that a decision is *currently* blocking part
of that task, before it's confirmed. `.juntia/task-handoff.md` gains a `## Task Status` section, computed by
`lib/governance/task-status.js#computeTaskStatus` and embedded in both the human-readable prose and the
machine-parseable Agent Context JSON block (a new `taskStatus` field):

- **`WAITING_HUMAN_CONFIRMATION`** — at least one currently pending, valid product/architecture decision
  request exists. Unconditional: Juntia never weighs pending items against each other, because anything
  actually sitting in `pending.json` already passed the agent's own BLOCKING judgment (a non-blocking
  situation is never escalated at all — see `decision-triggers.md`'s own `Requires confirmation` field). The
  section lists each pending decision's question, affected area (`context`), the current task's own workflow,
  and why it needs confirmation (`reason`, optional, agent-supplied, transported verbatim).
- **`READY_TO_CONTINUE`** — nothing is currently pending, but a decision was confirmed since this task started
  (the same "since" comparison `## Confirmed decisions` already makes) — something the task was waiting on
  just got answered.
- **`ACTIVE`** — neither of the above; the default, ordinary working state.

No new persisted state: this is computed fresh every time, from `pending.json`'s current contents and
`decisions.json`'s own `confirmedAt` timestamps — never a fourth decision status. The real mechanical trick
that closes the loop without a new CLI command: an agent marks a task `WAITING_HUMAN_CONFIRMATION` the moment
it escalates by running `juntia confirm` right away and answering `skip` (it doesn't have the human's real
answer yet) — `runConfirm` already, unconditionally, refreshes `task-handoff.md` at the end of every run, so
this "empty" confirm still recomputes and writes the current, real Task Status. Running `confirm` again, with
the real answer once it arrives, clears it. See `phases/single-governance-source-of-truth.md` for the full
account.

## Where decisions live: `.juntia/decisions.json` vs. `DECISIONS.md`, evaluated

| | `.juntia/decisions.json` | `.juntia/DECISIONS.md` |
|---|---|---|
| Human-readable? | No — structured data | Yes — the format `juntia init` already scaffolds |
| Machine-consumable? | Yes — `context.md`/conflict-detection read this | Not reliably (free text) |
| Git-ignored? | **No** — same reasoning as `DECISIONS.md` itself: an irreversible human choice, not a regenerable snapshot | No (was already tracked before this phase) |
| Merge conflicts | A real risk for concurrent decisions — but a *meaningful* one: two teammates confirming genuinely different decisions on the same evidence SHOULD surface as a conflict for a human to resolve, unlike `facts.json` where a conflict would be pure noise | Same real risk, same argument |

Chosen: **both**, not one instead of the other — the brief's own "puede existir una separación entre
decisiones estructuradas para máquina y documentación narrativa para humanos" evaluated concretely rather
than assumed. `facts.json`/`pending.json` are git-ignored because they're machine-regenerated/proposed and
re-derivable from re-running `analyze`/`explain`; `decisions.json` is not, because a human decision is not
re-derivable — losing it to a missing commit is a real harm the other two files don't share.

## CLI surface, evaluated not assumed

Per the brief's own explicit "no crear comandos únicamente porque existen conceptualmente," each candidate
command was checked against simplicity/UX/frequency/coherence before being built:

- **`juntia explain` as a separate command** — rejected: `analyze --explain` (Phase 12J) already does this,
  well-tested; a second, redundant way to do the same thing would hurt coherence, not help it.
- **`juntia update` as one command running the whole 6-step cycle** (analyze → interpret → confirm →
  decide → context) — rejected: it would force an interactive confirmation prompt (or a silent AI call)
  inside what might be a scripted/CI `analyze` invocation, and would remove the human's ability to review an
  interpretation before being asked to decide on it immediately. The 6 steps the brief describes map exactly
  onto the three real commands (`analyze [--explain]` → `confirm` → `context`, the last auto-run by
  `confirm` too) — composing existing, individually-scriptable commands, not one monolithic new one.
- **`juntia confirm`/`juntia context` as real, separate commands** — built: neither exists conceptually
  inside `analyze`, both are genuinely new capabilities (a human decision workflow; a context-assembly step),
  and both are useful to run independently of the other two (e.g. `juntia context` to re-print the current
  summary without re-scanning or re-confirming anything).

## Real validation, not just design

Phase 12J: two independent live runs (`juntia`, `app-podcaster`) plus one through the actual `bin/juntia.js
analyze --explain` binary — all three produced a valid, fully fact-grounded interpretation.

Phase 12K: a full, real, interactive cycle (`analyze --explain` → `confirm` [real stdin, real "y"] →
`context`) run against a synthetic fixture and against `juntia` and `app-podcaster` themselves. Every
resulting `decisions.json`/`DECISIONS.md`/`context.md` was inspected for correctness, and a real conflict
was produced and correctly detected (removing `app-podcaster`'s `react-router-dom` dependency after
confirming a decision that cited it) — the decision was flagged `conflicted`, never deleted. All test
footprints were cleaned up afterward, confirmed via `git status` before/after showing zero unrelated changes.
A real, live edge case was found and left undestroyed rather than "fixed" by loosening the validator:
`app-podcaster`'s scoped dependency `@commitlint/cli` was once cited by a real response as
`commitlint/cli` (the leading `@` dropped) and correctly rejected — the validator's exact-match grounding
check did its job; a second real call cited it correctly. See `phases/12k-context-lifecycle.md`'s own
"Riesgos" section for why this was documented rather than papered over with fuzzy matching.

## What's still missing

- **A noise/cost threshold** — every `--explain` run interprets the entire fact set from scratch; there's no
  rule yet for when re-interpreting is worth the real cost/latency versus reusing a still-valid prior read.
- **Decision "types"** — no taxonomy exists yet for what kind of decision something is (architecture vs.
  constraint vs. convention), which is why `context.md` has no `Constraints`/`Rules` sections of its own.
- **Conflict resolution UX** — a conflicted decision is flagged and reviewable, but nothing yet walks a human
  through resolving it (confirming it's still true, superseding it with a new decision, or retiring it).
- **Merge-conflict tooling** — `decisions.json`'s real, meaningful merge-conflict risk (see "Where decisions
  live" above) has no dedicated tooling yet beyond ordinary git conflict resolution.
