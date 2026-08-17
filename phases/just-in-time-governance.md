# Just-In-Time Governance

Two consecutive objectives, both real, both grounded in the same live dogfooding session (Phase 16B, a
Snake-equivalent scenario): fix a real contract bug between an external agent and Core, then fix the
architectural pattern that bug's own workaround exposed — `governance-review` asking its questions only once
the agent had practically finished implementing, not while it still could act on the answer.

## Vision this phase is grounded in

> AI interprets. Juntia governs.

Juntia does not gain a new capability this phase. It does not reason, does not implement, does not decide a
technical solution. What changes is WHEN the standing mechanism it already provides — escalate, pause, wait
for a human, resume — is available to reach for, and whether the file that mechanism depends on can actually
be written the way the documentation already told an agent to write it.

## Objective 1: the pending.json contract bug

### Diagnosis

Audited before changing anything, per this phase's own instruction. The real chain:

```
pending.json → juntia confirm → decisions.json → DECISIONS.md → context.md
```

`lib/project-intelligence/pending-store.js#loadPending` required a root document shaped exactly
`{ "schemaVersion": 1, "items": [...] }`. `.juntia/governance/rules/agent-rules.md` — the file an external
agent is told to follow — showed a decision request only as a single bare object:

```
{ "type": "product"|"architecture", "question": "...", "context": "...", "options": [...] }
```

never wrapped, never shown as part of a real document. An agent following that literally, needing to write
more than one request over time, has exactly two plausible readings: a single bare object (which was never
valid either, before or after this phase), or a JSON array of these objects — the shape the real Phase 16B
session actually produced. `loadPending` rejected it outright: `"pending.json exists but is not a recognized
pending document"`, and `juntia confirm` reported nothing to confirm. Reproduced directly, before any fix
(see this phase's own commit history / `test/cli-confirm-context.test.js`'s new tests, which assert the fixed
behavior against the exact same input).

This is a real contract violation, not a Snake-specific bug: Juntia's own architecture (Phase 13D, the AI
Handoff model) declares that an external agent writes to `pending.json` directly — the representation the
Knowledge Layer's own documentation leads an agent to produce must be one Core actually accepts.

### Fix

`lib/project-intelligence/pending-store.js#loadPending` now also accepts a bare JSON array as the items list
— unambiguous, since nothing else a valid `pending.json` could mean starts as a top-level array.
`normalizePendingItems` self-heals it back to the canonical `{ schemaVersion, items }` shape the moment it's
next touched (the only shape `savePending` ever writes) — no permanent second format, no migration script
needed, nothing destructive. The canonical wrapped shape, a corrupt file, and a genuinely unrecognized
document (e.g. `{ "notItems": [] }`) all behave exactly as before — this widens tolerance for one specific,
unambiguous shape, not the acceptance criteria generally. A single bare object with no array around it at all
is still rejected — the fix targets the shape the real bug actually produced, not a guess at every possible
malformed input.

`templates/governance/rules/agent-rules.md` now shows the complete, exact contract: the per-request object
shape, both accepted document shapes (bare array and wrapped), and an explicit statement of the one shape
that is never valid. `templates/governance/skills/product-decision-making/SKILL.md` and
`.../architecture-decision-record/SKILL.md` point at that one definition instead of repeating their own
partial copy — a single source of truth, the same discipline this codebase already applies to workflow
files' own decision-escalation pointers.

### Verification

- Bug reproduced against the pre-fix code with the exact scenario described: a bare JSON array written
  directly to `pending.json`, `juntia confirm` run against it, the exact reported error message matched.
- `test/pending-store.test.js`: 8 new tests — array shape accepted, canonical shape unaffected, a genuinely
  unrecognized document still rejected, a single bare object still rejected, `normalizePendingItems`
  self-heals the shape on disk, ids are correctly derived, multiple items in one array are all preserved,
  every write (including one triggered by reading the tolerant shape) produces the canonical document.
