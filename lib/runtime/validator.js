'use strict';

// Runtime output validator — Phase 11C of the Juntia migration.
//
// Treats runtime/AI output as UNTRUSTED INPUT, independent of whatever
// structured-output mechanism the adapter itself requested (a schema
// requested of a model is a request, not a guarantee). This is the second,
// Juntia-controlled line of defense, and the only one that decides whether
// output is allowed to reach governance at all — see phases/11c-runtime-
// provider-bridge.md's Validator section for the full rationale and the
// 10-case test matrix this module is checked against.
//
// Deliberately does NOT attempt to repair malformed output (no coercion, no
// "best guess" recovery) — invalid output fails closed, per this phase's
// explicit "invalid AI output -> never enter the governance layer" rule.

const { INTENTS } = require('../intent-router.js');

const ALLOWED_INTENTS = new Set([...INTENTS, 'AMBIGUOUS']);
const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low']);

// Fields the runtime must never set — these are governance decisions
// (Phase 11B's own explicit conclusion: action/questions/authorization
// belong to Juntia, never to the interpretation layer). Presence of any of
// these is treated as a validation failure, not silently stripped, so the
// failure is visible rather than quietly tolerated.
const FORBIDDEN_GOVERNANCE_KEYS = [
  'action', 'questions', 'authorization', 'workflow',
  'blocked', 'approved', 'autoApply', 'humanAction',
];

function validateInterpretation(raw) {
  const errors = [];
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { valid: false, result: null, errors: [`malformed JSON: ${e.message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, result: null, errors: ['output is not an object'] };
  }

  for (const key of FORBIDDEN_GOVERNANCE_KEYS) {
    if (key in parsed) errors.push(`output contains a governance field it must never set: "${key}"`);
  }

  if (typeof parsed.intent !== 'string' || !ALLOWED_INTENTS.has(parsed.intent)) {
    errors.push(`intent must be one of ${[...ALLOWED_INTENTS].join(', ')}; got ${JSON.stringify(parsed.intent)}`);
  }

  if (typeof parsed.confidence !== 'string' || !ALLOWED_CONFIDENCE.has(parsed.confidence)) {
    errors.push(`confidence must be one of high/medium/low; got ${JSON.stringify(parsed.confidence)}`);
  }

  if (typeof parsed.interpretation !== 'string' || parsed.interpretation.trim() === '') {
    errors.push('interpretation must be a non-empty string');
  }

  if (!Array.isArray(parsed.unknowns)) {
    errors.push('unknowns must be an array');
  } else {
    parsed.unknowns.forEach((u, i) => {
      if (!u || typeof u !== 'object' || typeof u.topic !== 'string' || typeof u.reason !== 'string') {
        errors.push(`unknowns[${i}] must be an object shaped {topic: string, reason: string}`);
      }
    });
  }

  if (!Array.isArray(parsed.evidence) || parsed.evidence.some((e) => typeof e !== 'string')) {
    errors.push('evidence must be an array of strings');
  }

  // Internal-consistency check — not required by the schema, but a real
  // safety net: a model reporting AMBIGUOUS while claiming high confidence
  // in that same judgment is self-contradictory in a way that matters
  // downstream (Juntia's governance step trusts `confidence` as a signal).
  if (parsed.intent === 'AMBIGUOUS' && parsed.confidence === 'high') {
    errors.push('internally inconsistent: intent AMBIGUOUS with confidence high');
  }

  return { valid: errors.length === 0, result: errors.length === 0 ? parsed : null, errors };
}

module.exports = {
  validateInterpretation,
  ALLOWED_INTENTS: [...ALLOWED_INTENTS],
  ALLOWED_CONFIDENCE: [...ALLOWED_CONFIDENCE],
  FORBIDDEN_GOVERNANCE_KEYS,
};
