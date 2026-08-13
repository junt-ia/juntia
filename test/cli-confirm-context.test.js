'use strict';

// Phase 12K — end-to-end tests for bin/juntia.js's `confirm` and `context`
// commands, and the full FACT -> INTERPRETATION -> CONFIRMATION -> DECISION
// -> CONTEXT cycle through the real, wired CLI functions (runAnalyze ->
// runConfirm -> runContext). A mock adapter stands in for the AI runtime
// (no live call in this suite, same discipline as test/cli-analyze-
// explain.test.js); a scripted `prompt` function stands in for a real
// human at a terminal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAnalyze, runConfirm, runContext,
} = require('../bin/juntia.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending } = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-confirm-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// See test/cli-analyze-explain.test.js's own comment on this same helper:
// a plain try/finally restores console.log before an async fn's own
// awaited work actually finishes, letting real output leak to the
// terminal. Fixed the same way here.
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

function mockAdapter(interpretation) {
  return {
    interpret: async () => ({
      ok: true,
      raw: JSON.stringify(interpretation),
      durationMs: 200,
    }),
  };
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

async function analyzeAndExplain(root, interpretation) {
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  await silently(() => runAnalyze(root, { explain: true, adapter: mockAdapter(interpretation) }));
}

// --- interpretación válida genera pending -----------------------------------

test('a valid interpretation from analyze --explain is persisted as a real pending item', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'pending');
  assert.equal(items[0].interpretation, PHASER_INTERPRETATION.interpretation);
});

// --- confirmación genera decisión --------------------------------------------

test('confirming a pending interpretation creates a real, persisted decision', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  assert.deepEqual(result.confirmed.length, 1);
  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, PHASER_INTERPRETATION.interpretation);
  assert.equal(decisions[0].status, 'active');
});

test('confirming appends a real, human-readable entry to .juntia/DECISIONS.md', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /This project appears to use Phaser as its main engine\./);
});

// --- rechazo elimina pendiente ------------------------------------------------

test('rejecting a pending interpretation removes it and creates no decision', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['n']) }));

  assert.deepEqual(result.rejected.length, 1);
  assert.deepEqual(loadPending(root).items, []);
  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- decisión conserva evidencia original ------------------------------------

test('a decision keeps its exact original basedOn/confidence even though nothing forces it to stay in sync with a later analyze', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
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

test('no decision is ever created by analyze --explain alone, no matter how confident the interpretation — only a real "y" answer to confirm can create one', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, { ...PHASER_INTERPRETATION, confidence: 'high' });

  assert.deepEqual(loadDecisions(root).decisions, [], 'analyze --explain must never write decisions.json by itself');
});

test('a "skip" (neither y nor n) answer to confirm leaves the item pending and creates no decision', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['maybe later']) }));

  assert.deepEqual(result.confirmed, []);
  assert.deepEqual(result.rejected, []);
  assert.equal(loadPending(root).items.length, 1, 'the item must still be pending, not silently dropped');
  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- decisiones sobreviven a nuevos análisis ---------------------------------

test('a confirmed decision survives running analyze again, even when the underlying facts have not changed', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  await silently(() => runAnalyze(root));
  await silently(() => runAnalyze(root));

  assert.equal(loadDecisions(root).decisions.length, 1);
});

// --- cambios en facts generan posibles conflictos ----------------------------

test('removing the dependency a decision was based on flags that decision "conflicted" on the next analyze, without deleting it', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
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

// --- pending item grounded in stale facts is not asked about at confirm time -

test('confirm skips (and drops) a pending item whose cited facts no longer exist, without asking the user to confirm it blind', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  writeFile(root, 'package.json', JSON.stringify({ dependencies: {} })); // phaser removed
  await silently(() => runAnalyze(root)); // refresh facts.json, phaser gone

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'y'; } }));

  assert.equal(promptCalled, false, 'must never ask about an interpretation whose evidence is already gone');
  assert.equal(result.stale.length, 1);
  assert.deepEqual(loadPending(root).items, []);
});

// --- contexto generado solo contiene información permitida ------------------

test('juntia context never includes a pending, unconfirmed interpretation — only confirmed facts/decisions', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
  // deliberately never confirmed — still pending

  const markdown = silently(() => runContext(root));

  assert.doesNotMatch(markdown, /appears to use Phaser/);
  assert.match(markdown, /No decisions confirmed yet/);
});

test('juntia context includes a real confirmed decision, with its real evidence', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const markdown = silently(() => runContext(root));

  assert.match(markdown, /This project appears to use Phaser as its main engine\./);
  assert.match(markdown, /dependency:phaser/);
});

test('confirm automatically refreshes .juntia/context.md after a real confirmation, without a separate `juntia context` call', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
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

// --- analyze --explain does not re-prompt for something already decided ----

test('re-running analyze --explain for the exact same fact set after it was already confirmed does not create a duplicate pending item', async () => {
  const root = tempProject();
  await analyzeAndExplain(root, PHASER_INTERPRETATION);
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  await analyzeAndExplain(root, PHASER_INTERPRETATION);

  assert.deepEqual(loadPending(root).items, [], 'must not re-queue something already decided');
  assert.equal(loadDecisions(root).decisions.length, 1);
});
