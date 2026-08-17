'use strict';

// Single Governance Source of Truth & Governance In-Flow phase — end-to-end
// tests for the TASK STATUS mechanism (ACTIVE / WAITING_HUMAN_CONFIRMATION /
// READY_TO_CONTINUE): the real, deterministic signal that lets a blocking
// decision stop the specific piece of work that depends on it, without
// Juntia becoming an agent or literally controlling an external runtime.
// Complements test/just-in-time-governance.test.js (which already covers
// the escalation timing itself) — this file is specifically about the
// STATUS an agent (or a brand-new session) reads back.
//
// Exercises only the real, wired CLI functions (`runRoute`, `runConfirm`),
// the same path an agent and a human actually drive.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAnalyze, runRoute, runConfirm,
} = require('../bin/juntia.js');
const { upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadDecisionTriggers } = require('../lib/governance/decision-triggers.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-in-flow-test-'));
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

function taskStatusSection(handoffText) {
  return handoffText.split('## Task Status')[1].split('Task type:')[0];
}

function embeddedAgentContext(handoffText) {
  const match = handoffText.match(/```json\n([\s\S]*?)\n```/);
  return JSON.parse(match[1]);
}

async function setupProject(root) {
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
}

// --- ACTIVE: the default, nothing blocking --------------------------------

test('a freshly started task has TASK STATUS: ACTIVE, both in the prose section and in the embedded Agent Context JSON', async () => {
  const root = tempProject();
  await setupProject(root);

  silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  const handoff = taskHandoffText(root);

  assert.match(taskStatusSection(handoff), /ACTIVE/);
  assert.equal(embeddedAgentContext(handoff).taskStatus, 'ACTIVE');
});

// --- Decision detected BEFORE implementation starts -----------------------

test('a decision detected before any implementation work (right after route, nothing else has happened yet) still produces WAITING_HUMAN_CONFIRMATION once escalated', async () => {
  const root = tempProject();
  await setupProject(root);

  silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  // The agent escalates immediately, before writing any code.
  upsertDecisionRequest(root, {
    type: 'product', question: 'What counts as an achievement-worthy event?', context: 'achievements', reason: 'A new gameplay rule with no existing definition.',
  });
  // Marks WAITING via the real, documented mechanism: run confirm, skip
  // because the human hasn't answered yet.
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));

  const handoff = taskHandoffText(root);
  assert.match(taskStatusSection(handoff), /WAITING_HUMAN_CONFIRMATION/);
  assert.match(taskStatusSection(handoff), /must not continue affected implementation/);
});

// --- Decision detected DURING implementation (mid-task) --------------------

test('a decision detected mid-task (after other, unrelated work already happened) also produces WAITING_HUMAN_CONFIRMATION, with the real question/area/reason/workflow shown', async () => {
  const root = tempProject();
  await setupProject(root);

  const route = silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  // ... agent works for a while (nothing to simulate on Juntia's side) ...
  upsertDecisionRequest(root, {
    type: 'architecture',
    question: 'Where should unlocked achievements persist?',
    context: 'save system',
    reason: 'A data-model change, hard to reverse once real save files exist.',
    options: ['localStorage', 'a save file'],
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));

  const handoff = taskHandoffText(root);
  const status = taskStatusSection(handoff);
  assert.match(status, /WAITING_HUMAN_CONFIRMATION/);
  assert.match(status, /Where should unlocked achievements persist\?/);
  assert.match(status, /Affected area: save system/);
  assert.match(status, /Reason requiring confirmation: A data-model change/);
  assert.match(status, new RegExp(`workflow: ${route.workflow}`));
});

// --- Non-blocking: the declarative mechanism exists and is readable -------
// (Juntia never executes "continue" itself — this verifies the declarative
// source an agent's own judgment reads is real and correctly distinguishes
// blocking from non-blocking, per decision-triggers.md's own contract.)

test('decision-triggers.md declares at least one non-blocking situation, readable via loadDecisionTriggers, distinct from the blocking ones', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));

  const { triggers } = loadDecisionTriggers(root);
  const nonBlocking = triggers.filter((t) => t.requiresConfirmation === false);
  const blocking = triggers.filter((t) => t.requiresConfirmation === true);
  assert.ok(nonBlocking.length > 0, 'at least one real, declared non-blocking trigger must exist');
  assert.ok(blocking.length > 0, 'at least one real, declared blocking trigger must exist');
});

test('a non-blocking situation never creates a pending item — Juntia has no path for a trigger to auto-create a decision request', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));

  // Simply loading/reading the triggers catalog — the only thing Juntia
  // itself ever does with it — must never write to pending.json.
  loadDecisionTriggers(root);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'pending.json')), false);
});

