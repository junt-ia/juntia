'use strict';

// Confirmation Channel Hardening phase — final, end-to-end audit of the full
// governance flow validated during restaurant-game M04:
//
//   agent detects a decision -> pending request -> WAITING_HUMAN_CONFIRMATION
//   -> human confirms -> READY_TO_CONTINUE -> task-handoff updated -> agent
//   continues
//
// This file does not re-benchmark that flow — it verifies the mechanism is
// still stable after this phase's changes (the confirm-channel fix, the
// task-handoff.md gitignore change), using only the real, wired functions
// (`runRoute`, `runConfirm`, `runContext`) and, where the scenario is
// specifically about the input channel, the real CLI binary as a spawned
// child process — never a reimplementation or a mocked-out shortcut.
//
// Covers the eight minimal cases this phase's own audit named:
//   1. A confirmed decision equal to the provisional value.
//   2. A confirmed decision different from the provisional value.
//   3. Several decisions in the same task.
//   4. Confirmation via pipe.
//   5. Confirmation via file redirection.
//   6. A new session reading already-existing decisions.
//   7. Confirmation with no prior task-handoff.
//   8. Confirmation with an existing task-handoff.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  runAnalyze, runRoute, runConfirm, init,
} = require('../bin/juntia.js');
const { upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');

const BIN = path.join(__dirname, '..', 'bin', 'juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-flow-hardening-test-'));
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

function taskHandoffPath(root) {
  return path.join(root, '.juntia', 'task-handoff.md');
}

function taskHandoffText(root) {
  return fs.readFileSync(taskHandoffPath(root), 'utf8');
}

function taskStatusSection(handoffText) {
  return handoffText.split('## Task Status')[1].split('Task type:')[0];
}

function confirmedSinceSection(handoffText) {
  return handoffText.split('Confirmed since this task started')[1].split('Already known')[0];
}

async function setupProject(root) {
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runAnalyze(root));
}

function assertRanToCompletion(result) {
  assert.equal(result.error, undefined, `spawn failed: ${result.error && result.error.message}`);
  assert.equal(result.signal, null, `process was killed (signal ${result.signal})`);
  assert.equal(result.status, 0, `exited non-zero (stderr: ${result.stderr})`);
}

// --- 1. A confirmed decision equal to the provisional value ----------------

test('1. a decision confirmed with the same value an agent had provisionally assumed still records and reflects correctly', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación.', root));

  upsertDecisionRequest(root, {
    type: 'product', question: 'How many points per item eaten?', context: 'scoring', options: ['1', '10'], reason: 'no existing rule',
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['10']) }));

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, '10');

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /How many points per item eaten\?/);
  assert.match(since, /CONFIRMED: 10/);
});

// --- 2. A confirmed decision different from the provisional value ----------

test('2. a decision confirmed differently than a provisional value the agent had assumed is reflected, distinctly flagged, in task-handoff.md — the exact Decision Continuity scenario, still holding after this phase', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación.', root));

  // The agent's own working assumption (never written to any Juntia file —
  // Juntia has no visibility into a value merely being considered) is "1
  // point per item," reflected in the options offered.
  upsertDecisionRequest(root, {
    type: 'product', question: 'How many points per item eaten?', context: 'scoring', options: ['1', 'grows with each item'], reason: 'no existing rule',
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['Points must grow with each item eaten, not stay fixed at 1.']) }));

  const handoff = taskHandoffText(root);
  const since = confirmedSinceSection(handoff);
  assert.match(since, /Points must grow with each item eaten, not stay fixed at 1\./);
  assert.doesNotMatch(since, /CONFIRMED: 1\b/, 'the contradicted provisional value must not appear as if it were the real answer');

  assert.match(taskStatusSection(handoff), /READY_TO_CONTINUE/);
});

// --- 3. Several decisions in the same task ----------------------------------

