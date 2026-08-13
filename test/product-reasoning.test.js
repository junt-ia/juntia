'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../lib/intent-router.js');
const { analyzeProduct, BASE_LEVEL_BY_INTENT, CONTEXT_NEEDS } = require('../lib/product-reasoning.js');
const dataset = require('./fixtures/product-reasoning-dataset.js');

function reason(text, known) {
  return analyzeProduct(text, classifyIntent(text), known);
}

// --- Contract shape --------------------------------------------------------

test('analyzeProduct: always returns the full output contract', () => {
  const result = reason('Quiero añadir clientes VIP.');
  assert.match(result.level, /^(none|light|full)$/);
  assert.equal(typeof result.levelReason, 'string');
  for (const key of ['actors', 'desiredBehavior', 'constraints', 'knownDecisions', 'unknowns', 'decisionsRequired', 'acceptanceCriteria', 'nonGoals', 'questions']) {
    assert.ok(Array.isArray(result[key]), `${key} should be an array`);
  }
  assert.ok('problem' in result);
  assert.ok('goal' in result);
});

test('BASE_LEVEL_BY_INTENT covers every Phase 04 intent plus AMBIGUOUS, and ARCHITECTURE stays out of scope', () => {
  const { INTENTS } = require('../lib/intent-router.js');
  for (const intent of INTENTS) {
    assert.ok(intent in BASE_LEVEL_BY_INTENT, `missing level for ${intent}`);
  }
  assert.equal(BASE_LEVEL_BY_INTENT.ARCHITECTURE, 'none');
});

// --- First principle: never silently promote inference to fact -----------

test('First principle: a populated field never appears without an explicit status', () => {
  const result = reason('Quiero añadir clientes VIP con un 10% de descuento.');
  for (const b of result.desiredBehavior) {
    assert.match(b.status, /^(KNOWN|INFERRED)$/);
  }
});

test('First principle: an undefined named category is never silently treated as defined', () => {
  const result = reason('Quiero añadir clientes VIP.');
  assert.ok(result.unknowns.some((u) => u.topic.includes('VIP')));
  assert.ok(result.decisionsRequired.some((d) => d.topic.includes('VIP')));
});

// --- Consult-before-ask (Decision as an explicit, reused concept) --------

test('a supplied known decision resolves what would otherwise be a blocking unknown', () => {
  const withoutKnown = reason('Quiero cambiar cómo funcionan los clientes VIP.');
  assert.ok(withoutKnown.unknowns.some((u) => u.topic.includes('VIP')));

  const withKnown = reason('Quiero cambiar cómo funcionan los clientes VIP.', {
    decisions: [{ topic: 'VIP', decision: 'VIP = clientes con más de 10 reservas.', source: 'docs/PROJECT_STATE.md' }],
  });
  assert.equal(withKnown.unknowns.some((u) => u.topic.includes('VIP')), false);
  assert.ok(withKnown.knownDecisions.some((d) => d.decision.includes('10 reservas')));
});

test('acceptance criteria cite the known decision that resolved the unknown, when one was supplied', () => {
  const result = reason('Quiero cambiar cómo funcionan los clientes VIP.', {
    decisions: [{ topic: 'VIP', decision: 'VIP = clientes con más de 10 reservas.' }],
  });
  assert.ok(result.acceptanceCriteria.length > 0);
  assert.ok(result.acceptanceCriteria.every((c) => c.value.includes('10 reservas')));
});

// --- Unknown vs. question policy (blocking vs. non-blocking) -------------

test('every blocking unknown produces a question; nothing else does', () => {
  const result = reason('Quiero implementar beneficios especiales para clientes premium.');
  const blockingTopics = result.unknowns.filter((u) => u.blocking).map((u) => u.topic);
  assert.equal(result.questions.length, blockingTopics.length);
  for (const topic of blockingTopics) {
    assert.ok(result.questions.some((q) => q.startsWith(topic)));
  }
});

test('a clean request with no undefined categories produces zero unknowns and zero questions', () => {
  const result = reason('Quiero añadir reservas.');
  assert.deepEqual(result.unknowns, []);
  assert.deepEqual(result.questions, []);
});

// --- Proportionality: level must not exceed what the intent justifies ----

test('MAINTENANCE never reaches light or full, regardless of phrasing', () => {
  const result = reason('Actualiza la dependencia de Stripe a la última versión menor.');
  assert.equal(result.level, 'none');
});

test('a clean technical BUG (no definitional ambiguity) stays at level none', () => {
  const result = reason('El checkout falla cuando el carrito tiene más de 10 productos.');
  assert.equal(result.level, 'none');
});

test('a BUG whose fix depends on an undefined category escalates to light', () => {
  const result = reason('Los clientes VIP no reciben el descuento.');
  assert.equal(result.level, 'light');
  assert.ok(result.unknowns.some((u) => u.topic.includes('VIP')));
});

test('AMBIGUOUS intent with no hedging language stays at level none, deferring entirely to the Intent Router\'s own question', () => {
  const result = reason('Algo pasa con las reservas.');
  assert.equal(result.level, 'none');
  assert.deepEqual(result.questions, []);
});

test('AMBIGUOUS intent WITH hedging language is treated as an exploratory idea at light level', () => {
  const result = reason('Creo que deberíamos tener un programa de fidelización.');
  assert.equal(result.level, 'light');
  assert.ok(result.questions.length > 0);
});

// --- Architectural boundary: never decides HOW, only WHAT/WHY ------------

test('acceptance criteria describe observable behavior, never implementation (no function/class names)', () => {
  const result = reason('Quiero permitir cancelar reservas.', {
    decisions: [],
  });
  for (const c of result.acceptanceCriteria) {
    assert.doesNotMatch(c.value, /\bfunction\b|\bclass\b|\(\)/);
  }
});

test('CONTEXT_NEEDS never includes provider/model/runtime/framework choices', () => {
  for (const level of Object.keys(CONTEXT_NEEDS)) {
    const keys = Object.keys(CONTEXT_NEEDS[level]);
    for (const k of keys) {
      assert.ok(['product', 'project', 'architecture', 'state', 'decisions', 'constraints', 'unknowns', 'task'].includes(k));
    }
  }
});

// --- Full dataset (data-driven) -------------------------------------------

for (const [i, item] of dataset.entries()) {
  test(`dataset[${i}] (${item.bucket}) "${item.text}"`, () => {
    const intentResult = classifyIntent(item.text);
    const result = analyzeProduct(item.text, intentResult);

    assert.equal(intentResult.intent, item.expectedIntent, `intent mismatch: got ${intentResult.intent}`);
    assert.equal(result.level, item.expectedLevel, `level mismatch: got ${result.level} (${result.levelReason})`);

    const blockingTopics = result.unknowns.filter((u) => u.blocking).map((u) => u.topic);
    if (item.expectedFinding === 'miss') {
      // Deliberately documents a known limitation — assert the miss itself,
      // so a future fix has to consciously update this dataset entry
      // instead of silently changing behavior unnoticed.
      assert.deepEqual(blockingTopics, [], 'expected this documented miss to remain a miss');
    } else {
      for (const expected of item.expectedBlocking) {
        assert.ok(
          blockingTopics.some((t) => t.includes(expected)),
          `expected a blocking unknown mentioning "${expected}", got: ${JSON.stringify(blockingTopics)}`,
        );
      }
      if (item.expectedBlocking.length === 0) {
        assert.deepEqual(blockingTopics, []);
      }
    }
  });
}
