'use strict';

// Phase 12J — deterministic unit tests for
// lib/runtime/project-interpretation-validator.js. Hand-constructed inputs
// only, same discipline as test/runtime-validator.test.js (the intent-
// domain validator this one is modeled on). The brief's own valid/invalid
// examples are reproduced verbatim as two of the cases below.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateProjectInterpretation, FORBIDDEN_INTERPRETATION_KEYS,
} = require('../lib/runtime/project-interpretation-validator.js');

const FACTS = [
  { category: 'dependency', name: 'phaser', value: '^3.60.0' },
  { category: 'structure.directory', name: 'src/entities' },
  { category: 'structure.directory', name: 'src/components' },
];

const VALID = {
  interpretation: 'The structure may be compatible with an entity-component pattern.',
  confidence: 'low',
  basedOn: ['structure.directory:src/entities', 'structure.directory:src/components'],
  unknowns: [{ topic: 'game loop', reason: 'no scene/loop file was scanned' }],
};

test('1. valid output, grounded in real facts, passes', () => {
  const r = validateProjectInterpretation(JSON.stringify(VALID), FACTS);
  assert.equal(r.valid, true);
  assert.deepEqual(r.result, VALID);
});

test('2. malformed JSON fails closed', () => {
  const r = validateProjectInterpretation('{ not json', FACTS);
  assert.equal(r.valid, false);
  assert.equal(r.result, null);
  assert.match(r.errors[0], /malformed JSON/);
});

test('3. non-object top-level output fails', () => {
  const r = validateProjectInterpretation(JSON.stringify('crashed'), FACTS);
  assert.equal(r.valid, false);
  assert.deepEqual(r.errors, ['output is not an object']);
});

test('4. missing required fields fails', () => {
  const r = validateProjectInterpretation(JSON.stringify({}), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 3);
});

test('5. invalid confidence value fails', () => {
  const r = validateProjectInterpretation(JSON.stringify({ ...VALID, confidence: 'certain' }), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('confidence must be one of')));
});

test('6. brief\'s own invalid example: a bare "fact" key with no evidence is rejected', () => {
  const r = validateProjectInterpretation(JSON.stringify({ fact: 'El proyecto usa arquitectura ECS' }), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('"fact"')));
});

test('7. brief\'s own valid example (interpretation/confidence/basedOn, no evidence-of-nothing) passes once basedOn cites a real fact', () => {
  const example = {
    interpretation: 'La estructura podría ser compatible con ECS',
    confidence: 'low',
    basedOn: ['structure.directory:src/entities'],
    unknowns: [],
  };
  const r = validateProjectInterpretation(JSON.stringify(example), FACTS);
  assert.equal(r.valid, true);
});

test('8. every forbidden key is rejected, including the domain-specific additions (fact/decision/confirmed)', () => {
  for (const key of FORBIDDEN_INTERPRETATION_KEYS) {
    const r = validateProjectInterpretation(JSON.stringify({ ...VALID, [key]: true }), FACTS);
    assert.equal(r.valid, false, `expected "${key}" to be rejected`);
    assert.ok(r.errors.some((e) => e.includes(key)));
  }
});

test('9. a hallucinated basedOn citation — a fact identifier that does not exist in the real scan — is rejected, not silently trusted', () => {
  const withInventedFact = {
    ...VALID,
    basedOn: ['dependency:react-three-fiber'],
  };
  const r = validateProjectInterpretation(JSON.stringify(withInventedFact), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('not present in the real scan')));
  assert.ok(r.errors.some((e) => e.includes('react-three-fiber')));
});

test('10. a mix of one real and one invented citation is still rejected outright (partial grounding is not enough)', () => {
  const mixed = { ...VALID, basedOn: ['structure.directory:src/entities', 'dependency:nonexistent-lib'] };
  const r = validateProjectInterpretation(JSON.stringify(mixed), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('nonexistent-lib')));
});

test('11. empty basedOn (interpretation grounded in nothing) is rejected', () => {
  const r = validateProjectInterpretation(JSON.stringify({ ...VALID, basedOn: [] }), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('at least one real fact')));
});

test('12. an empty interpretation string fails', () => {
  const r = validateProjectInterpretation(JSON.stringify({ ...VALID, interpretation: '   ' }), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('interpretation must be a non-empty string')));
});

test('13. malformed unknowns entries fail shape validation', () => {
  const r = validateProjectInterpretation(JSON.stringify({ ...VALID, unknowns: [{ topic: 'x' }] }), FACTS);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('unknowns[0]')));
});

test('14. accepts an already-parsed object, not only a JSON string', () => {
  const r = validateProjectInterpretation(VALID, FACTS);
  assert.equal(r.valid, true);
});

test('15. no facts were ever given (empty project) -> any basedOn citation is necessarily rejected, never rubber-stamped', () => {
  const r = validateProjectInterpretation(JSON.stringify(VALID), []);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('not present in the real scan')));
});