// --- confirm unblocks: WAITING -> READY_TO_CONTINUE -----------------------

test('once the human answers, TASK STATUS moves from WAITING_HUMAN_CONFIRMATION to READY_TO_CONTINUE, and the confirmed value is immediately available', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'What counts as an achievement-worthy event?', context: 'achievements' });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));
  assert.match(taskStatusSection(taskHandoffText(root)), /WAITING_HUMAN_CONFIRMATION/);

  // The human's real answer arrives.
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['Any boss defeat or 100% level completion.']) }));

  const handoff = taskHandoffText(root);
  const status = taskStatusSection(handoff);
  assert.match(status, /READY_TO_CONTINUE/);
  assert.doesNotMatch(status, /WAITING_HUMAN_CONFIRMATION/);
  assert.equal(embeddedAgentContext(handoff).taskStatus, 'READY_TO_CONTINUE');
  assert.match(handoff, /Any boss defeat or 100% level completion\./);
});

// --- A second blocking decision re-enters WAITING without restarting -----

test('a second blocking decision, discovered after the first was resolved, moves the task back to WAITING_HUMAN_CONFIRMATION — the same task, never restarted', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));

  upsertDecisionRequest(root, { type: 'product', question: 'Q1?', context: 'c1' });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['answer one']) }));
  assert.match(taskStatusSection(taskHandoffText(root)), /READY_TO_CONTINUE/);

  // Later, in the SAME task, a second, independent decision surfaces.
  upsertDecisionRequest(root, { type: 'architecture', question: 'Q2?', context: 'c2' });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));

  const status = taskStatusSection(taskHandoffText(root));
  assert.match(status, /WAITING_HUMAN_CONFIRMATION/);
  assert.match(status, /Q2\?/);
  assert.equal(loadDecisions(root).decisions.length, 1, 'only the first decision is confirmed so far');
});

// --- Multiple pending items: only the answered one clears -----------------

test('with two pending decisions, answering only one leaves the task WAITING on the other', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));

  upsertDecisionRequest(root, { type: 'product', question: 'Q1?', context: 'c1' });
  upsertDecisionRequest(root, { type: 'architecture', question: 'Q2?', context: 'c2' });

  // The human only answers the first one this round.
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['answer one', 'skip']) }));

  const status = taskStatusSection(taskHandoffText(root));
  assert.match(status, /WAITING_HUMAN_CONFIRMATION/);
  assert.match(status, /Q2\?/);
  assert.doesNotMatch(status, /Q1\?/, 'the already-answered question must not still be listed as pending');
});

// --- A brand-new session discovers WAITING status from disk alone --------

test('a brand-new session (a fresh process, no in-memory state) discovers WAITING_HUMAN_CONFIRMATION purely by reading task-handoff.md', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'What counts as an achievement-worthy event?', context: 'achievements' });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));

  // Simulates a completely new session: only the filesystem is read, no
  // reference to anything computed above.
  const freshHandoff = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
  assert.match(taskStatusSection(freshHandoff), /WAITING_HUMAN_CONFIRMATION/);
});

// --- Juntia never introduces an "applied" status ---------------------------

test('a confirmed decision never carries any status other than "active" (or "conflicted") — no "applied" status exists anywhere in decisions.json', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));
  upsertDecisionRequest(root, { type: 'product', question: 'Q?', context: 'c' });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['answer']) }));

  const { decisions } = loadDecisions(root);
  for (const d of decisions) {
    assert.ok(['active', 'conflicted'].includes(d.status), `unexpected decision status: ${d.status}`);
  }
});

// --- Real Knowledge Layer reflects the same rule, not hardcoded in JS -----

test('the BLOCKING/non-blocking rule is read from the real .juntia/governance/rules/decision-triggers.md file on disk, not computed in JavaScript', async () => {
  const root = tempProject();
  await setupProject(root);
  silently(() => runRoute('Implementa el sistema de logros del juego.', root));

  const triggersPath = path.join(root, '.juntia', 'governance', 'rules', 'decision-triggers.md');
  assert.ok(fs.existsSync(triggersPath));
  const raw = fs.readFileSync(triggersPath, 'utf8');
  assert.match(raw, /Requires confirmation/);

  // Editing the real file changes what loadDecisionTriggers reports —
  // proving the rule is genuinely read from disk, not a JS constant.
  fs.appendFileSync(triggersPath, '\n## custom_project_rule\n\n- **Type:** product\n- **Reason:** A project-specific situation.\n- **Requires confirmation:** yes\n');
  const { triggers } = loadDecisionTriggers(root);
  assert.ok(triggers.some((t) => t.trigger === 'custom_project_rule' && t.requiresConfirmation === true));
});
