'use strict';

// Project Interpretation Validator — Phase 12J of the Juntia migration.
//
// Treats the runtime's output as UNTRUSTED INPUT. Deliberately does NOT
// attempt to repair malformed output — invalid output fails closed.
//
// `FORBIDDEN_GOVERNANCE_KEYS`/`ALLOWED_CONFIDENCE` below were originally
// shared with the legacy `lib/runtime/validator.js` (this file's own
// original model, reusing its constants rather than redefining them) —
// that module was deleted in the Governance Level Dynamic and Legacy
// Cleanup phase (see phases/governance-level-dynamic-and-legacy-cleanup.md)
// since its only other consumer, `intent-runtime-bridge.js`, was legacy
// reasoning being retired too. This file is the sole real consumer of
// these two constants now, so they're inlined here directly rather than
// kept behind a shared module with one caller.
//
// Every `basedOn` entry must exactly match a real fact's identifier from
// the actual scan that produced the request — an interpretation citing a
// fact that was never in the input is exactly the "invented dependency/
// file" failure mode Phase 12J's brief named, and is rejected here, not
// passed through for a future layer to catch.

const { factKey } = require('../project-intelligence/facts-store.js');

const ALLOWED_CONFIDENCE = ['high', 'medium', 'low'];

// Fields the runtime must never set — these are governance decisions that
// belong to Juntia, never to the interpretation layer. Presence of any of
// these is treated as a validation failure, not silently stripped, so the
// failure is visible rather than quietly tolerated.
const FORBIDDEN_GOVERNANCE_KEYS = [
  'action', 'questions', 'authorization', 'workflow',
  'blocked', 'approved', 'autoApply', 'humanAction',
];

// Domain-specific additions to the shared governance list: a bare `fact`/
// `decision` key is this domain's own version of the same failure (Phase
// 12J brief's own invalid-output example: `{"fact": "..."}` with no
// evidence). `confirmed` matches docs/CONTEXT_SYNTHESIS.md's own prior
// description of what this validator must reject.
const FORBIDDEN_INTERPRETATION_KEYS = [
  ...FORBIDDEN_GOVERNANCE_KEYS, 'fact', 'facts', 'decision', 'decisions', 'confirmed',
];

function validateProjectInterpretation(raw, knownFacts) {
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

  for (const key of FORBIDDEN_INTERPRETATION_KEYS) {
    if (key in parsed) errors.push(`output contains a field it must never set: "${key}"`);
  }

  if (typeof parsed.interpretation !== 'string' || parsed.interpretation.trim() === '') {
    errors.push('interpretation must be a non-empty string');
  }

  if (typeof parsed.confidence !== 'string' || !ALLOWED_CONFIDENCE.includes(parsed.confidence)) {
    errors.push(`confidence must be one of ${ALLOWED_CONFIDENCE.join('/')}; got ${JSON.stringify(parsed.confidence)}`);
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

  if (!Array.isArray(parsed.basedOn) || parsed.basedOn.some((b) => typeof b !== 'string')) {
    errors.push('basedOn must be an array of strings');
  } else if (parsed.basedOn.length === 0) {
    errors.push('basedOn must cite at least one real fact — an interpretation grounded in nothing is not allowed');
  } else {
    const knownKeys = new Set((knownFacts || []).map(factKey));
    const invented = parsed.basedOn.filter((b) => !knownKeys.has(b));
    if (invented.length > 0) {
      errors.push(`basedOn cites fact identifier(s) not present in the real scan: ${invented.map((i) => JSON.stringify(i)).join(', ')}`);
    }
  }

  return { valid: errors.length === 0, result: errors.length === 0 ? parsed : null, errors };
}

module.exports = {
  validateProjectInterpretation,
  FORBIDDEN_INTERPRETATION_KEYS,
};