- `test/cli-confirm-context.test.js`: 3 new tests running the real, wired `runConfirm` CLI function (not
  internal module functions in isolation) against a bare-array `pending.json`, verifying the full
  pending → decisions.json → DECISIONS.md → context.md chain, that both shapes produce identical outcomes,
  and that a fact interpretation (not only a decision request) is accepted in array form too.

## Objective 2: from a single review pass to just-in-time escalation

### Diagnosis: the real architecture, audited before changing anything

The Knowledge Layer's decision machinery, as it stood before this phase:

- **`workflow-router.js`** composes intent classification with `workflow-knowledge.js`'s resolution of the
  matching `.juntia/governance/workflows/*.md` file — roles, skills, governance level, and (Phase 15F/15G)
  `decisionTypes`/`decisionAreas`, parsed, never hardcoded in JS.
- **`decision-triggers.js`** reads a small, separate catalog (`decision-triggers.md`) of common real
  situations, each already declaring a `Requires confirmation: yes/no` field — parsed, never matched against
  a request automatically (an explicit, deliberate architectural boundary from Phase 15G, unchanged by this
  phase).
- **`governance-levels.js`** defines what LIGHT/STANDARD/STRICT mean, including a `decisionGuidance` string
  per level.
- **`governance-review` (a skill, Phase 15G)** was the actual escalation trigger — the procedure an agent
  follows to check declared decision areas against pending.json/DECISIONS.md and write a request. Its own
  `when_to_use`: *"Immediately before starting implementation... "* — and `feature-development.md`'s own
  `## Sequence` named it as step 4, a single point between "propose a solution" and "implement."

None of this was wrong in mechanism. `product-decision-making`/`architecture-decision-record` (the actual
escalation procedures) already worked correctly whenever invoked — the real, evidenced Phase 16B failure was
about **when** an agent was told to invoke `governance-review` at all: once, early, as a single pass. A real
feature's decisions do not all become concrete at that one point — some only become real once the Engineer is
actually implementing a specific piece, once Product reasoning gets more concrete, or once QA validation
surfaces that "correct" itself was never decided. An agent taught "I already did governance-review" had no
cue to invoke it a second time when a later decision became concrete — so it silently guessed, the same
failure mode Phase 15G was built to close, now reintroduced by Phase 15G's own timing.

**What this phase reused, unchanged:** the entire decision model (`decision-model.js`), the persistence chain
(`pending-store.js`, `decisions-store.js`), the Decision Continuity mechanism
(`task-handoff.js#refreshTaskHandoffDecisions`, built last phase), `decision-triggers.js`'s parsing, and
`workflow-knowledge.js`'s parsing. **What changed:** exclusively the declarative, Knowledge-Layer-authored
text that tells an agent WHEN to reach for that unchanged mechanism, plus the small amount of Core-authored
prose (`task-handoff.js`'s generated "Potential decisions" section, `governance-levels.js`'s
`decisionGuidance` strings) that repeated the same "before implementing" framing.

### Why no new Core mechanism was needed

The real, load-bearing finding of this phase: the pause-mid-task/resume cycle already worked, mechanically,
at any point in a task, once Objective 1's contract bug was fixed. `juntia confirm` doesn't know or care
whether it's being run five minutes into a task or five hours in; `refreshTaskHandoffDecisions` (Decision
Continuity phase) doesn't care either — it reads whatever `.juntia/task-handoff.md` currently exists and
refreshes it in place. Once an agent can actually write a decision request Juntia accepts (Objective 1), the
entire "detect → escalate → pause → confirm → resume" loop this phase's success criterion describes was
already real. The single-pass problem was never a missing mechanism — it was a Knowledge Layer file telling
an agent to use a real mechanism at the wrong (and only) time. This is why this phase's design deliberately
does NOT add: a new decision status, a new CLI command, a per-decision-area role/stage mapping, or a
"apply confirmed decisions" workflow phase (evaluated explicitly below, rejected as unnecessary).

### BLOCKING vs. non-blocking: declarative, never inferred

