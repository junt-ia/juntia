'use strict';

// Phase 15F — tests for `lib/governance/decision-model.js`: the type
// registry and the one new untrusted-input validator this phase adds,
// `validateDecisionRequest`. Central property under test throughout: an
// agent may propose a QUESTION, never an ANSWER — it must never be able to
// pre-fill (and effectively self-confirm) its own decision.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DECISION_TYPES, isValidDecisionType, FORBIDDEN_DECISION_REQUEST_KEYS, validateDecisionRequest,
} = require('../lib/governance/decision-model.js');

test('DECISION_TYPES names exactly the three real decision types', () => {
  assert.deepEqual([...DECISION_TYPES].sort(), ['architecture', 'interpretation', 'product']);
});

test('isValidDecisionType accepts the three real types, rejects anything else', () => {
  assert.equal(isValidDecisionType('product'), true);
  assert.equal(isValidDecisionType('architecture'), true);
  assert.equal(isValidDecisionType('interpretation'), true);
  assert.equal(isValidDecisionType('gameplay'), false);
  assert.equal(isValidDecisionType(''), false);
  assert.equal(isValidDecisionType(undefined), false);
});

const VALID_REQUEST = {
  type: 'product',
  question: '¿Cuánto tiempo espera un cliente antes de abandonar?',
  context: 'NPC waiting system',
  options: ['10000ms', '15000ms', '20000ms'],
};

test('a well-formed product decision request is valid', () => {
  const result = validateDecisionRequest(VALID_REQUEST);
  assert.equal(result.valid, true);
  assert.deepEqual(result.result, VALID_REQUEST);
});

test('a well-formed architecture decision request is valid', () => {
  const result = validateDecisionRequest({ ...VALID_REQUEST, type: 'architecture', question: 'Where should reservation state live?' });
  assert.equal(result.valid, true);
});

test('context, options, and evidence are all optional — a minimal request with just type+question is valid', () => {
  const result = validateDecisionRequest({ type: 'product', question: 'What should the default page size be?' });
  assert.equal(result.valid, true);
});

test('type must be "product" or "architecture" — "interpretation" (or anything else) is rejected here, since that\'s a different domain entirely', () => {
  const result = validateDecisionRequest({ ...VALID_REQUEST, type: 'interpretation' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /type must be "product" or "architecture"/);
});

test('question must be a non-empty string', () => {
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, question: '' }).valid, false);
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, question: 123 }).valid, false);
  const { question, ...withoutQuestion } = VALID_REQUEST;
  assert.equal(validateDecisionRequest(withoutQuestion).valid, false);
});

test('context, if present, must be a string', () => {
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, context: 42 }).valid, false);
});

test('options, if present, must be an array of strings', () => {
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, options: 'not an array' }).valid, false);
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, options: [1, 2, 3] }).valid, false);
});

test('evidence, if present, must be an array of strings', () => {
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, evidence: 'docs/MILESTONES.md M04' }).valid, false);
  assert.equal(validateDecisionRequest({ ...VALID_REQUEST, evidence: ['docs/MILESTONES.md M04'] }).valid, true);
});

test('malformed JSON string input fails closed with a real error, never crashes', () => {
  const result = validateDecisionRequest('{ not json');
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /malformed JSON/);
});

test('non-object input (an array, a bare string) is rejected', () => {
  assert.equal(validateDecisionRequest(['not', 'an', 'object']).valid, false);
  assert.equal(validateDecisionRequest(null).valid, false);
});

// --- The central guarantee: an agent can never self-approve its own decision ---

for (const forbiddenKey of FORBIDDEN_DECISION_REQUEST_KEYS) {
  test(`a decision request setting "${forbiddenKey}" is rejected — only a human may set it, at confirm time`, () => {
    const result = validateDecisionRequest({ ...VALID_REQUEST, [forbiddenKey]: 'anything' });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), new RegExp(`must never set "${forbiddenKey}"`));
  });
}

test('FORBIDDEN_DECISION_REQUEST_KEYS covers every field that represents the actual outcome of a decision', () => {
  for (const key of ['text', 'decision', 'confirmedAt', 'source', 'confidence', 'basedOn']) {
    assert.ok(FORBIDDEN_DECISION_REQUEST_KEYS.includes(key), `${key} must be forbidden — it represents an outcome, not a question`);
  }
});

test('"status" is deliberately NOT forbidden — Juntia\'s own normalizePendingItems legitimately sets status: "pending" before this validator ever runs', () => {
  assert.equal(FORBIDDEN_DECISION_REQUEST_KEYS.includes('status'), false);
  const result = validateDecisionRequest({ ...VALID_REQUEST, status: 'pending' });
  assert.equal(result.valid, true);
});

test('accepts an already-parsed object, not only a JSON string', () => {
  const result = validateDecisionRequest(VALID_REQUEST);
  assert.equal(result.valid, true);
});
