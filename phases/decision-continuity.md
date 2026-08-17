# Decision Continuity

## Vision this phase is grounded in

> AI interprets. Juntia governs.

This phase does not add a new capability to Juntia. It closes a real gap the first live dogfooding session
found in a capability that already existed: a human-confirmed decision was not reliably reaching the agent
that needed to act on it.

## The evidence

A three-arm Snake dogfooding experiment (no Juntia; Juntia legacy; current Juntia Governance) confirmed the
new architecture changes real agent behavior: the governed arm discovered Juntia without coaching, ran
`juntia route` and the `governance-review` skill, produced four real product decisions, and passed all four
through human confirmation via `juntia confirm`. All three arms passed 11/11 functional checks — no evidence
yet that Juntia improves code quality — and the governed arm cost roughly +40% tokens and +47% tool calls.
Juntia's observed value is in governance and decision traceability, not in code quality or cost, which this
phase does not change or claim to change.

The experiment also found the gap this phase closes: **two of the four confirmed decisions never reached
`config.ts`.** The decisions were real, recorded correctly in `.juntia/decisions.json` and
`.juntia/DECISIONS.md` — the DECISION tier itself (Phase 12K) worked. What failed was the step after it.

## Audit: where DECISION → HUMAN CONFIRMATION → AGENT CONTEXT → IMPLEMENTATION actually breaks

Traced through the real code, not assumed:

```
pending.json → juntia confirm → decisions.json → DECISIONS.md → context.md → BOOTSTRAP.md → task-handoff.md → CLAUDE.md
```

