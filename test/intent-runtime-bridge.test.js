'use strict';

// Phase 11C — deterministic unit tests for lib/intent-runtime-bridge.js:
// routing (when is the runtime invoked at all) and failure handling
// (runtime error, validation failure). Uses a MOCK adapter throughout, per
// the brief's explicit "mocks may be used for deterministic unit tests of
// validation, routing, failure handling" — the real Claude CLI adapter is
// exercised separately, in test/intent-runtime-bridge-real.test.js, against
// a frozen recording of real invocations (same "record once, assert
// forever" discipline as test/local-model-11a.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { interpretIntent, actionFor } = require('../lib/intent-runtime-bridge.js');

function neverCalledAdapter() {
  return { interpret: async () => { throw new Error('adapter must not be invoked for this case'); } };
}

function mockAdapter(response) {
  return { interpret: async () => response };
}

// --- Routing: deterministic-first ------------------------------------------

test('routing: a clean, non-AMBIGUOUS deterministic result never invokes the runtime adapter', async () => {
  const r = await interpretIntent('Actualiza la dependencia de Stripe a la última versión menor.', { adapter: neverCalledAdapter() });
  assert.equal(r.source, 'deterministic');
  assert.equal(r.runtimeInvoked, false);
  assert.equal(r.result.intent, 'MAINTENANCE');
});

test('routing: an AMBIGUOUS deterministic result DOES invoke the runtime adapter', async () => {
  let called = false;
  const adapter = { interpret: async () => { called = true; return { ok: true, raw: JSON.stringify({ intent: 'NEW_FEATURE', confidence: 'medium', interpretation: 'x', unknowns: [], evidence: [] }) }; } };
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(called, true);
  assert.equal(r.runtimeInvoked, true);
});

test('routing: deterministicOnly=true never invokes the adapter even when AMBIGUOUS', async () => {
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter: neverCalledAdapter(), deterministicOnly: true });
  assert.equal(r.source, 'deterministic');
  assert.equal(r.runtimeInvoked, false);
});

test('routing: no adapter supplied falls back to the deterministic result, even when AMBIGUOUS', async () => {
  const r = await interpretIntent('Algo pasa con las reservas.', {});
  assert.equal(r.source, 'deterministic');
  assert.equal(r.result.intent, 'AMBIGUOUS');
});

// --- Failure handling: runtime failure --------------------------------------

test('failure: runtime error (ok: false) falls back to AMBIGUOUS/ask, never to an invented result', async () => {
  const adapter = mockAdapter({ ok: false, error: 'timeout', message: 'killed after 30000ms', durationMs: 30000 });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.source, 'runtime_failure_fallback');
  assert.equal(r.result.intent, 'AMBIGUOUS');
  assert.equal(r.result.action, 'ask');
  assert.equal(r.runtimeMeta.error, 'timeout');
});

test('failure: binary_not_found is reported precisely, not disguised as another error type', async () => {
  const adapter = mockAdapter({ ok: false, error: 'binary_not_found', message: 'spawn claude ENOENT', durationMs: 2 });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.runtimeMeta.error, 'binary_not_found');
  assert.equal(r.result.intent, 'AMBIGUOUS');
});

// --- Failure handling: validation failure -----------------------------------

test('failure: malformed runtime output falls back to AMBIGUOUS/ask, never enters governance as-is', async () => {
  const adapter = mockAdapter({ ok: true, raw: 'not valid json', durationMs: 100 });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.source, 'validation_failure_fallback');
  assert.equal(r.result.intent, 'AMBIGUOUS');
  assert.equal(r.result.action, 'ask');
});

test('failure: runtime output containing a forbidden governance field is rejected, not silently stripped and accepted', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({ intent: 'NEW_FEATURE', confidence: 'high', interpretation: 'x', unknowns: [], evidence: [], action: 'auto' }),
    durationMs: 100,
  });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.source, 'validation_failure_fallback');
  assert.ok(r.validation.errors.some((e) => e.includes('action')));
});

// --- Success path: governance re-applied by Juntia, not the runtime --------

