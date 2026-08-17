'use strict';

// Just-In-Time Governance phase — end-to-end tests for the second of this
// phase's two objectives: a decision must be able to surface WHILE an agent
// is working, not only in a single review pass before or after
// implementation. This exercises the real, wired chain — `runRoute`
// (routing), a decision request written to `.juntia/pending.json` (exactly
// what `.juntia/governance/skills/governance-review/SKILL.md` tells an agent
// to do the moment it notices a decision), `runConfirm` (the human answer),
// and `.juntia/task-handoff.md` (task-state continuity, reusing the Decision
// Continuity phase's own `refreshTaskHandoffDecisions` mechanism) — never
// internal functions in isolation.
//
// What this CANNOT automate, and does not pretend to: the actual moment an
// agent, mid-reasoning, decides "this is a real decision, I should escalate
// it now" is a live judgment call inside whichever AI runtime is doing the
// work (Claude Code, today) — not something Juntia computes or this test
// suite can simulate. Every test below stands in for that moment with a
// direct file write (`upsertDecisionRequest`, or a raw `pending.json` write)
// at the exact point in the test where a real agent's own tool call would
// happen — deterministic and real for everything on Juntia's side of that
// boundary, honest about not covering the boundary itself. See this phase's
// own closing answers in `phases/just-in-time-governance.md` for the full,
// explicit account of what remains runtime-dependent.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, runRoute, runConfirm } = require('../bin/juntia.js');
const { upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-jit-governance-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = originalLog; });
  }
  console.log = originalLog;
  return result;
}

function scriptedPrompt(answers) {
  let i = 0;
  return async () => answers[i++];
}

function pendingPath(root) {
  return path.join(root, '.juntia', 'pending.json');
}

function taskHandoffText(root) {
  return fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
}

function confirmedSinceSection(handoffText) {
  return handoffText.split('Confirmed since this task started')[1].split('Already known')[0];
}

function alreadyKnownSection(handoffText) {
  return handoffText.split('Already known when this task started:')[1];
}

async function setupProject(root) {
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
}

// --- The central scenario: a decision appears WHILE the agent is working,
// not before, not after. -----------------------------------------------

test('a feature task starts with no pending decision, the agent works, a blocking decision is discovered mid-task, escalated, confirmed, and the SAME task-handoff.md reflects it without the feature needing to finish first', async () => {
  const root = tempProject();
  await setupProject(root);

  // 1. The agent discovers Juntia and starts the task.
  const route = silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));
  assert.equal(route.workflow, 'feature-development');

  // 2. No pending decision exists yet — the workflow's declared decision
  // areas (behavior, balancing, ...) are navigation, never auto-created
  // decision requests. This is the property that would break if Juntia (or
  // some future change) started guessing decisions up front instead of
  // waiting for the agent to notice a real one.
  assert.equal(fs.existsSync(pendingPath(root)), false, 'Juntia must never pre-create a decision request from a workflow\'s declared decision areas');
  const beforeDiscovery = taskHandoffText(root);
  assert.match(confirmedSinceSection(beforeDiscovery), /None yet\./);

  // 3. The agent "works" for a while (simulated — no code exists in this
  // test, only Juntia's own state) and, partway through, notices a real
  // decision area has become concrete. This is the moment
  // governance-review/SKILL.md tells it to escalate right then, not to keep
  // going and ask later.
  upsertDecisionRequest(root, {
    type: 'product',
    question: 'How many points does a single scoring event award?',
    context: 'scoring system, mid-implementation',
    options: ['10 (initial guess)', 'a smaller, tunable value'],
  });

  // 4. The pending decision exists NOW — proving escalation does not wait
  // for the feature to be otherwise finished. If this assertion required a
  // second `runRoute` call or a "finish the feature" step first, the
  // architecture would have regressed to the single-pass-at-the-end
  // pattern this phase closes.
  const { loadPending } = require('../lib/project-intelligence/pending-store.js');
  assert.equal(loadPending(root).items.length, 1);

  // 5. The human answers. This is the one gate that can never be skipped or
  // auto-approved by the agent.
  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));
  assert.equal(result.confirmed.length, 1);

  // 6. The SAME task's task-handoff.md — never a new one, never requiring
  // the agent to run any command beyond the `confirm` it already ran to get
  // the human's answer — now carries the confirmed decision, flagged.
  const afterConfirm = taskHandoffText(root);
  const since = confirmedSinceSection(afterConfirm);
  assert.match(since, /How many points does a single scoring event award/);
  assert.match(since, /CONFIRMED: 1/);

  // 7. The agent can now "continue implementing" (simulated: the confirmed
  // value is what a real implementation step would read) using the real
  // answer, not the provisional guess it proposed.
  assert.equal(loadDecisions(root).decisions[0].text, '1');
});

// --- A decision that CONTRADICTS the agent's own provisional value -------

test('a confirmed decision that contradicts the agent\'s own provisional value wins — the exact Snake-equivalent regression case, expressed generically', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));

  // The agent's own provisional reasoning, before asking: "10" is what it
  // would have silently written into code if nothing had prompted it to
  // check.
  upsertDecisionRequest(root, {
    type: 'product',
    question: 'How many points does a single scoring event award?',
    context: 'scoring system',
    options: ['10'],
  });

  // The human answers something that genuinely contradicts the provisional
  // guess.
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /CONFIRMED: 1/);
  assert.doesNotMatch(since, /CONFIRMED: 10/);
  assert.equal(loadDecisions(root).decisions[0].text, '1', 'the code-facing value must be the human\'s real answer, never the agent\'s own guess');
});

