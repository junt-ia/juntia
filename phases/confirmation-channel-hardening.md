# Confirmation Channel Hardening

## Vision this phase is grounded in

> AI interprets. Juntia governs.

This phase adds no new governance capability. It exists to make the mechanism the whole architecture rests
on — a human confirming a decision — actually robust and honestly described, before publishing a new beta.
Three real findings from a second restaurant-game dogfooding session (M04 v2) drove it:

1. `juntia confirm` worked when answered via `< file` redirection, but failed silently over a shell pipe
   (`printf "answer" | juntia confirm`).
2. `source: "human"` cannot technically guarantee a human answered — an agent with shell access can run
   `juntia confirm` itself.
3. `.juntia/task-handoff.md` is regenerable state, but was not treated coherently with `facts.json`/
   `pending.json`, the other two regenerable artifacts.

## Objective 1 — the confirm-channel bug, audited and fixed

### The audit

Traced through the real code before writing any fix, per this phase's own "reproduce first, then fix"
constraint. `bin/juntia.js`'s `runConfirm` took an injectable `prompt` function, defaulting to
`defaultPrompt` — a function that, on every single call, created a NEW `readline.Interface` over
`process.stdin`, asked one question, and closed it. Every pre-existing test in this codebase injects a
scripted `prompt` double, so none of them ever exercised this default path against real stdin — the bug had
no test coverage of any kind before this phase.

Reproduced directly, isolating Node's own readline behavior from anything Juntia-specific:

```
$ printf 'respuesta-pipe' | node -e "readline.createInterface(...).question('Q: ').then(a => console.log(a))"
Q: (hangs — no 'line' event ever fires, no error, process left running)
```

Two independent, real bugs, not one:

1. **Missing trailing newline.** `readline/promises`' `rl.question()` waits for a `'line'` event, which
   Node's `readline` only emits for a *terminated* line. `printf "answer"` (no trailing `\n`) never produces
   one before the stream ends — `question()` never resolves.
2. **A second `readline.Interface` on the same stream loses data.** Independently of (1): creating a SECOND
   interface, for a second pending item, on the same already-flowing non-TTY stdin silently drops whatever
   the first interface had already buffered. Reproduced with a perfectly newline-terminated `< file`, not
   only a pipe — the original dogfooding report ("file redirection works") only ever exercised a single
   decision in one session; two decisions in one `confirm` run broke it too. Confirmed directly against the
   pre-fix code:

```
$ printf 'primera\nsegunda\n' > two.txt
$ node bin/juntia.js confirm < two.txt
[product decision] Q1?
Your decision (or "skip"/"reject"): Recorded as a decision.

[product decision] Q2?
Your decision (or "skip"/"reject"): <process exits here — no error, no "Recorded", no "Updated context.md">
```

This is the SILENT failure the dogfooding report actually described: the process does not hang forever — once
stdin fully closes, nothing is left keeping Node's event loop alive, so the process exits on its own, having
silently abandoned the second question with no error message and no completed state.

### The fix

No new command, no parallel confirmation system, no change to the validation/persistence logic itself —
`runConfirm`'s loop body (validate → prompt → `recordDecision`/`removePending` → refresh
context/task-handoff) is untouched. Only how the DEFAULT prompt function reads input changed
(`bin/juntia.js`):

