'use strict';

// Decision Continuity phase — end-to-end reproduction of the real bug a live
// Snake dogfooding session found: an agent proposes a decision request
// (`.juntia/pending.json`), a human confirms an answer that genuinely
// contradicts a provisional value the agent had already assumed, and the
// confirmed decision needs to reach the agent's ACTIVE task file
// (`.juntia/task-handoff.md`), distinctly flagged as new, not just
// `.juntia/context.md` (already handled, correctly, before this phase — see
// test/cli-confirm-context.test.js). Two of four confirmed decisions never
// reached the game's real code in that session because nothing closed this
// specific link.
//
// Exercises only the real, wired CLI functions (`runRoute`, `runConfirm`) —
// the same path an agent and a human actually drive — never the internal
// module functions directly (those have their own dedicated tests in
// test/task-handoff.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, runRoute, runConfirm } = require('../bin/juntia.js');
const { upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-decision-continuity-test-'));
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
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runAnalyze(root));
}

// --- the exact 10-step scenario ---

test('the exact Snake bug, reproduced and closed: a human-confirmed value that contradicts the agent\'s provisional proposal reaches a later step of the same task, in a way the agent can tell apart from what it already knew', async () => {
  const root = tempProject();
  await setupProject(root);

  // 1-2. The agent starts a task; a provisional decision is a real, open
  // question sitting in pending.json (never an answer — see decision-model.js).
  const route = silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  assert.equal(route.workflow, 'feature-development');
  upsertDecisionRequest(root, {
    type: 'product',
    question: 'How many points does eating one piece of food award?',
    context: 'scoring',
    options: ['1 point flat', 'points grow with each food eaten'],
  });

  // Before confirmation: no decision exists yet, and the task handoff has
  // nothing "confirmed since" — nothing to apply yet.
  const beforeConfirm = taskHandoffText(root);
  assert.match(confirmedSinceSection(beforeConfirm), /None yet\./);
  assert.deepEqual(loadDecisions(root).decisions, []);

  // 3-4. The human confirms a real, free-text answer that genuinely
  // contradicts what a flat "1 point" provisional value would have been —
  // never anything the pending request itself proposed.
  const result = await silently(() => runConfirm(root, {
    prompt: scriptedPrompt(['Points must grow with each food eaten, not stay fixed at 1.']),
  }));
  assert.equal(result.confirmed.length, 1);
  assert.equal(loadDecisions(root).decisions[0].text, 'Points must grow with each food eaten, not stay fixed at 1.');

  // 5-7. Juntia updates the state/context an agent's NEXT step reads — both
  // context.md (pre-existing) and, the real fix, task-handoff.md.
  const contextMd = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
  assert.match(contextMd, /Points must grow with each food eaten/);

  const afterConfirm = taskHandoffText(root);
  const since = confirmedSinceSection(afterConfirm);

  // 8. The agent can identify a decision it must apply: distinctly flagged,
  // not just present somewhere in a big file.
  assert.match(since, /How many points does eating one piece of food award/);
  assert.match(since, /Points must grow with each food eaten, not stay fixed at 1\./);
  assert.doesNotMatch(since, /None yet\./);

  // 9. The confirmed text is the human's real answer — never a mechanically
  // rewritten or reworded version, never one of the agent's own proposed
  // options standing in for it.
  assert.doesNotMatch(since, /CONFIRMED: 1 point flat/);

  // 10. Traceable after the fact: DECISIONS.md (human-readable) and
  // decisions.json (structured) both retain the original question, the
  // options that were on the table, and the confirmed answer.
  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /Points must grow with each food eaten/);
  const decision = loadDecisions(root).decisions[0];
  assert.equal(decision.question, 'How many points does eating one piece of food award?');
  assert.deepEqual(decision.options, ['1 point flat', 'points grow with each food eaten']);
});

// --- what the test must fail on (each verified as its own, separate case) ---

test('fails the intent of this phase if a decision only reaches decisions.json/context.md but never the active task-handoff.md', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Q1?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['A1']) }));

  const handoff = taskHandoffText(root);
  assert.match(handoff, /A1/, 'the confirmed answer must reach task-handoff.md, not just context.md');
});

test('a brand-new session (no conversational memory) can still tell a confirmed decision apart from a provisional one, purely from files on disk', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, {
    type: 'product', question: 'How many points per food?', context: 'scoring', options: ['1'],
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['grows with each food eaten']) }));

  // A "new session" reads only what's on disk now — no access to the prior
  // in-process state above.
  const freshRead = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
  const since = confirmedSinceSection(freshRead);
  assert.match(since, /grows with each food eaten/);
});

