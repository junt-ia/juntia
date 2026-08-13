'use strict';

// Phase 11 (Runtime Routing) — tests for lib/runtime/false-confidence-risk-
// signal.js, the routing blind spot fix. Includes a real, unmodified full-
// corpus regression walk across every dataset fixture in this migration
// (143 unique texts as of this phase) — not a hand-picked sample — matching
// the design-validation this module was actually built against (see
// phases/11-runtime-routing.md).

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyIntent } = require('../lib/intent-router.js');
const { hasFalseConfidenceRisk } = require('../lib/runtime/false-confidence-risk-signal.js');

const CORPUS_FILES = [
  '../test/fixtures/intent-dataset.js',
  '../test/fixtures/product-reasoning-dataset.js',
  '../test/fixtures/architecture-reasoning-dataset.js',
  '../test/fixtures/engineering-reasoning-dataset.js',
  '../test/fixtures/semantic-layer-baseline-dataset.js',
  '../test/fixtures/semantic-strategy-eval-dataset.js',
  '../test/fixtures/local-model-11a-results.js',
];

function collectTexts(mod, acc) {
  if (Array.isArray(mod)) { for (const x of mod) collectTexts(x, acc); return; }
  if (mod && typeof mod === 'object') {
    if (typeof mod.text === 'string') acc.push(mod.text);
    else for (const v of Object.values(mod)) collectTexts(v, acc);
  }
}

function fullCorpus() {
  const acc = [];
  for (const f of CORPUS_FILES) collectTexts(require(f), acc);
  return [...new Set(acc)];
}

test('full-corpus regression: across every unique text in every dataset fixture in this migration, exactly 2 are flagged, and both are the known false-confidence bugs', () => {
  const corpus = fullCorpus();
  assert.ok(corpus.length >= 100, 'sanity check: the corpus should be substantial, not a hand-picked handful');
  const flagged = corpus.filter((text) => hasFalseConfidenceRisk(text, classifyIntent(text)));
  assert.deepEqual(flagged.sort(), [
    'Antes queríamos multi-tenant, pero ya no lo necesitamos.',
    'No añadas nada, solo revisa el código.',
  ].sort());
});

test('does not flag any real BUG example containing "no" — the exclusion this module exists to get right', () => {
  const bugExamplesWithNegation = [
    'Los clientes VIP no reciben el descuento.',
    'Los emails de confirmación no se están enviando desde ayer.',
    'Corrígelo, no está funcionando bien.',
    '¿Podrías revisar por qué los clientes VIP no reciben su descuento?',
    'El sistema de notificaciones falla cuando el usuario no tiene email.',
  ];
  for (const text of bugExamplesWithNegation) {
    const det = classifyIntent(text);
    assert.equal(det.intent, 'BUG', `expected "${text}" to classify as BUG (sanity check on the fixture itself)`);
    assert.equal(hasFalseConfidenceRisk(text, det), false, `must not flag a correct BUG classification: "${text}"`);
  }
});

test('does not flag an UNDERSTAND result containing "no"', () => {
  const det = classifyIntent('No entiendo cómo funciona el sistema de reservas.');
  assert.equal(det.intent, 'UNDERSTAND');
  assert.equal(hasFalseConfidenceRisk('No entiendo cómo funciona el sistema de reservas.', det), false);
});

test('does not flag results that are already AMBIGUOUS (the original 11C condition already covers these)', () => {
  for (const text of ['No corrijas nada, ya lo revisamos ayer y está bien.', 'No implementes esto todavía, solo es una idea.', 'No mejores el checkout, enfócate en otra cosa.']) {
    const det = classifyIntent(text);
    assert.equal(det.intent, 'AMBIGUOUS');
    assert.equal(hasFalseConfidenceRisk(text, det), false);
  }
});

test('does not flag a confident, clean NEW_FEATURE/EVOLUTION/ARCHITECTURE result with no negation marker', () => {
  const cases = [
    'Quiero implementar notificaciones por email cuando se confirma una reserva.',
    'Quiero ampliar el sistema de descuentos para incluir cupones combinables.',
    'Necesitamos decidir la arquitectura para soportar múltiples inquilinos (multi-tenant).',
  ];
  for (const text of cases) {
    const det = classifyIntent(text);
    assert.equal(hasFalseConfidenceRisk(text, det), false, `must not flag a clean case: "${text}"`);
  }
});

test('flags the two known false-confidence bugs explicitly, with the exact expected reasoning', () => {
  const negation = classifyIntent('No añadas nada, solo revisa el código.');
  assert.equal(negation.intent, 'NEW_FEATURE');
  assert.equal(negation.action, 'auto');
  assert.equal(hasFalseConfidenceRisk('No añadas nada, solo revisa el código.', negation), true);

  const retraction = classifyIntent('Antes queríamos multi-tenant, pero ya no lo necesitamos.');
  assert.equal(retraction.intent, 'ARCHITECTURE');
  assert.equal(retraction.action, 'auto');
  assert.equal(hasFalseConfidenceRisk('Antes queríamos multi-tenant, pero ya no lo necesitamos.', retraction), true);
});

test('returns false for a null/undefined deterministic result rather than throwing', () => {
  assert.equal(hasFalseConfidenceRisk('cualquier texto', null), false);
  assert.equal(hasFalseConfidenceRisk('cualquier texto', undefined), false);
});
