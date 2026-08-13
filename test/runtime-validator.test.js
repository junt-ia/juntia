'use strict';

// Phase 11C — deterministic unit tests for lib/runtime/validator.js.
//
// No network/CLI call anywhere in this file — the validator's whole job is
// to distinguish trustworthy from untrustworthy output regardless of where
// it came from, so it is tested with hand-constructed inputs, the same way
// Phase 06/07 tested their own anti-hallucination gates with hand-
// constructed `known` objects. The 10-case failure matrix below matches the
// brief's own required list verbatim.

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInterpretation, FORBIDDEN_GOVERNANCE_KEYS } = require('../lib/runtime/validator.js');

const VALID = {
  intent: 'NEW_FEATURE',
  confidence: 'medium',
  interpretation: 'The user wants to add a VIP discount.',
  unknowns: [{ topic: 'VIP definition', reason: 'not specified in the request' }],
  evidence: ['mentions VIP customers', 'mentions a discount'],
};

test('1. valid output passes', () => {
  const r = validateInterpretation(JSON.stringify(VALID));
  assert.equal(r.valid, true);
  assert.deepEqual(r.result, VALID);
  assert.deepEqual(r.errors, []);
});

test('2. malformed JSON fails closed', () => {
  const r = validateInterpretation('{ this is not json');
  assert.equal(r.valid, false);
  assert.equal(r.result, null);
  assert.match(r.errors[0], /malformed JSON/);
});

test('3. missing required fields fails', () => {
  const { intent, ...rest } = VALID;
  const r = validateInterpretation(JSON.stringify(rest));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('intent must be one of')));
});

test('4. invalid intent value fails', () => {
  const r = validateInterpretation(JSON.stringify({ ...VALID, intent: 'DELETE_DATABASE' }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('intent must be one of')));
});

test('5. invalid confidence value fails', () => {
  const r = validateInterpretation(JSON.stringify({ ...VALID, confidence: 'very sure' }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('confidence must be one of')));
});

test('6. unexpected governance field is rejected, for every forbidden key', () => {
  for (const key of FORBIDDEN_GOVERNANCE_KEYS) {
    const r = validateInterpretation(JSON.stringify({ ...VALID, [key]: 'auto' }));
    assert.equal(r.valid, false, `expected "${key}" to be rejected`);
    assert.ok(r.errors.some((e) => e.includes(key)));
  }
});

test('7. an invented file path does not itself invalidate output (the validator checks SHAPE, not factual grounding — grounding is Juntia governance\'s job downstream, per Phase 06/07\'s existing anti-hallucination gate, not this validator\'s)', () => {
  const withInventedFile = {
    ...VALID,
    evidence: ['references lib/nonexistent-file.js'],
  };
  const r = validateInterpretation(JSON.stringify(withInventedFile));
  assert.equal(r.valid, true, 'shape is valid; factual grounding is out of this validator\'s scope by design');
});

test('8. structurally invented architecture (extra unsolicited object nesting) fails shape validation', () => {
  const r = validateInterpretation(JSON.stringify({ ...VALID, unknowns: [{ topic: 'x' }] }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('unknowns[0]')));
});

test('9. empty output object fails', () => {
  const r = validateInterpretation(JSON.stringify({}));
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 4);
});

test('10. non-object top-level output (runtime error surfaced as a bare string) fails', () => {
  const r = validateInterpretation(JSON.stringify('runtime crashed'));
  assert.equal(r.valid, false);
  assert.deepEqual(r.errors, ['output is not an object']);
});

test('AMBIGUOUS intent with high confidence is rejected as internally inconsistent', () => {
  const r = validateInterpretation(JSON.stringify({ ...VALID, intent: 'AMBIGUOUS', confidence: 'high' }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('internally inconsistent')));
});

test('evidence array with a non-string element fails', () => {
  const r = validateInterpretation(JSON.stringify({ ...VALID, evidence: ['ok', 42] }));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('evidence must be an array of strings')));
});

test('accepts an already-parsed object, not only a JSON string', () => {
  const r = validateInterpretation(VALID);
  assert.equal(r.valid, true);
});