test('juntia never modifies real project source files while closing this loop', async () => {
  const root = tempProject();
  await setupProject(root);
  writeFile(root, 'src/config.ts', 'export const POINTS_PER_FOOD = 1;\n');
  const before = fs.readFileSync(path.join(root, 'src', 'config.ts'), 'utf8');

  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Q?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['A']) }));

  assert.equal(fs.readFileSync(path.join(root, 'src', 'config.ts'), 'utf8'), before);
});

// --- additional required coverage ---

test('several decisions confirmed in the same task are all listed', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per food?', context: 'c', options: [] });
  upsertDecisionRequest(root, { type: 'architecture', question: 'Persist high score where?', context: 'c', options: [] });

  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['grows each food', 'localStorage']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /Points per food\?/);
  assert.match(since, /grows each food/);
  assert.match(since, /Persist high score where\?/);
  assert.match(since, /localStorage/);
});

test('product and architecture decisions are both supported', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'architecture', question: 'Grid-based or pixel-based collision?', context: 'c', options: ['grid', 'pixel'] });

  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['grid']) }));

  const decision = loadDecisions(root).decisions[0];
  assert.equal(decision.type, 'architecture');
  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /architecture decision/);
});

test('a decision matching the agent\'s own provisional value is still shown as confirmed (agreement is not silently dropped)', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per food?', context: 'c', options: ['1'] });

  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['1']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /CONFIRMED: 1/);
});

test('a decision already confirmed and re-queried later (e.g. re-running route for a new task) moves from "new" to "already known"', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per food?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['grows each food']) }));

  // Confirmed within the first task — shows as new.
  assert.match(confirmedSinceSection(taskHandoffText(root)), /grows each food/);

  // A real task boundary always has real, measurable time between it and
  // the confirmation that preceded it (see test/just-in-time-governance.test.js
  // for the same, fuller explanation) — this only needs to be more than one
  // millisecond so the two ISO timestamps compared below don't collide as an
  // artifact of how fast synchronous test code runs.
  await new Promise((resolve) => { setTimeout(resolve, 5); });

  // A new task starts (fresh `route` call) — the same decision is now
  // baseline context, not a surprise anymore.
  const secondRoute = silently(() => runRoute('Añade un modo de juego difícil a Snake.', root));
  assert.equal(secondRoute.workflow, 'feature-development');
  const afterNewTask = taskHandoffText(root);
  assert.match(confirmedSinceSection(afterNewTask), /None yet\./);
  assert.match(alreadyKnownSection(afterNewTask), /grows each food/);
});

test('a historical decision unrelated to the current task workflow does not flood task-handoff.md — only this workflow\'s own declared decision types are baseline-relevant', async () => {
  const root = tempProject();
  await setupProject(root);

  // An interpretation-type decision (fact-grounded, not product/architecture)
  // confirmed long before the current task.
  silently(() => runRoute('some earlier task', root));
  await silently(() => runConfirm(root)); // nothing pending, no-op

  const { upsertPending } = require('../lib/project-intelligence/pending-store.js');
  upsertPending(root, {
    interpretation: 'This project uses Phaser as its main engine.',
    confidence: 'high',
    basedOn: ['dependency:phaser'],
    unknowns: [],
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  // A new, unrelated task starts.
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  const handoff = taskHandoffText(root);
  assert.doesNotMatch(alreadyKnownSection(handoff), /Phaser/, 'an interpretation-type decision is not a product/architecture baseline concern for this workflow');
});

test('a decision that later conflicts with changed facts stays visible, flagged, in the task handoff, never silently dropped or silently trusted', async () => {
  const root = tempProject();
  await setupProject(root);
  const { upsertPending } = require('../lib/project-intelligence/pending-store.js');
  upsertPending(root, {
    interpretation: 'This project uses Phaser as its main engine.',
    confidence: 'high',
    basedOn: ['dependency:phaser'],
    unknowns: [],
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  // The dependency the decision cited disappears — the next analyze flags it.
  writeFile(root, 'package.json', JSON.stringify({ dependencies: {} }));
  await silently(() => runAnalyze(root));
  assert.equal(loadDecisions(root).decisions[0].status, 'conflicted');

  // A fresh decision, confirmed after this conflict, still surfaces normally
  // — a conflicted decision does not block the mechanism for others.
  silently(() => runRoute('Implementa el sistema de puntuación de Snake.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Points per food?', context: 'c', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['grows each food']) }));

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /grows each food/);
});
