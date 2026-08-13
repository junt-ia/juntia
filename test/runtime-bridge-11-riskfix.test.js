'use strict';

// Phase 11 (Runtime Routing) — permanent regression tests over the frozen
// recording of real Claude Code CLI invocations for the routing blind-spot
// fix (test/fixtures/runtime-bridge-11-riskfix-results.js). No live CLI
// call here — same "record once, assert forever" discipline as
// test/runtime-bridge-11c.test.js and test/local-model-11a.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyIntent } = require('../lib/intent-router.js');
const { hasFalseConfidenceRisk } = require('../lib/runtime/false-confidence-risk-signal.js');
const recorded = require('./fixtures/runtime-bridge-11-riskfix-results.js');

test('both recorded cases still reproduce the exact real, unmodified Phase 04 deterministic result today', () => {
  for (const c of recorded.cases) {
    const det = classifyIntent(c.text);
    assert.equal(det.intent, c.deterministicOnly.intent, c.label);
    assert.equal(det.confidence, c.deterministicOnly.confidence, c.label);
    assert.equal(det.action, c.deterministicOnly.action, c.label);
  }
});

test('both recorded cases still trigger the false-confidence-risk escalation today', () => {
  for (const c of recorded.cases) {
    const det = classifyIntent(c.text);
    assert.equal(hasFalseConfidenceRisk(c.text, det), true, c.label);
  }
});

test('the real runtime result for both cases sets action="confirm", never silently "auto", closing the loop on Phase 08/09\'s two known false-confidence bugs', () => {
  for (const c of recorded.cases) {
    assert.equal(c.runtimeResult.action, 'confirm', c.label);
    assert.notEqual(c.runtimeResult.action, 'auto', `${c.label}: must not silently proceed`);
  }
});

test('the negation case: the real runtime explicitly surfaces the deterministic router\'s original wrong guess as alternateIntent', () => {
  const c = recorded.cases.find((x) => x.label.startsWith('negation'));
  assert.equal(c.runtimeResult.alternateIntent, 'NEW_FEATURE');
  assert.notEqual(c.runtimeResult.intent, 'NEW_FEATURE', 'the runtime did not simply repeat the deterministic router\'s wrong answer');
});

test('total real cost for closing the loop on both known bugs was a fraction of a cent to a few cents, not a material sum', () => {
  assert.ok(recorded.summary.totalRealCostUsd < 0.05);
});
