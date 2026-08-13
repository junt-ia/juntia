'use strict';

// Phase 11C — permanent regression tests over the frozen recording of REAL
// Claude Code CLI invocations (test/fixtures/runtime-bridge-11c-results.js).
//
// No live CLI call anywhere in this file — `npm test` must stay fully
// self-contained and reproducible without Claude Code CLI being installed
// or authenticated, same discipline as test/local-model-11a.test.js. The
// deterministic half of every comparison IS re-run for real here (it's
// free, fast, and the real, unmodified Phase 04 router), only the runtime
// half is asserted against the frozen recording.

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyIntent } = require('../lib/intent-router.js');
const recorded = require('./fixtures/runtime-bridge-11c-results.js');

test('the recorded deterministicOnly result for every matrix item matches the REAL, unmodified Phase 04 router today', () => {
  for (const item of recorded.primaryMatrix) {
    const real = classifyIntent(item.text);
    assert.equal(real.intent, item.deterministicOnly.intent, `intent mismatch for "${item.label}"`);
    assert.equal(real.confidence, item.deterministicOnly.confidence, `confidence mismatch for "${item.label}"`);
    assert.equal(real.action, item.deterministicOnly.action, `action mismatch for "${item.label}"`);
  }
});

test('deterministic-first routing: exactly 5 of 12 real matrix cases actually invoked the runtime', () => {
  const invoked = recorded.primaryMatrix.filter((i) => i.runtimeInvoked);
  assert.equal(invoked.length, 5);
  assert.deepEqual(invoked.map((i) => i.label).sort(), [
    'ambiguous_feature', 'colloquial_spanish', 'english',
    'genuine_paraphrase', 'potentially_dangerous_invented_assumption',
  ].sort());
});

test('CRITICAL FINDING preserved as a regression: both of Phases 08/09\'s known false-confidence cases (negation, retraction) are resolved deterministically and therefore NEVER reach the runtime bridge', () => {
  const negation = recorded.primaryMatrix.find((i) => i.label === 'negation');
  const retraction = recorded.primaryMatrix.find((i) => i.label === 'retraction');
  assert.equal(negation.runtimeInvoked, false);
  assert.equal(negation.deterministicOnly.action, 'auto', 'the known bug: confidently wrong, not honestly uncertain');
  assert.equal(retraction.runtimeInvoked, false);
  assert.equal(retraction.deterministicOnly.action, 'auto');
});

test('every real runtime-invoked case that reached AMBIGUOUS/low/ask never claims high confidence (no false-confidence case introduced by the runtime path in this real run)', () => {
  const invoked = recorded.primaryMatrix.filter((i) => i.runtimeInvoked && i.finalResult);
  for (const item of invoked) {
    assert.notEqual(item.finalResult.confidence, 'high', `unexpected high confidence for "${item.label}"`);
  }
});

test('genuine_paraphrase: the organic timeout is preserved as real evidence, not discarded, and the retry is a separate, clearly-labeled data point', () => {
  const item = recorded.primaryMatrix.find((i) => i.label === 'genuine_paraphrase');
  assert.equal(item.firstAttempt.outcome, 'timeout');
  assert.ok(item.firstAttempt.durationMs > item.firstAttempt.timeoutMs, 'the real timeout exceeded the configured limit, as expected');
  assert.equal(item.retryAtLongerTimeout.finalResult.action, 'confirm', 'the retry did not silently auto-proceed despite picking a specific intent');
});

test('failure experiments: all 3 real failure modes (2 timeouts, 1 missing binary) fail safely to AMBIGUOUS/ask, never to a guessed intent', () => {
  const real = recorded.failureExperiments.filter((f) => f.real !== false);
  assert.equal(real.length, 3);
  for (const f of real) {
    assert.equal(f.bridgeFallback.intent, 'AMBIGUOUS');
    assert.equal(f.bridgeFallback.action, 'ask');
  }
});

test('cost: 6 successful real calls on claude-haiku-4-5 cost a total well under $0.10, and zero calls used a paid API key', () => {
  assert.ok(recorded.costSummary.totalCostUsd < 0.10);
  assert.equal(recorded.authMethod.includes('no API key used'), true);
});