`decision-triggers.md`'s own `Requires confirmation: yes/no` field — already parsed by `decision-triggers.js`
since Phase 15G — is now this codebase's explicit, documented definition of BLOCKING vs. non-blocking, with
that framing made prominent in the catalog's own intro and in every place that references escalation
(`agent-rules.md`, `governance-review/SKILL.md`). `yes` means: do not proceed on an assumption, escalate, wait
for a real human confirmation before continuing the specific affected work. `no` means: use your own
reasonable judgment and continue, no pause required. A real situation the catalog doesn't name at all is
still the agent's own judgment call — the catalog is a curated set of common cases, not an exhaustive rule
engine. Juntia never infers importance from a question's own wording; the only place that determination is
made is this declared field, read mechanically, never matched against free text.

### What shipped (Knowledge Layer)

- **`governance-review/SKILL.md`** — fully rewritten. `when_to_use` names a recurring trigger condition (the
  moment a decision area becomes concrete, in any role, at any workflow step) instead of a single point in a
  sequence. `role` broadened from `engineer` alone. The process now explicitly separates BLOCKING/non-blocking
  via `decision-triggers.md`'s own field, instructs pausing only the specific affected work, and closes the
  loop by pointing back at `.juntia/task-handoff.md`'s "Confirmed decisions" section (Decision Continuity) as
  the real resumption mechanism. The file's own body now documents both real gaps it was built from — Phase
  15G's original one, and this phase's re-timing of it — as an honest, dated record.
- **`feature-development.md` / `bug-fix.md` / `refactor.md`** — `## Sequence` no longer names a single
  "before implementing" checkpoint; each names checking for a decision as something that can happen at any
  step, escalated the moment it's concrete. `## Skills recommended` lists `governance-review` as available
  throughout, not reserved for the Engineer step alone — added to `bug-fix.md`/`refactor.md`, which
  previously named no escalation skill at all despite both declaring real decision areas.
  `investigation.md` is unchanged — it already, deliberately, never escalates a decision itself (a real,
  pre-existing architectural choice unrelated to this bug, left as-is).
- **`decision-triggers.md`** — a new intro paragraph makes `Requires confirmation` the catalog's own explicit
  BLOCKING/non-blocking definition, states what each value means operationally, and points at
  `governance-review/SKILL.md` as the escalation procedure.
- **`agent-rules.md`** — the standing "check for a decision" rule reframed around the recurring trigger
  condition instead of a single pre-implementation pass; the full pending.json contract (Objective 1) added
  alongside it.
- **The four role files** (`product.md`/`architect.md`/`engineer.md`/`qa.md`) — each gains one short paragraph
  under its own pre-existing "Escalates to a human when" section, naming the concrete mechanism
  (which skill, which file) and stating explicitly that it applies the moment the situation is real, not on a
  schedule. These are Phase-00-era files most of this migration has otherwise left alone; the addition is
  deliberately small and additive; nothing about their existing content was removed.
- **`skills/README.md`** — the `governance-review` catalog entry and the `role:` field's own format
  description updated to match; both were actively describing the old, single-pass behavior.

### What shipped (Core)

- **`lib/governance/task-handoff.js`** — the generated "Potential decisions" section's closing prose no
  longer says "before implementing"; it now states the same just-in-time framing the Knowledge Layer files
  above use, and points at `agent-rules.md` for the pending.json contract instead of repeating a partial,
  now-fixed inline example (removing one more place a stale copy of the contract could drift from the real
  one).
- **`lib/governance/governance-levels.js`** — `decisionGuidance` for STANDARD/STRICT reworded to remove
  "before implementing" from Core-generated text, not only Knowledge Layer prose; the actual meaning
  (STANDARD: escalate what applies; STRICT: human confirmation required for every applicable area) is
  unchanged.
