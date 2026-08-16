'use strict';

// Phase 15C — tests for the Intent Model (`lib/governance/intent-model.js`):
// the four-workflow-shaped classifier (feature/bug/investigation/refactor,
// or unknown) that replaces free-text guesswork with an explicit,
// explainable, numeric-confidence classification. Per this phase's own
// explicit requirement, the central property under test throughout is: an
// ambiguous or unrecognized request must never produce a false, guessed
// intent — it must come back `unknown` with `needsClarification: true`.

const test = require('node:test');
const assert = require('node:assert/strict');

const { INTENTS, CONFIDENCE_THRESHOLD, classifyTaskIntent } = require('../lib/governance/intent-model.js');

test('INTENTS names exactly the four work-shaped intents this phase defines', () => {
  assert.deepEqual([...INTENTS].sort(), ['bug', 'feature', 'investigation', 'refactor']);
});

// --- Correct classification per intent ---

const FEATURE_REQUESTS = [
  'Implementa clientes VIP en el restaurante.',
  'Añade un sistema de reservas online.',
  'Crea una nueva pantalla de estadísticas.',
  'Incorpora una mecánica de propinas para los camareros.',
];

for (const text of FEATURE_REQUESTS) {
  test(`classifies as feature: "${text}"`, () => {
    const result = classifyTaskIntent(text);
    assert.equal(result.intent, 'feature');
    assert.equal(result.needsClarification, false);
  });
}

const BUG_REQUESTS = [
  'El botón de pago no funciona.',
  'Hay un error al guardar el pedido.',
  'Los clientes VIP no reciben el descuento que deberían.',
  'La app crashea al abrir el menú.',
];

for (const text of BUG_REQUESTS) {
  test(`classifies as bug: "${text}"`, () => {
    const result = classifyTaskIntent(text);
    assert.equal(result.intent, 'bug');
    assert.equal(result.needsClarification, false);
  });
}

const INVESTIGATION_REQUESTS = [
  'Analiza cómo funciona el sistema de reservas.',
  'Investiga por qué ha bajado el rendimiento.',
  'Evalúa qué alternativas tenemos para la base de datos.',
];

for (const text of INVESTIGATION_REQUESTS) {
  test(`classifies as investigation: "${text}"`, () => {
    const result = classifyTaskIntent(text);
    assert.equal(result.intent, 'investigation');
    assert.equal(result.needsClarification, false);
  });
}

const REFACTOR_REQUESTS = [
  'Refactoriza el módulo de pagos sin cambiar el comportamiento.',
  'Reorganiza los archivos del proyecto en módulos.',
  'Extrae esta lógica a un módulo separado.',
];

for (const text of REFACTOR_REQUESTS) {
  test(`classifies as refactor: "${text}"`, () => {
    const result = classifyTaskIntent(text);
    assert.equal(result.intent, 'refactor');
    assert.equal(result.needsClarification, false);
  });
}

// --- Confidence handling ---

test('confidence is always a number in [0, 1], never a string label', () => {
  for (const text of [...FEATURE_REQUESTS, ...BUG_REQUESTS, 'algo muy vago', '']) {
    const result = classifyTaskIntent(text);
    assert.equal(typeof result.confidence, 'number');
    assert.ok(result.confidence >= 0 && result.confidence <= 1, `confidence out of range for "${text}": ${result.confidence}`);
  }
});

test('a clean, single-cue match produces high confidence (matches the brief\'s own worked example)', () => {
  const result = classifyTaskIntent('Implementa clientes VIP en el restaurante.');
  assert.equal(result.intent, 'feature');
  assert.ok(result.confidence >= 0.85, `expected high confidence, got ${result.confidence}`);
});

test('BUG deviation language is a dominant signal even when a competing cue also fires', () => {
  const result = classifyTaskIntent('Los clientes VIP no reciben el descuento que deberíamos añadir.');
  assert.equal(result.intent, 'bug');
});

// --- Unknown intent: never a false workflow ---

test('empty text -> unknown, needsClarification true', () => {
  const result = classifyTaskIntent('');
  assert.equal(result.intent, 'unknown');
  assert.equal(result.needsClarification, true);
});

test('no recognizable signal -> unknown, needsClarification true', () => {
  const result = classifyTaskIntent('Hola, buenos días.');
  assert.equal(result.intent, 'unknown');
  assert.equal(result.needsClarification, true);
});

test('a genuine tie between two equally-strong candidates -> unknown, never a coin-flip guess', () => {
  // "refactoriza" (refactor cue) + "implementa" (feature cue), same weight, no other cue.
  const result = classifyTaskIntent('Refactoriza e implementa esto.');
  assert.equal(result.intent, 'unknown');
  assert.equal(result.needsClarification, true);
});

test('every unknown result is below CONFIDENCE_THRESHOLD or explicitly a tie — never a low-confidence guess dressed up as a real intent', () => {
  for (const text of ['', 'Hola', 'Refactoriza e implementa esto.']) {
    const result = classifyTaskIntent(text);
    assert.equal(result.intent, 'unknown');
    assert.ok(result.confidence < CONFIDENCE_THRESHOLD || result.confidence === 0.5);
  }
});

test('every result — known or unknown — carries a reason explaining the classification', () => {
  for (const text of ['Implementa algo.', 'Hola', '']) {
    const result = classifyTaskIntent(text);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0);
  }
});