// --- A confirmed decision that happens to MATCH the provisional value ----

test('a confirmed decision that matches the agent\'s own provisional value is still recorded and shown, never silently skipped because "it was already right"', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'How many points per event?', context: 'c', options: ['1'] });

  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  assert.equal(loadDecisions(root).decisions.length, 1);
  assert.match(confirmedSinceSection(taskHandoffText(root)), /CONFIRMED: 1/);
});

// --- A SECOND decision, later in the SAME task — the mechanism re-fires ---

test('a second, independent decision discovered later in the same task re-triggers the exact same mechanism, without restarting the task or losing the first decision', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));

  // First decision, mid-task.
  upsertDecisionRequest(root, { type: 'product', question: 'How many points per event?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));
  assert.match(confirmedSinceSection(taskHandoffText(root)), /How many points per event/);

  // The agent keeps working on the SAME task and, further along, discovers
  // a second, unrelated decision — this time an architecture one.
  upsertDecisionRequest(root, { type: 'architecture', question: 'Where should the running score persist?', context: 'c', options: ['in memory', 'localStorage'] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['localStorage']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /How many points per event/, 'the first decision must still be visible');
  assert.match(since, /Where should the running score persist/, 'the second decision must also be visible');
  assert.equal(loadDecisions(root).decisions.length, 2);
});

// --- Multiple decisions, product AND architecture, confirmed together ----

test('multiple decisions of both product and architecture type are all persisted, narrated, and surfaced correctly', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));

  upsertDecisionRequest(root, { type: 'product', question: 'Points per event?', context: 'c', options: [] });
  upsertDecisionRequest(root, { type: 'architecture', question: 'Persist score where?', context: 'c', options: [] });
  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1', 'localStorage']) }));

  assert.equal(result.confirmed.length, 2);
  const { decisions } = loadDecisions(root);
  assert.ok(decisions.some((d) => d.type === 'product' && d.text === '1'));
  assert.ok(decisions.some((d) => d.type === 'architecture' && d.text === 'localStorage'));

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /product decision/);
  assert.match(narrative, /architecture decision/);

  const context = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
  assert.match(context, /product decision/);
  assert.match(context, /architecture decision/);
});

// --- Decisions across different workflows -------------------------------

test('a decision confirmed under one workflow is correctly filtered as baseline-relevant only when a later task shares its decision type — decisions from a different workflow do not leak in as if newly relevant', async () => {
  const root = tempProject();
  await setupProject(root);

  // Task 1: a feature task, one product decision confirmed.
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per event?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  // Task 2: a genuinely different workflow (investigation — LIGHT,
  // decisionTypes: ['architecture'] only, never product).
  const investigationRoute = silently(() => runRoute('¿Cómo funciona el sistema de puntuación actual?', root));
  assert.equal(investigationRoute.workflow, 'investigation');
  const investigationHandoff = taskHandoffText(root);
  // The confirmed product decision is not "new" to this task (it's from
  // before this task started) — and investigation.md declares only
  // "architecture" as a relevant decisionType, so a product-type decision
  // is correctly excluded from its baseline section too.
  assert.doesNotMatch(alreadyKnownSection(investigationHandoff), /Points per event/);
});

// --- A brand-new agent session (no conversational memory) ----------------

test('a brand-new session — a fresh `runRoute` call, no access to any prior in-process state — discovers the confirmed decision purely from files on disk', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per event?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  // A real session boundary always has real, measurable time between it and
  // the confirmation that preceded it — `juntia confirm` waits on a real
  // human typing an answer. This gap only needs to be larger than one
  // millisecond so the two real, wall-clock ISO timestamps this test
  // compares (`confirmedAt` vs. the next task's own `generatedAt`) don't
  // land in the exact same millisecond purely as an artifact of how fast
  // synchronous test code runs — a collision this test's own realistic
  // scenario (a brand-new session) would never hit in practice.
  await new Promise((resolve) => { setTimeout(resolve, 5); });

  // A new task, in what stands in for a brand-new agent session, on the
  // same workflow — the previously confirmed decision is real baseline
  // context from the very first read, no memory of the earlier calls above
  // required (this test function's own local variables are the only thing
  // "remembering" anything, and only `root`, a filesystem path, is reused).
  silently(() => runRoute('Implementa el modo difícil del juego.', root));
  const freshHandoff = taskHandoffText(root);
  assert.match(alreadyKnownSection(freshHandoff), /Points per event/);
  assert.match(confirmedSinceSection(freshHandoff), /None yet\./);
});

// --- The pending.json contract, exercised inside the just-in-time flow ---
// (Objective 1 and Objective 2 meeting in one real path: an agent escalating
// mid-task writes the bare-array shape, exactly as the fixed
// agent-rules.md now documents.)

test('a mid-task decision escalated via the bare-array pending.json shape (the real, fixed agent contract) flows through the exact same just-in-time path', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación del juego.', root));

  // The agent's own raw file write, mid-task — never upsertDecisionRequest.
  writeFile(root, '.juntia/pending.json', JSON.stringify([
    { type: 'product', question: 'Points per event?', context: 'scoring', options: ['10'] },
  ]));

  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /CONFIRMED: 1/);
});