- `createDefaultPromptSession(input, output)` — for a real TTY, keeps the familiar live `readline/promises`
  prompt, now on ONE persistent `readline.Interface` for the whole session instead of a fresh one per
  question (removes the same class of bug (2) would otherwise also risk on a real terminal, and is strictly
  simpler). For non-TTY input (a pipe or `< file` redirection — Node presents both identically; there is no
  API that distinguishes them), reads every available line up front, ONCE, on one persistent interface, then
  serves answers from that queue. `readline`'s own `'close'` handling flushes a final, unterminated line as
  one more `'line'` event before firing, so bug (1) is also gone. A question asked after the queue is
  exhausted resolves to `''` (the same "blank answer" `runConfirm` already treats as "skip this one for
  now") — a confirm session must never hang, even when asked more questions than the input actually
  answered.
- `makeAsk(prompt)` — the one place `runConfirm`/`runSetup` decide whether they own a session (created
  lazily, on the first real question — never merely because the command ran) or are using an injected test
  double (unchanged for every pre-existing test) or a session `runSetup` created and is sharing with the
  `runConfirm` call it makes internally (so the two never independently attach to the same stdin — the exact
  class of bug (2) again, avoided by construction).

### Does "no caminos diferentes según el origen del input" hold?

Yes, with one honestly-stated exception. A raw terminal (TTY) and a byte stream (pipe/file) are different I/O
models — Node has no single API that reads both the same way, so the INPUT-READING mechanism necessarily
branches on `input.isTTY`. What does NOT differ, for any of the three channels: the `(question) =>
Promise<answer>` contract each one satisfies, and everything downstream of it —
validation (`validateDecisionRequest`/`validateProjectInterpretation`), persistence (`recordDecision`,
`removePending`), and refresh (`writeContext`, `refreshTaskHandoffDecisions`) are the exact same calls,
unconditionally, regardless of channel. Between the two non-TTY channels specifically — pipe and file
redirection — there is now genuinely zero difference: both attach a non-TTY stream to fd 0, and Node's
`readline` cannot tell them apart, so neither can this code.

## Objective 2 — the `source: "human"` trust model, corrected

### What was wrong

`decisions-store.js`'s own header comment claimed `source: 'human'` was "recorded unconditionally... as a
structural record of that guarantee" without stating what the guarantee actually was. `docs/CLI.md` claimed
`confirm` "never runs without a human present." Both are true only in the narrow sense that no AI code path
in this codebase writes `decisions.json` directly — neither is true in the sense a reader would naturally
take them: that Juntia can verify a human, specifically, answered. It cannot. `recordDecision` is reachable
only from `runConfirm`, but nothing prevents an agent with shell access from invoking `juntia confirm`
itself and answering its own escalated question — no keystroke telemetry, no session identity, nothing
inside a single CLI process can observe that boundary.

### The correction (not a new mechanism)

The field is unchanged — still named `source`, still valued `"human"`, still written unconditionally by
`recordDecision`, still enforced structurally that an agent can never pre-fill its own answer
(`validateDecisionRequest` forbids a decision request from carrying one). Only the documentation changed, to
state what is actually true:

> `source: "human"` names the CHANNEL a confirmation went through — Juntia's own defined human-confirmation
> mechanism (`juntia confirm`, the only code path that can write `decisions.json`) — not a verified identity.

Three distinct things were named explicitly, per this phase's own evaluation of whether they needed
separating:

- **Confirmation channel** — what `source: "human"` actually asserts, and the one thing Juntia can and does
  enforce structurally.
- **Identity of whoever answered** — outside anything this process observes; not claimed.
- **Origin of the answer's content** — a human's own judgment vs. a value an agent suggested and a human
  merely accepted — also not claimed, and not something `source` was ever meant to distinguish.

No new field, no new schema version, no new mechanism was added — evaluated and rejected as unnecessary
complexity for a problem that is entirely a documentation-honesty gap, not a missing capability. Updated:
`lib/project-intelligence/decisions-store.js` (module + `recordDecision` header comments),
`docs/CONTEXT_SYNTHESIS.md` (new "What `source: "human"` actually means" section), `docs/CLI.md` (`confirm`
row rewritten), `docs/PROJECT_INTELLIGENCE.md` (automation-tier table's surrounding prose).

## Objective 3 — `.juntia/task-handoff.md`'s git lifecycle

### The audit

Compared against the two existing categories this codebase already draws:

| | `facts.json` / `pending.json` | `decisions.json` / `DECISIONS.md` |
|---|---|---|
| Git-ignored by default? | Yes (`ensureIgnored`, `facts-store.js`) | No — deliberately, per `decisions-store.js`'s own header |
| Why | Machine-regenerated snapshot/proposal — losing it costs nothing a re-run doesn't restore | An irreversible human choice — losing it loses real information nothing regenerates |

`task-handoff.md`'s every section — Task Status, Confirmed decisions, Potential decisions, the embedded
Agent Context — is computed fresh, on every write, from `decisions.json`/`pending.json`/the Knowledge
Layer/the route just resolved. The one part that ISN'T re-derivable from another file on disk — the original
request `text` and its `generatedAt` timestamp — is not lost information if the file is lost either: both are
exactly what a fresh `juntia route "<same request>"` call re-supplies, the same "just re-run the command that
made it" recovery `pending.json` already relies on (an agent re-proposes; nothing there is unrecoverable the
way a human's typed decision would be). It is also, by construction, PER-TASK and PER-CONTRIBUTOR — wholesale
overwritten by the next `juntia route` call, never accumulated — so committing it would mean noisy,
purely-local-state diffs on every branch, never real project history the way `DECISIONS.md` is.

### The decision

**Regenerable — added to `.juntia/.gitignore` by default**, via the exact same `ensureIgnored` helper
`facts.json`/`pending.json` already use (`lib/governance/task-handoff.js`'s `writeTaskHandoff` now calls it).
Never overwrites a project's own customized `.gitignore` beyond adding the one missing line — same
idempotent, additive discipline `ensureIgnored` already guarantees. Nothing was deleted: an existing,
already-committed `task-handoff.md` in a project that ran `juntia route` before this phase is left exactly
as-is on disk; the new `.gitignore` line only affects what git tracks going forward, and removing it from
version control (if a team wants to) remains a normal, manual `git rm --cached` a human chooses to run, never
something this phase does automatically.

## Objective 4 — final audit of the full governance flow

The mechanism validated during M04:

```
agent detects decision -> pending request -> WAITING_HUMAN_CONFIRMATION -> human confirms
-> READY_TO_CONTINUE -> task-handoff updated -> agent continues
```

Re-verified end-to-end after every change above, using only the real, wired functions (`runRoute`,
`runConfirm`, `runContext`) and, for the two channel-specific cases, the real CLI binary spawned as a child
process (`test/governance-flow-hardening.test.js`):

1. A decision confirmed equal to the provisional value — recorded and reflected correctly.
2. A decision confirmed different from the provisional value — the Decision Continuity phase's own scenario,
   still holding: the contradicted value never appears as if it were the real answer.
3. Several decisions in one task — all recorded, all reach `task-handoff.md`.
4. Confirmation via a real pipe — reaches `task-handoff.md` through the full chain, not just
   `decisions.json` in isolation.
5. Confirmation via real file redirection — same.
6. A brand-new process (not in-memory state) reading back a decision an earlier process confirmed —
   `juntia context`, spawned separately, sees it.
7. Confirmation with no prior `task-handoff.md` — `decisions.json`/`DECISIONS.md`/`context.md` still update;
   no `task-handoff.md` is invented as a side effect.
8. Confirmation with an existing `task-handoff.md` — refreshed in place, original request preserved, never
   re-classified.

## What this deliberately does not do

- **Does not add a new command.** `juntia confirm`/`route`/`context` are unchanged in their public surface;
  `docs/CLI.md`'s eight-command surface is unchanged.
- **Does not add a parallel confirmation mechanism.** Every input channel calls the exact same
  `runConfirm` loop, the exact same `recordDecision`/`removePending`/`writeContext`/
  `refreshTaskHandoffDecisions` calls.
- **Does not remove `source: "human"`, or rename it.** Still useful, still structurally guaranteed to come
  only from `runConfirm`; only its documented meaning was corrected.
- **Does not attempt to verify identity.** Explicitly evaluated and rejected — that would require Juntia to
  control or inspect the runtime/interface presenting the question, which contradicts its own stated
  boundary ("Juntia no intenta convertirse en un agente ni controlar el runtime externo").
- **Does not delete any existing `task-handoff.md`, or rewrite git history.** Only changes what gets ignored
  going forward.

## Verification

- Full test suite (`npm test`): 522 tests, zero failures — 505 pre-existing (all pass unmodified), plus 17
  new: 7 in `test/cli-confirm-io.test.js` (real child-process channel bugs — 4 of the 7 fail against the
  pre-fix `bin/juntia.js`, confirmed directly before the fix was accepted, restored to passing after), 8 in
  `test/governance-flow-hardening.test.js` (end-to-end audit, all eight named minimal cases), 2 in
  `test/task-handoff.test.js` (the new `.gitignore` behavior).
- The exact dogfooding reproduction (`printf 'respuesta-pipe' | node bin/juntia.js confirm`, and two
  decisions over `< file` redirection) verified manually against both the pre-fix and post-fix code, not
  only through the automated suite.

## Answers to this phase's own closing questions

1. **¿El bug de pipe en `juntia confirm` está resuelto?** Yes — verified both by real child-process tests and
   by manual reproduction of the exact dogfooding command against the fixed code.
2. **¿Pipe, archivo e interacción producen exactamente el mismo resultado?** Yes for outcome (decisions.json/
   DECISIONS.md/context.md/task-handoff.md content, aside from the confirmation timestamp) — verified
   directly by a parity test comparing all three channels against the identical answer. The one real
   difference is the input-READING mechanism itself (TTY live prompt vs. up-front line reading for
   non-TTY), which is unavoidable given Node's I/O model, not a behavioral difference in outcome.
3. **¿Existe alguna diferencia de comportamiento según el canal de entrada?** No difference in outcome
   between pipe and file redirection specifically — Node cannot distinguish them, so neither can this code.
   TTY differs only in mechanism (live vs. batch reading), never in what gets validated, persisted, or
   refreshed.
4. **¿Qué significa ahora exactamente `source: "human"`?** That the confirmation went through Juntia's own
   defined human-confirmation channel (`juntia confirm`, the only code path able to write
   `decisions.json`) — never that Juntia verified a human, specifically, answered.
5. **¿Juntia puede afirmar identidad humana? Si no, ¿cómo queda documentado?** No. Documented explicitly in
   `docs/CONTEXT_SYNTHESIS.md`'s new section and in `decisions-store.js`'s own header comment: identity
   verification is outside what any single CLI process can observe, and is the responsibility of whichever
   runtime/interface presents the question, not Juntia's.
6. **¿Cuál es la decisión tomada sobre `task-handoff.md`?** Regenerable — git-ignored by default, the same
   treatment `facts.json`/`pending.json` already have.
7. **¿Es regenerable o permanente?** Regenerable: every section is a pure function of other files already on
   disk plus the request text, which is itself recoverable by re-running the command that produced it.
8. **¿La confirmación sigue actualizando task-handoff/context/decisions correctamente?** Yes, across every
   channel, verified by the parity test and the eight end-to-end minimal cases.
9. **¿Puede un agente continuar después de una confirmación sin memoria conversacional?** Yes, unchanged from
   the Decision Continuity phase — every assertion re-reads state from disk, and case 6 above specifically
   verifies a brand-new OS process (not just a fresh function call) reads back a prior confirmation correctly.
10. **¿Qué limitaciones siguen dependiendo del runtime externo?** Whether an agent actually reads and acts on
    `task-handoff.md`'s "Confirmed decisions" section (Juntia governs by making the information unmissable,
    never by blocking); and — objective 2's own finding — whether the entity answering `juntia confirm` is
    genuinely a human, which is a property of the runtime/interface that presents the question, not something
    this process can observe or enforce.

**Verdict: CONTINUE.** The confirm mechanism is now robust to its real input channels and honestly described
where it cannot make a guarantee it never technically had. No new capability was added; nothing about the
governance model changed. The beta is ready to publish on this basis — re-running the M04-style dogfooding
experiment to measure impact remains the deliberately separate next step, not part of this phase.