- **`lib/governance/bootstrap.js`** — a new "## While you are working" section, the first place (after
  `CLAUDE.md`'s own pointer) an agent reads, states the just-in-time principle directly and points at
  `governance-review/SKILL.md` and `.juntia/task-handoff.md`'s resumption mechanism.

### What this phase evaluated and deliberately did not do

- **A declarative "apply confirmed decisions" workflow phase** — evaluated per this phase's own explicit
  instruction, rejected: the confirmed-decisions surface (`task-handoff.md`'s own section, Decision
  Continuity) is already Core-generated and appears in every task, for every workflow, automatically — a
  per-workflow declared phase would duplicate what Core already provides uniformly, for no real gain, and
  would need `workflow-knowledge.js` parsing changes with no new information to extract.
- **A new "applied" decision status** — evaluated (again) per this phase's own explicit instruction, rejected
  for the same reason the Decision Continuity phase rejected it: Juntia cannot verify a code change actually
  implements a decision without patching source itself, which it must not do. A decision stops being flagged
  "new" once a fresh `juntia route` call starts a new task — an honest, structural proxy, never an assertion
  about code state.
- **Turning `governance-review` into an automatically-invoked check** — Juntia still never decides a decision
  is needed; an agent still notices, judges, and chooses to escalate. What changed is only when the Knowledge
  Layer tells the agent this capability is available to reach for.
- **A new CLI command for "confirm just this one pending item."** A real, named friction point (see
  Limitations below), deliberately left unsolved this phase per its own "no new command unless strictly
  necessary" constraint — `skip` already lets a human/agent pass over an unrelated pending item without
  losing it.
- **Inferring BLOCKING from a question's own text.** Explicitly forbidden by this phase's own brief; the
  declared `Requires confirmation` field is the only source of that determination.

### The human's real experience

Unchanged in kind, verified directly against the real CLI binary (not only the internal function) as part of
this phase's own audit: `juntia confirm` prompts with a plain-language question and reads one line of free
text — never JSON, never `DECISIONS.md`, never any Juntia-internal file. What's new is that this can now
happen mid-conversation, inside the same agent session: an agent that notices a decision can ask the human
directly in chat, and — once it has the answer — run `juntia confirm` itself with that answer piped as input
(`echo "<answer>" | npx juntia confirm`, verified working against the real binary, including with a
bare-array `pending.json` from Objective 1), all inside the same tool-using turn, no separate terminal
required. The human types one real answer once; the agent handles the mechanics.

## Distinguishing the states (unchanged from Decision Continuity, restated for this phase's own scope)

| State | Where it lives | Who controls it |
|---|---|---|
| **Proposed/provisional** | An agent's own reasoning — nothing Juntia tracks | The agent |
| **Pending** | `.juntia/pending.json` — a question, never an answer (validated structurally) | The agent proposes it; Juntia validates its shape (now tolerant of the shape an agent can plausibly produce) |
| **Confirmed** | `.juntia/decisions.json` + `DECISIONS.md` + `context.md` + `task-handoff.md`'s "Confirmed decisions" section | Only a human, via `juntia confirm` |
| **Applied** | Not a persisted status — inferred as "no longer flagged new" once a fresh task begins | The agent — Juntia never asserts this |

## Verification

- Full suite: 470 tests passing (449 before this phase's session, 21 new — 8 in `pending-store.test.js`, 3 in
  `cli-confirm-context.test.js`, 8 in the new `test/just-in-time-governance.test.js`, one each in
  `task-handoff.test.js`/`bootstrap.test.js`), zero failures, run repeatedly to rule out flakiness.
- `grep` sweep for `"before implementing"`/`"immediately before implementation"` across `templates/`, `lib/`,
  `docs/`, `README.md`: no remaining instance implies a single, final review pass; every surviving mention is
  either explanatory prose about what changed, or unrelated ordinary English ("a call before implementing
  *this specific tradeoff*") that doesn't assert single-pass timing.
- `test/just-in-time-governance.test.js` — the real, end-to-end proof this phase's success criterion demands,
  through the actual wired `runRoute`/decision-request/`runConfirm`/task-handoff chain, never internal
  functions mocked in isolation:
  - a task starts with no pending decision on disk at all (`fs.existsSync` asserted false) — proving Juntia
    never pre-creates a decision request from a workflow's declared areas;
  - a decision discovered mid-task is escalated, confirmed, and reflected in the SAME task's task-handoff.md
    without a second `route` call or any "finish the feature first" step — the test that would fail if the
    system still waited for the whole feature to be done;
  - a confirmed decision that contradicts the agent's own provisional value (the Snake-equivalent pattern,
    expressed generically — a "points per event" value proposed as 10, confirmed as 1) correctly overrides it;
  - a confirmed decision that happens to match the provisional value is still recorded and shown, not
    silently skipped;
  - a second, independent decision discovered later in the same task re-triggers the exact same mechanism
    without losing the first;
  - multiple decisions, both product and architecture type, confirmed together;
  - a decision confirmed under one workflow is correctly excluded from a different, later workflow's own
    type-filtered baseline;
  - a brand-new session (a fresh `runRoute` call with no access to prior in-process state) discovers the
    confirmed decision purely from disk;
  - Objective 1 and Objective 2 meeting in one path: a mid-task decision escalated via the bare-array
    `pending.json` shape flows through the exact same just-in-time mechanism.

### What remains genuinely runtime-dependent, not something this test suite (or Juntia) can close

The actual moment an agent, mid-reasoning, recognizes "this is a real, blocking decision, I should escalate
it now" is a live judgment call inside whichever AI runtime is doing the work — this phase makes that
judgment easier and more consistently prompted (via `governance-review`'s new `when_to_use`, restated in
every role file and workflow), but cannot automate or verify it: Juntia has no visibility into an agent's own
reasoning process, by design. Every test in `test/just-in-time-governance.test.js` stands in for that moment
with a direct `pending.json` write at the point a real agent's own tool call would happen — real and
deterministic for everything on Juntia's side of that boundary, honest about not covering the boundary
itself. Confirming that a real agent, given only the Knowledge Layer's own instructions, actually recognizes
and acts on that moment in practice is what re-running the Snake experiment (named, not performed, this
phase) would test.

## Known limitations after this phase

- **Multiple unrelated pending items still get visited together in one `juntia confirm` run.** If an agent
  escalates a decision while older, unrelated pending items already exist, a human answering via a single
  piped line only answers the first; verified directly that this degrades safely (an exhausted stdin read is
  treated as `skip` — the item stays pending, nothing is lost, nothing crashes) rather than silently
  mis-answering. A `juntia confirm <id>` flag would resolve this cleanly but was deliberately not added this
  phase, per its own "no new command unless strictly necessary" constraint — no real evidence yet names it as
  a recurring problem rather than a theoretical one.
- **A narrow, synchronous-execution-only timestamp tie.** `task-handoff.js`'s "confirmed since this task
  started" filter compares ISO millisecond timestamps; if a decision's `confirmedAt` and a later task's own
  `generatedAt` land in the exact same millisecond, the tie resolves toward "new" rather than "already known."
  Found only by this phase's own test suite executing faster than 1ms between operations — unreachable in
  real usage, where `juntia confirm` always waits on genuine human input. Left as a documented, honest edge
  case rather than a fix that would add complexity for a boundary real usage cannot hit.
- **`agent-rules.md`/role files/workflow files are scaffold-once.** A project that ran `juntia init` before
  this phase will not automatically receive the updated contract or just-in-time framing — the same
  limitation every prior Knowledge Layer content change has had (Decision Continuity, Decision Discovery
  before it). `juntia update` (designed, not built) would be the real fix; out of this phase's scope.
- **The mechanism is still honest, not enforced.** Nothing prevents an agent from noticing a decision and
  choosing not to escalate it — Juntia governs by making the right path unmissable at every point it could be
  needed, never by blocking an agent's own tool calls.

## Answers to this phase's own closing questions

1. **¿El bug de pending.json está resuelto tanto para agentes que escriben arrays como para el formato
   document object?** Yes — both verified directly, unit-level and through the real, wired `runConfirm` CLI
   function, including the exact reproduction of the reported error.
2. **¿Puede un agente crear una decisión válida y conseguir que juntia confirm la acepte?** Yes — verified
   against the real `bin/juntia.js` binary with piped stdin, not only the internal function.
3. **¿Puede una decisión aparecer en mitad de una tarea?** Yes — `test/just-in-time-governance.test.js`'s
   first test asserts no pending decision exists right after a task starts, then creates and confirms one
   mid-task, within the same `task-handoff.md`.
4. **¿El agente puede detenerse en ese punto en lugar de terminar primero?** Architecturally, yes: nothing in
   the mechanism requires finishing the feature first, and the Knowledge Layer now names the recurring
   trigger explicitly, in every role and workflow file. Whether a real agent actually stops in practice is
   the one part of this question that stays runtime-dependent (see above) — not something this phase, or any
   documentation change, can mechanically guarantee.
5. **¿El humano puede confirmarla?** Yes, unchanged and re-verified: `juntia confirm` prompts in plain
   language, accepts free text, never requires touching a Juntia-internal file.
6. **¿La confirmación vuelve inmediatamente al estado operativo de la tarea?** Yes — reusing Decision
   Continuity's `refreshTaskHandoffDecisions`, called by `runConfirm` immediately after recording each
   decision, with no additional step.
7. **¿El agente puede continuar usando la respuesta confirmada?** Yes — `task-handoff.md`'s "Confirmed
   decisions" section shows the real, human-typed answer, distinctly flagged from what was already known.
8. **¿Una decisión contradictoria con el provisional modifica correctamente la implementación posterior?**
   The confirmed value is what `decisions.json`/`task-handoff.md` carry forward, verified directly against a
   provisional-vs-confirmed contradiction case; whether the agent's own subsequent code edit actually uses it
   is, as with Decision Continuity, the agent's responsibility, not something Juntia patches.
9. **¿Puede aparecer una segunda decisión más adelante sin reiniciar el workflow?** Yes — verified directly;
   a second, independent decision discovered later in the same task is escalated and confirmed without a new
   `route` call, and both decisions remain visible together.
10. **¿El sistema sigue evitando autoaprobaciones?** Yes, unchanged — no new write path to `decisions.json`
    was added; `validateDecisionRequest`'s forbidden-key check and `recordDecision`'s human-only trigger are
    untouched.
11. **¿Juntia sigue sin razonar ni implementar?** Yes — every change this phase made is either a persistence
    tolerance fix (Objective 1) or Knowledge-Layer/generated-prose timing guidance (Objective 2); no module
    gained the ability to decide a technical solution, classify importance from free text, or write source
    code.
12. **¿La Knowledge Layer sigue siendo la fuente de verdad?** Yes, more than before — the BLOCKING/
    non-blocking distinction, previously implicit, is now an explicit, prominent contract in
    `decision-triggers.md` itself; no decision-area content, Snake-specific or otherwise, was hardcoded into
    JavaScript.
13. **¿El usuario necesita algún paso manual que no debería necesitar?** No new manual step was added; the
    one real, verified improvement is that an agent can now resolve a decision non-interactively, inside the
    same session, via piped input to `juntia confirm` — the human still only ever types one plain-language
    answer.
14. **¿Qué limitaciones siguen dependiendo del runtime de Claude Code y no pueden ser resueltas por Juntia?**
    The actual moment of noticing a decision is real and needs escalating — an in-context reasoning judgment
    no Core mechanism can compute or verify. Whether a real agent, given only the updated Knowledge Layer,
    reliably acts on that moment is exactly what re-running the Snake experiment (not performed this phase)
    would test.

**Verdict: CONTINUE.** Both objectives are closed with real, reproduced-then-fixed evidence: the pending.json
contract now accepts what an agent following its own documentation can plausibly produce, and the escalation
timing that documentation teaches is just-in-time, not a single pass. No new Core mechanism was required for
the second objective — the real finding is that Decision Continuity's own machinery already supported this,
once Objective 1 stopped silently breaking it. The system is ready for the Snake experiment to be re-run to
check whether a live agent, under the corrected Knowledge Layer, actually escalates decisions as they arise
rather than at the end.
