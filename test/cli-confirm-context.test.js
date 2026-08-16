'use strict';

// Phase 12K — end-to-end tests for bin/juntia.js's `confirm` and `context`
// commands, and the full FACT -> INTERPRETATION -> CONFIRMATION -> DECISION
// -> CONTEXT cycle through the real, wired CLI functions (runAnalyze ->
// runConfirm -> runContext).
//
// Redefined by Phase 13D: an interpretation is no longer produced by Juntia
// calling an AI runtime — it is seeded directly into `.juntia/pending.json`
// via `upsertPending`, the same way an external AI agent following
// `.juntia/agent-instructions.md` would after Juntia's own AI Handoff. A
// scripted `prompt` function still stands in for a real human at a
// terminal — that part of the flow is unchanged.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAnalyze, runConfirm, runContext,
} = require('../bin/juntia.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending, upsertPending, upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-confirm-test-'));
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

const PHASER_INTERPRETATION = {
  interpretation: 'This project appears to use Phaser as its main engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser'],
  unknowns: [],
};

// Simulates the AI Handoff's real result: a real `analyze` run (to persist
// real facts.json), followed by an external agent's proposal landing in
// pending.json — exactly what `upsertPending` is for, and exactly the
// shape `.juntia/agent-instructions.md` documents.
async function analyzeAndPropose(root, interpretation) {
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  await silently(() => runAnalyze(root));
  upsertPending(root, interpretation);
}

// --- una propuesta válida está lista para confirmar --------------------------

test('a proposal seeded via the AI Handoff is a real pending item, ready to confirm', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);

  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'pending');
  assert.equal(items[0].interpretation, PHASER_INTERPRETATION.interpretation);
});

// --- confirmación genera decisión --------------------------------------------

test('confirming a pending interpretation creates a real, persisted decision', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  assert.deepEqual(result.confirmed.length, 1);
  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, PHASER_INTERPRETATION.interpretation);
  assert.equal(decisions[0].status, 'active');
});

test('confirming appends a real, human-readable entry to .juntia/DECISIONS.md', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /This project appears to use Phaser as its main engine\./);
});

// --- rechazo elimina pendiente ------------------------------------------------

test('rejecting a pending interpretation removes it and creates no decision', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['n']) }));

  assert.deepEqual(result.rejected.length, 1);
  assert.deepEqual(loadPending(root).items, []);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- decisión conserva evidencia original ------------------------------------

test('a decision keeps its exact original basedOn/confidence even though nothing forces it to stay in sync with a later analyze', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const before = loadDecisions(root).decisions[0];

  // A later analyze with a completely different project shape must not
  // rewrite the decision's own stored evidence.
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }));
  await silently(() => runAnalyze(root));

  const after = loadDecisions(root).decisions[0];
  assert.deepEqual(after.basedOn, before.basedOn);
  assert.equal(after.confidence, before.confidence);
  assert.equal(after.text, before.text);
});

// --- IA nunca crea decisiones -------------------------------------------------

test('no decision is ever created just by a proposal sitting in pending.json, no matter how confident — only a real "y" answer to confirm can create one', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, { ...PHASER_INTERPRETATION, confidence: 'high' });

  assert.deepEqual(loadDecisions(root).decisions, [], 'a pending proposal alone must never write decisions.json');
});

test('a "skip" (neither y nor n) answer to confirm leaves the item pending and creates no decision', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['maybe later']) }));

  assert.deepEqual(result.confirmed, []);
  assert.deepEqual(result.rejected, []);
  assert.equal(loadPending(root).items.length, 1, 'the item must still be pending, not silently dropped');
  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- decisiones sobreviven a nuevos análisis ---------------------------------

test('a confirmed decision survives running analyze again, even when the underlying facts have not changed', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  await silently(() => runAnalyze(root));
  await silently(() => runAnalyze(root));

  assert.equal(loadDecisions(root).decisions.length, 1);
});

// --- cambios en facts generan posibles conflictos ----------------------------

test('removing the dependency a decision was based on flags that decision "conflicted" on the next analyze, without deleting it', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  writeFile(root, 'package.json', JSON.stringify({ dependencies: {} })); // phaser removed
  const captured = [];
  const originalLog = console.log;
  console.log = (line) => captured.push(line);
  try {
    await runAnalyze(root);
  } finally {
    console.log = originalLog;
  }

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1, 'the decision must still exist');
  assert.equal(decisions[0].status, 'conflicted');
  assert.ok(captured.some((l) => l.includes('needing review')));
});

// --- pending item grounded in stale/invented facts is not asked about at confirm time -

test('confirm skips (and drops) a pending item whose cited facts no longer exist, without asking the user to confirm it blind', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);

  writeFile(root, 'package.json', JSON.stringify({ dependencies: {} })); // phaser removed
  await silently(() => runAnalyze(root)); // refresh facts.json, phaser gone

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'y'; } }));

  assert.equal(promptCalled, false, 'must never ask about an interpretation whose evidence is already gone');
  assert.equal(result.stale.length, 1);
  assert.deepEqual(loadPending(root).items, []);
});

test('confirm rejects a proposal that cites a fact identifier that was never real (an invented/hallucinated citation), without asking', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  await silently(() => runAnalyze(root));
  upsertPending(root, {
    interpretation: 'This project uses a real-time multiplayer engine.',
    confidence: 'high',
    basedOn: ['dependency:socket.io'], // never a real fact in this project
    unknowns: [],
  });

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'y'; } }));

  assert.equal(promptCalled, false);
  assert.equal(result.stale.length, 1);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