test('success: a valid, high-confidence, no-unknowns runtime result gets action="auto"', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({ intent: 'MAINTENANCE', confidence: 'high', interpretation: 'Bump a dependency.', unknowns: [], evidence: ['clear maintenance language'] }),
    durationMs: 500,
  });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.source, 'runtime');
  assert.equal(r.result.action, 'auto');
  assert.deepEqual(r.result.questions, []);
});

test('success: a valid AMBIGUOUS runtime result gets action="ask", regardless of the confidence it claims', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({ intent: 'AMBIGUOUS', confidence: 'low', interpretation: 'Not enough information.', unknowns: [{ topic: 'goal', reason: 'unspecified' }], evidence: [] }),
    durationMs: 500,
  });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.result.action, 'ask');
});

test('success: the runtime response never determines `action` itself — actionFor() is pure Juntia governance logic, independently testable', () => {
  assert.equal(actionFor('AMBIGUOUS', 'low', false), 'ask');
  assert.equal(actionFor('NEW_FEATURE', 'low', false), 'ask');
  assert.equal(actionFor('NEW_FEATURE', 'medium', true), 'confirm', 'medium confidence + an open unknown must not proceed silently');
  assert.equal(actionFor('ARCHITECTURE', 'medium', false), 'confirm', 'medium confidence on a high-risk intent must not proceed silently, even with no explicit unknowns');
  assert.equal(actionFor('MAINTENANCE', 'medium', false), 'auto', 'medium confidence on a low-risk intent with no unknowns is safe to auto-proceed');
  assert.equal(actionFor('MAINTENANCE', 'high', false), 'auto');
});

// --- Phase 11 (Runtime Routing): the false-confidence-risk escalation path -

test('routing: the negation false-confidence bug (Phase 08) now escalates, with escalationReason="false_confidence_risk"', async () => {
  let called = false;
  const adapter = { interpret: async () => { called = true; return { ok: true, raw: JSON.stringify({ intent: 'AMBIGUOUS', confidence: 'low', interpretation: 'x', unknowns: [{ topic: 'x', reason: 'y' }], evidence: [] }) }; } };
  const r = await interpretIntent('No añadas nada, solo revisa el código.', { adapter });
  assert.equal(called, true);
  assert.equal(r.runtimeInvoked, true);
  assert.equal(r.escalationReason, 'false_confidence_risk');
});

test('routing: the retraction false-confidence bug (Phase 09) now escalates, with escalationReason="false_confidence_risk"', async () => {
  const adapter = { interpret: async () => ({ ok: true, raw: JSON.stringify({ intent: 'ARCHITECTURE', confidence: 'medium', interpretation: 'x', unknowns: [{ topic: 'x', reason: 'y' }], evidence: [] }) }) };
  const r = await interpretIntent('Antes queríamos multi-tenant, pero ya no lo necesitamos.', { adapter });
  assert.equal(r.runtimeInvoked, true);
  assert.equal(r.escalationReason, 'false_confidence_risk');
});

test('routing: an AMBIGUOUS escalation is still tagged escalationReason="ambiguous", not conflated with the risk-signal path', async () => {
  const adapter = mockAdapter({ ok: true, raw: JSON.stringify({ intent: 'NEW_FEATURE', confidence: 'medium', interpretation: 'x', unknowns: [], evidence: [] }) });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.escalationReason, 'ambiguous');
});

test('routing: a clean, confident, non-risky result still never invokes the runtime (the new condition did not broaden escalation generally)', async () => {
  const r = await interpretIntent('El checkout falla cuando el carrito tiene más de 10 productos.', { adapter: neverCalledAdapter() });
  assert.equal(r.source, 'deterministic');
  assert.equal(r.escalationReason, null);
});

test('success: runtimeMeta carries cost/latency observability data through to the caller', async () => {
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({ intent: 'BUG', confidence: 'high', interpretation: 'x', unknowns: [], evidence: [] }),
    durationMs: 812,
    costUsd: 0.0031,
    usage: { input_tokens: 50, output_tokens: 20 },
  });
  const r = await interpretIntent('Algo pasa con las reservas.', { adapter });
  assert.equal(r.runtimeMeta.durationMs, 812);
  assert.equal(r.runtimeMeta.costUsd, 0.0031);
});
