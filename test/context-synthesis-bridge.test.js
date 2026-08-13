'use strict';

// Phase 12J — deterministic unit tests for
// lib/project-intelligence/context-synthesis-bridge.js. Uses a MOCK
// adapter throughout, same discipline as test/intent-runtime-bridge.test.js
// — the real Claude CLI adapter is exercised separately in a real,
// documented run (see the phase doc), not in this fast/CI-safe suite.

const test = require('node:test');
const assert = require('node:assert/strict');
const { synthesizeContext, buildRequestText } = require('../lib/project-intelligence/context-synthesis-bridge.js');

const FACTS = [
  { category: 'dependency', name: 'phaser', value: '^3.60.0', evidence: { source: 'package.json' } },
  { category: 'structure.directory', name: 'src/scenes', evidence: { source: 'scan' } },
];
const EMPTY_DIFF = { added: [], removed: [], changed: [] };

function mockAdapter(response) {
  return { interpret: async () => response };
}

// --- No adapter / not invoked ------------------------------------------------

test('no adapter supplied -> never invoked, fails to nothing (not a guess)', async () => {
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, {});
  assert.equal(r.invoked, false);
  assert.equal(r.ok, false);
  assert.equal(r.result, null);
  assert.match(r.reason, /no runtime adapter supplied/);
});

// --- Input contract -----------------------------------------------------------

test('buildRequestText renders every fact by its exact factKey identifier and includes the diff', () => {
  const diff = { added: [{ category: 'dependency', name: 'phaser' }], removed: [], changed: [] };
  const text = buildRequestText(FACTS, diff);
  assert.match(text, /FACTS:/);
  assert.match(text, /- id:\[dependency:phaser\] value:"\^3\.60\.0" evidence:package\.json/);
  assert.match(text, /- id:\[structure\.directory:src\/scenes\] evidence:scan/);
  assert.match(text, /CHANGES:/);
  assert.match(text, /\+ added: dependency:phaser/);
  assert.match(text, /EXISTING CONTEXT:/);
});

test('buildRequestText reports no changes plainly when the diff is empty', () => {
  const text = buildRequestText(FACTS, EMPTY_DIFF);
  assert.match(text, /No changes since the previous scan/);
});

// --- Runtime failure ------------------------------------------------------

test('runtime failure (ok: false) fails to nothing, never fabricates an interpretation', async () => {
  const adapter = mockAdapter({ ok: false, error: 'timeout', message: 'killed after 30000ms', durationMs: 30000 });
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.equal(r.invoked, true);
  assert.equal(r.ok, false);
  assert.equal(r.result, null);
  assert.match(r.reason, /runtime failure: timeout/);
  assert.equal(r.runtimeMeta.error, 'timeout');
});

// --- Validation failure -----------------------------------------------------

test('malformed runtime output fails to nothing, never enters the caller as-is', async () => {
  const adapter = mockAdapter({ ok: true, raw: 'not json', durationMs: 50 });
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.equal(r.ok, false);
  assert.match(r.reason, /failed validation/);
});

test('a hallucinated basedOn citation is rejected by the bridge, not passed through', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({
      interpretation: 'This project uses a real-time multiplayer engine.',
      confidence: 'high',
      basedOn: ['dependency:socket.io'],
      unknowns: [],
    }),
    durationMs: 400,
  });
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not present in the real scan/);
});

test('a runtime response that tries to smuggle a "decision" or "action" field is rejected, never reaches the caller as a decision', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({
      interpretation: 'This is a Phaser game.',
      confidence: 'high',
      basedOn: ['dependency:phaser'],
      unknowns: [],
      decision: 'Keep using Phaser',
    }),
    durationMs: 400,
  });
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.equal(r.ok, false);
  assert.match(r.reason, /"decision"/);
});

// --- Success path -------------------------------------------------------------

test('a valid, fact-grounded interpretation is accepted and returned, with no action/decision field anywhere on it', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({
      interpretation: 'The project appears to use Phaser as its main technology.',
      confidence: 'medium',
      basedOn: ['dependency:phaser', 'structure.directory:src/scenes'],
      unknowns: [{ topic: 'game genre', reason: 'no gameplay files were scanned' }],
    }),
    durationMs: 600,
    costUsd: 0.002,
  });
  const r = await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.equal(r.invoked, true);
  assert.equal(r.ok, true);
  assert.equal(r.result.confidence, 'medium');
  assert.deepEqual(r.result.basedOn, ['dependency:phaser', 'structure.directory:src/scenes']);
  assert.equal('action' in r.result, false);
  assert.equal('decision' in r.result, false);
  assert.equal('questions' in r.result, false);
  assert.equal(r.runtimeMeta.costUsd, 0.002);
});

test('the adapter is always called with this domain\'s systemPrompt/schema, never the intent domain\'s', async () => {
  let received;
  const adapter = { interpret: async (text, opts) => { received = opts; return { ok: false, error: 'stop', durationMs: 1 }; } };
  await synthesizeContext(FACTS, EMPTY_DIFF, { adapter });
  assert.match(received.systemPrompt, /project intelligence/);
  assert.equal(received.schema.required.includes('basedOn'), true);
  assert.equal(received.schema.required.includes('intent'), false);
});

test('an empty-facts project (nothing scanned): any interpretation the runtime returns is rejected, since basedOn can never cite a real fact that does not exist', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({
      interpretation: 'This is probably a game.',
      confidence: 'low',
      basedOn: ['dependency:phaser'],
      unknowns: [],
    }),
    durationMs: 100,
  });
  const r = await synthesizeContext([], EMPTY_DIFF, { adapter });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not present in the real scan/);
});