1. `juntia confirm` (`bin/juntia.js`'s `runConfirm`) already, correctly, refreshes `.juntia/context.md` on
   every run — `writeContext(projectRoot, generateContext(facts, decisions))` runs unconditionally at the end
   of the confirm loop, verified by a real, pre-existing test
   (`test/cli-confirm-context.test.js`: "confirm automatically refreshes .juntia/context.md after a real
   confirmation"). **This link was not broken.**
2. `.juntia/BOOTSTRAP.md` tells an agent to read `context.md`/`DECISIONS.md` "once per session, before
   anything else" (`lib/governance/bootstrap.js`) — correct for a session's first orientation, but it is never
   re-triggered mid-task, and nothing tells an agent already mid-task that either file changed.
3. **The real break: `.juntia/task-handoff.md` — the file an agent is actually working from once a task has
   started — was written exactly once, by `juntia route`, and never touched again.** `juntia confirm` had no
   reference to it at all before this phase. An agent that proposed a decision request, kept working, and
   later saw (or was told about) a human's answer had no deterministic, file-backed way to learn "this
   contradicts what you already assumed" — it depended on the agent still holding that context in the same
   conversation, exactly the dependency `.juntia/task-handoff.md` exists to remove.
4. Even where `context.md` did carry the new decision, nothing distinguished "you already knew this when you
   started" from "this just changed and may contradict what you already wrote" — both looked identical, one
   bullet among others in a "Confirmed decisions" list.

Reproduced directly (not assumed) with the real, wired CLI functions before writing any fix: `runRoute`
followed by `upsertDecisionRequest` + `runConfirm` with an answer that contradicts a plausible provisional
value shows the confirmed decision landing in `context.md` but `task-handoff.md` staying byte-identical to
before the confirmation. This is `test/decision-continuity.test.js`'s own baseline case, still assertable
against the pre-phase code path (the fix is what makes it pass now).

## The mechanism (smallest sufficient version)

No new CLI command. `juntia confirm` already runs at exactly the right moment — right after a real human
answers a real question — and this phase reuses that moment rather than inventing a new one, per its own
"reuse the existing flow before adding a command" constraint.

**`lib/governance/task-handoff.js`:**

- `buildTaskHandoff(text, route, { decisions, generatedAt })` — two new, optional, defensively-defaulted
  fields (`decisions = []`, `generatedAt = now`) so every pre-existing caller (including every test written
  before this phase) is unaffected. Adds one new section, `## Confirmed decisions`, between `## Potential
  decisions` and `## Agent Context` — the existing "navigation, never a solution" Agent Context JSON block
  (`{ task, workflow, roles, skills, contextSources }`) is untouched, still passing its own pre-existing exact
  key-set test.
- The new section splits `decisions` into **confirmed since this task started** (`confirmedAt >= generatedAt`,
  never type-filtered — a decision that emerged mid-task is relevant to the task by construction) and
  **already known when this task started** (`confirmedAt < generatedAt`, filtered to this workflow's own
  declared `decisionTypes` — the same relevance filter `## Potential decisions` already uses, so this never
  becomes a full `DECISIONS.md` dump). For a product/architecture decision, both the original question and the
  options that were on the table are shown next to the human's actual confirmed answer, so an agent can
  compare what it may have assumed against what was actually decided without needing to remember a prior
  conversation turn.
- A small, machine-only `<!-- juntia:task-meta {"text":...,"generatedAt":...} -->` comment is embedded once,
  at generation time. `route` itself is deliberately **not** duplicated into a second JSON blob — it is
  recovered, losslessly, from the Agent Context block the file already embeds
  (`routeFromAgentContext`, the exact inverse of `agent-context.js`'s `buildAgentContext`). This keeps the file
  inside its own pre-existing, tested size budget (`test/agent-consumption-model.test.js`: task-handoff.md
  must stay under 5000 bytes).
- `refreshTaskHandoffDecisions(projectRoot, decisions)` — reads that state back, and, if and only if it can
  (a task-handoff.md exists AND was written by this or a later version of Juntia), calls `buildTaskHandoff`
  again with the SAME `text`/`route`/`generatedAt` and the CURRENT decisions. No re-classification: which
  workflow/roles/skills apply to a task never changes just because a decision was confirmed, so this never
  re-runs `routeWorkflow`. A task-handoff.md from before this phase (no recoverable state) or none at all is
  left exactly as-is — `null`, no error, no regression.

**`bin/juntia.js`:**

- `runRoute` now loads `.juntia/decisions.json` and passes it to `buildTaskHandoff`, so a freshly-started task
  already shows relevant, previously-confirmed decisions as baseline context, not just an empty section.
- `runConfirm` calls `refreshTaskHandoffDecisions(projectRoot, decisions)` right after its existing
  `writeContext` call, and prints one line naming the file when it was refreshed.

**`lib/governance/bootstrap.js` / `templates/governance/rules/agent-rules.md`:** both updated with one short,
generic instruction pointing at the new section — never Snake-specific, never a value, only a pointer to where
the mechanism lives.

## Distinguishing the four states, and who owns each

| State | Where it lives | Who controls it |
|---|---|---|
| **Proposed** | An agent's own working understanding — not yet written anywhere Juntia tracks | The agent, entirely — Juntia has no visibility into a value an agent is merely considering |
| **Pending** | `.juntia/pending.json` (a question — `type`, `question`, `context`, `options` — never an answer; `validateDecisionRequest` structurally forbids an agent from setting its own answer) | The agent proposes it; Juntia validates its shape |
| **Confirmed** | `.juntia/decisions.json` (`status: 'active'`, `confirmedAt` set, original `text`/`type`/`question`/`options` frozen forever) + `.juntia/DECISIONS.md` (narrative) + `.juntia/context.md` (summary) + `.juntia/task-handoff.md`'s own "Confirmed decisions" section (this phase) | Only a human, via `juntia confirm` — structurally, not by convention: `recordDecision` is the only function in the codebase that can create one, and it only runs after a real typed answer |
| **Applied** | Not a persisted status. A decision stops being flagged "confirmed since this task started" once a NEW task begins (a fresh `juntia route` call resets the task's own `generatedAt` baseline) | The agent — Juntia never asserts a decision was applied to code, because it cannot verify that without patching source itself, which it must not do |

**Conflicted** (Phase 12K, pre-existing, unchanged by this phase) is orthogonal to the table above: a decision
whose cited evidence a later `analyze` no longer finds is marked `status: 'conflicted'` and stays visible,
flagged `[CONFLICTED — ...]`, in every surface that lists it, including the new "Confirmed decisions" section
— never silently dropped, never silently trusted as still valid.

"Applied" was deliberately NOT added as a fourth persisted status. The alternative — an agent (or a command)
explicitly marking a decision `applied` — was evaluated and rejected: Juntia has no way to verify a code change
actually implements a decision correctly, so a self-reported "applied" flag would let a decision look resolved
without being resolved, the opposite of what this phase is for. Scoping "new" to the task's own lifetime gives
the same practical signal (has this decision had a chance to be acted on in the current unit of work) without
Juntia ever claiming something about code it did not check.

## Should a workflow declare a post-confirmation phase?

Evaluated, and rejected as unnecessary complexity, per this phase's own "no inventes sistema complejo si no es
necesario" constraint. The `## Confirmed decisions` section is generated by Core
(`buildTaskHandoff`/`refreshTaskHandoffDecisions`), reading `.juntia/decisions.json` directly — it appears in
every task-handoff.md for every workflow automatically, with no per-workflow markdown declaration needed. A
declarative "apply confirmed decisions" phase in each of the four `.juntia/governance/workflows/*.md` files
would duplicate what Core already provides uniformly, for no real gain — and would need `workflow-knowledge.js`
parsing changes with no corresponding new information to extract. Nothing in `templates/governance/workflows/`
was touched by this phase.

## What this deliberately does not do

- **Does not patch source code.** Every file this phase writes is one already generated and regenerated by
  Juntia (`task-handoff.md`, alongside the pre-existing `context.md`/`BOOTSTRAP.md`) — never a project's own
  source file. `test/decision-continuity.test.js` asserts this directly (`src/config.ts` byte-identical before
  and after the full confirm cycle).
- **Does not let an agent self-confirm.** No new write path to `decisions.json` was added; `recordDecision`
  remains the only function that can create one, still only reachable from `runConfirm`'s own human-typed
  answer.
- **Does not reword a human's answer.** The confirmed `text` embedded in the new section is the exact string
  `decisions-store.js` already froze at confirm time — no summarization, no rewriting.
- **Does not add a CLI command.** `juntia route`/`juntia confirm` are extended, not joined by a ninth command;
  `docs/CLI.md`'s eight-command surface is unchanged.
- **Does not add governance capabilities, roles, workflows, providers, or levels.** No new decision type, no
  new workflow file, no new signal, no new runtime profile.
- **Does not change the public `require('juntia')` API.** `task-handoff.js` remains internal-only, as it was
  before this phase (Phase 12C's boundary).

## Verification

- Full test suite (`npm test`): 449 tests, zero failures — 427 pre-existing plus 22 new (12 added to
  `test/task-handoff.test.js` for the module-level mechanism, 10 in a new `test/decision-continuity.test.js`
  reproducing the exact Snake failure mode end-to-end through the real, wired `runRoute`/`runConfirm` CLI
  functions).
- `test/decision-continuity.test.js` specifically reproduces and closes: a human answer that contradicts a
  provisional value reaching a later step of the same task; the same check surviving into a brand-new process
  (no reliance on in-memory/conversational state — the assertions re-read the file from disk); multiple
  decisions in one task; both product and architecture types; a confirmed value that happens to match what was
  proposed (still shown, not silently dropped); a decision aging from "new" into "already known" across a
  fresh `route` call; an unrelated historical (interpretation-type) decision correctly excluded from a
  different workflow's baseline section; and a conflicted decision staying visible and flagged alongside a
  fresh one.
- `test/agent-consumption-model.test.js`'s pre-existing byte-budget assertion (task-handoff.md < 5000 bytes)
  still passes unmodified — verified this phase's addition fits inside a constraint that already existed
  rather than needing that constraint loosened.
- Every pre-existing test in `test/task-handoff.test.js`, `test/cli-route.test.js`,
  `test/cli-confirm-context.test.js`, `test/decision-discovery.test.js`, and `test/bootstrap.test.js` passes
  unmodified — no behavior this phase didn't intend to change, changed.

## Answers to this phase's own closing questions

1. **¿Una decisión confirmada puede llegar automáticamente al contexto del agente?** Yes — `juntia confirm`
   now refreshes both `.juntia/context.md` (pre-existing) and `.juntia/task-handoff.md` (this phase)
   automatically, with no separate command required.
2. **¿El agente puede distinguir una decisión confirmada de su propuesta provisional?** Yes — the "Confirmed
   decisions" section separates what a task already knew from what was confirmed since it started, and shows
   the original question/options next to the actual confirmed answer for direct comparison.
3. **¿Una decisión humana puede contradecir correctamente la propuesta del agente?** Yes — nothing in this
   mechanism reconciles or blends a human's answer with an agent's own prior assumption; the human's `text` is
   shown verbatim, flagged, and `agent-rules.md`/`BOOTSTRAP.md` now state explicitly that it wins.
4. **¿El agente recibe la decisión en una nueva sesión sin depender de memoria conversacional?** Yes — every
   assertion in `test/decision-continuity.test.js` re-reads `task-handoff.md` from disk after the fact, never
   from in-process state held across the `route`/`confirm` calls.
5. **¿Juntia sigue sin modificar código fuente?** Yes — verified directly by test; every file this phase writes
   is Juntia's own generated navigation output, never a project source file.
6. **¿El gate humano sigue siendo obligatorio?** Yes, unchanged — `recordDecision` is still the only path to a
   decision, still only reachable through `runConfirm`'s own human-typed answer; this phase added no new write
   path to `decisions.json`.
7. **¿Las decisiones relevantes llegan al agente sin cargar todo DECISIONS.md?** Yes — the baseline section is
   filtered to the current workflow's own declared decision types, and the file stays under its pre-existing,
   tested 5000-byte budget.
8. **¿El flujo propuesto funciona para product y architecture decisions?** Yes — both are exercised end-to-end
   in `test/decision-continuity.test.js`; interpretation-type decisions are handled too (shown when confirmed
   mid-task, excluded from an unrelated workflow's type-filtered baseline).
9. **¿El bug exacto descubierto en Snake queda reproducido y cubierto por un test?** Yes — the first test in
   `test/decision-continuity.test.js` is exactly that scenario: a provisional value implied by an agent's own
   proposed options, contradicted by the human's real confirmed answer, verified to reach the active task file
   distinctly flagged.
10. **¿El circuito DECISION → CONFIRM → CONTEXT → AGENT → CODE queda realmente cerrado?** Closed as far as
    Juntia's own boundary extends: DECISION → CONFIRM → CONTEXT/TASK-HANDOFF → AGENT is now a real, tested,
    file-backed chain with no session-memory dependency. The last link, AGENT → CODE, was never Juntia's to
    close and still is not — "AI interprets. Juntia governs." The agent still has to read the section and act
    on it; what changed is that it now has a deterministic, unmissable place to find it, and a workflow-scoped
    fallback article (`agent-rules.md`) telling it to. Whether that's sufficient in practice is exactly what
    re-running the Snake experiment should now test.

## Does this change what Juntia is?

The phase's own hypothesis: "Juntia no solo registra decisiones; mantiene las decisiones confirmadas como
parte del estado operativo del proyecto para que los agentes puedan continuar el trabajo de forma coherente."

This phase demonstrates the property, not just states it: a confirmed decision is no longer inert history the
moment it lands in `decisions.json` — it is live input to the next step of whichever task is still open, sent
without repeating a whole DECISIONS.md, and self-expiring in relevance once a task actually moves on. This is
promoted from an implementation detail to a real architectural property: **Core / Knowledge Layer / Agent
remains the shape**, but "Core hands the Agent state, not just documentation" is now something this codebase
actually does, not only something `docs/ARCHITECTURE.md` claims.

## Known limitations after this phase

- **`templates/governance/rules/agent-rules.md` is scaffold-once.** A project that ran `juntia init` before
  this phase will not automatically receive the updated "Respect confirmed decisions" bullet — same limitation
  every prior Knowledge Layer content change already has (`decision-triggers.md`, `governance-signals.md`).
  `juntia update` (designed, not built — `docs/CLI.md#why-update-isnt-built-yet`) would be the real fix; out of
  this phase's scope.
- **The mechanism is honest, not enforced.** Nothing prevents an agent from reading `task-handoff.md`,
  ignoring the "Confirmed decisions" section, and finishing anyway — Juntia governs by making the right
  information unmissable, never by blocking. This is the architecture's own stated boundary, not a gap this
  phase failed to close.
- **No live-agent re-validation yet.** This phase closes the mechanism the Snake session found broken, verified
  by unit/integration tests against the real CLI — it does not itself re-run the Snake experiment. That is the
  named next step, not part of this phase's own deliverable.

**Verdict: CONTINUE.** The real gap the Snake experiment found — a confirmed decision not reliably reaching the
agent — is closed with the smallest mechanism that reuses the existing `route`/`confirm` cycle, verified by a
direct reproduction of the original failure mode. The system is ready for the Snake experiment to be re-run to
check whether confirmed decisions now actually land in the game's code.