test('confirm rejects a malformed proposal (missing required fields), without asking or crashing', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  await silently(() => runAnalyze(root));
  upsertPending(root, { interpretation: '', confidence: 'medium', basedOn: ['dependency:phaser'], unknowns: [] });

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'y'; } }));

  assert.equal(promptCalled, false);
  assert.equal(result.stale.length, 1);
});

// --- una propuesta que ya coincide con una decisión confirmada no vuelve a preguntarse -

test('confirm recognizes a proposal that matches an already-confirmed decision and drops it without asking again', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  // An agent proposes the exact same interpretation again (same basedOn) —
  // plausible if it did not read .juntia/context.md closely.
  upsertPending(root, PHASER_INTERPRETATION);

  let promptCalled = false;
  await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'y'; } }));

  assert.equal(promptCalled, false, 'must never re-ask about something already confirmed');
  assert.equal(loadDecisions(root).decisions.length, 1, 'must not create a duplicate decision');
  assert.deepEqual(loadPending(root).items, []);
});

// --- contexto generado solo contiene información permitida ------------------

test('juntia context never includes a pending, unconfirmed interpretation — only confirmed facts/decisions', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  // deliberately never confirmed — still pending

  const markdown = silently(() => runContext(root));

  assert.doesNotMatch(markdown, /appears to use Phaser/);
  assert.match(markdown, /No decisions confirmed yet/);
});

test('juntia context includes a real confirmed decision, with its real evidence', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const markdown = silently(() => runContext(root));

  assert.match(markdown, /This project appears to use Phaser as its main engine\./);
  assert.match(markdown, /dependency:phaser/);
});

test('confirm automatically refreshes .juntia/context.md after a real confirmation, without a separate `juntia context` call', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const contextPath = path.join(root, '.juntia', 'context.md');
  assert.ok(fs.existsSync(contextPath));
  assert.match(fs.readFileSync(contextPath, 'utf8'), /This project appears to use Phaser as its main engine\./);
});

test('confirm with zero pending items does nothing and does not crash', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));

  const result = await silently(() => runConfirm(root));
  assert.deepEqual(result, { confirmed: [], rejected: [], stale: [] });
});

// --- Phase 15F: product/architecture decision requests through the real,
// wired `confirm` CLI — the real restaurant-game M04 scenario this phase is
// grounded in (a wait-timeout duration with no fact to cite).

const WAIT_TIMEOUT_REQUEST = {
  type: 'product',
  question: '¿Cuánto tiempo espera un cliente antes de abandonar?',
  context: 'NPC waiting system',
  options: ['10000ms', '15000ms', '20000ms'],
};

test('a human\'s real, free-text answer to a decision request creates a real, persisted decision — never anything the request itself proposed', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['15000ms']) }));

  assert.equal(result.confirmed.length, 1);
  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].type, 'product');
  assert.equal(decisions[0].text, '15000ms');
  assert.equal(decisions[0].source, 'human');
});

test('an AI agent can never self-approve a decision request — the pending item never carries the answer, only confirm\'s own human-typed input does', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);

  // The item sitting in pending.json — exactly what an agent could have
  // written — structurally has no answer field at all to smuggle one in.
  const { items } = loadPending(root);
  assert.equal(items[0].text, undefined);
  assert.equal(items[0].decision, undefined);
});

test('"skip" leaves a decision request pending, creating no decision', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['skip']) }));

  assert.deepEqual(result.confirmed, []);
  assert.equal(loadPending(root).items.length, 1);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

test('"reject" discards a decision request entirely — no longer pending, no decision created', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['reject']) }));

  assert.deepEqual(result.rejected.length, 1);
  assert.deepEqual(loadPending(root).items, []);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

test('an invalid decision request (an agent trying to smuggle its own answer via a forbidden field) is dropped without ever asking', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  // Hand-written directly to pending.json, bypassing upsertDecisionRequest's
  // own honest shape — simulating a real, untrusted, malicious/broken agent
  // write, the same threat model every other validator in this codebase
  // defends against.
  const pendingPath = path.join(root, '.juntia', 'pending.json');
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({
    schemaVersion: 1,
    items: [{
      id: 'x', type: 'product', question: 'What should it be?', text: '15000ms', status: 'pending',
    }],
  }));

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return '15000ms'; } }));

  assert.equal(promptCalled, false, 'must never ask about a request that already tried to set its own answer');
  assert.equal(result.stale.length, 1);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

test('confirming a product decision appends it to DECISIONS.md and refreshes context.md, both labeled distinctly from an interpretation', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['15000ms']) }));

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /15000ms — product decision/);

  const context = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
  assert.match(context, /15000ms \(product decision/);
});

test('a decision request and a fact interpretation both pending at once are each handled correctly by the same confirm run', async () => {
  const root = tempProject();
  await analyzeAndPropose(root, PHASER_INTERPRETATION);
  upsertDecisionRequest(root, WAIT_TIMEOUT_REQUEST);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y', '15000ms']) }));

  assert.equal(result.confirmed.length, 2);
  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);
  assert.ok(decisions.some((d) => d.type === 'interpretation'));
  assert.ok(decisions.some((d) => d.type === 'product'));
});