test('3. several decisions confirmed within the same task are all recorded and all reach task-handoff.md', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación y de vidas.', root));

  upsertDecisionRequest(root, { type: 'product', question: 'How many lives?', options: ['1', '3'] });
  upsertDecisionRequest(root, { type: 'architecture', question: 'Where does score live?', options: ['global store', 'component state'] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['3', 'global store']) }));

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /How many lives\?.*CONFIRMED: 3/);
  assert.match(since, /Where does score live\?.*CONFIRMED: global store/);
});

// --- 4 & 5. Confirmation via pipe / file redirection, through the full ----
// route -> pending -> confirm -> task-handoff chain (not just decisions.json
// in isolation, per cli-confirm-io.test.js's own narrower scope).

test('4. confirmation via a real shell pipe reaches task-handoff.md through the full route/pending/confirm chain', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'How many points per item eaten?', options: ['1', '10'] });

  const result = spawnSync(process.execPath, [BIN, 'confirm'], {
    cwd: root, input: 'ten-per-item', encoding: 'utf8', timeout: 10000,
  });
  assertRanToCompletion(result);

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /CONFIRMED: ten-per-item/);
});

test('5. confirmation via real file redirection reaches task-handoff.md through the full route/pending/confirm chain', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'How many points per item eaten?', options: ['1', '10'] });

  const answersFile = path.join(root, '..', `${path.basename(root)}-answers.txt`);
  fs.writeFileSync(answersFile, 'ten-per-item\n');
  const fd = fs.openSync(answersFile, 'r');
  let result;
  try {
    result = spawnSync(process.execPath, [BIN, 'confirm'], {
      cwd: root, stdio: [fd, 'pipe', 'pipe'], encoding: 'utf8', timeout: 10000,
    });
  } finally {
    fs.closeSync(fd);
    fs.rmSync(answersFile, { force: true });
  }
  assertRanToCompletion(result);

  const since = confirmedSinceSection(taskHandoffText(root));
  assert.match(since, /CONFIRMED: ten-per-item/);
});

// --- 6. A new session reading already-existing decisions --------------------

test('6. a brand-new process (a real "new session," not in-memory state) reads back a decision confirmed by an earlier process', () => {
  const root = tempProject();
  init(root);
  upsertDecisionRequest(root, { type: 'product', question: 'What timeout should the wait screen use?', options: [] });

  const confirmResult = spawnSync(process.execPath, [BIN, 'confirm'], {
    cwd: root, input: 'fifteen-seconds\n', encoding: 'utf8', timeout: 10000,
  });
  assertRanToCompletion(confirmResult);

  // A genuinely separate process, with no in-memory state from the one
  // above — `juntia context` re-reads decisions.json/facts.json from disk.
  const contextResult = spawnSync(process.execPath, [BIN, 'context'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  assertRanToCompletion(contextResult);
  assert.match(contextResult.stdout, /fifteen-seconds/);
});

// --- 7. Confirmation with no prior task-handoff ------------------------------

test('7. confirming with no task-handoff.md at all still updates decisions.json/DECISIONS.md/context.md, and never creates task-handoff.md as a side effect', async () => {
  const root = tempProject();
  await setupProject(root);
  // Deliberately no runRoute call — no task-handoff.md exists yet.
  assert.equal(fs.existsSync(taskHandoffPath(root)), false);

  upsertDecisionRequest(root, { type: 'product', question: 'Q?', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['answer']) }));

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.match(fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8'), /answer/);
  assert.match(fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8'), /answer/);
  assert.equal(fs.existsSync(taskHandoffPath(root)), false, 'confirm must never invent a task-handoff.md that was never routed');
});

// --- 8. Confirmation with an existing task-handoff ---------------------------

test('8. confirming with an existing task-handoff.md refreshes it in place, preserving the original request', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de puntuación.', root));
  assert.equal(fs.existsSync(taskHandoffPath(root)), true);

  upsertDecisionRequest(root, { type: 'product', question: 'Q?', options: [] });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['answer']) }));

  const handoff = taskHandoffText(root);
  assert.match(handoff, /Implementa el sistema de puntuación\./, 'the original request must be preserved, never re-classified');
  assert.match(confirmedSinceSection(handoff), /CONFIRMED: answer/);
});
