'use strict';

// Project Interpretation Validator — Phase 12J of the Juntia migration.
//
// Treats the runtime's output as UNTRUSTED INPUT, same discipline as
// `lib/runtime/validator.js` (the intent-domain validator this file is
// deliberately modeled on, reusing its ALLOWED_CONFIDENCE and
// FORBIDDEN_GOVERNANCE_KEYS rather than redefining them). Deliberately does
// NOT attempt to repair malformed output — invalid output fails closed.
//
// One real difference from `validator.js`, made on purpose and documented
// here rather than silently: that validator's own test suite (case 7)
// explicitly leaves factual grounding out of scope, deferring it to
// "Juntia governance downstream" (Phases 05-07's existing anti-
// hallucination gate, which the intent domain already had before Phase 11C
// existed). The project-interpretation domain has no such downstream gate
// yet — Phase 12J IS the first layer capable of catching a fabricated
// `basedOn` citation. So this validator adds a check `validator.js` does
// not have: every `basedOn` entry must exactly match a real fact's
// identifier from the actual scan that produced the request. An
// interpretation citing a fact that was never in the input is exactly the
// "invented dependency/file" failure mode Phase 12J's brief named, and is
// rejected here, not passed through for a future layer to catch.

const { FORBIDDEN_GOVERNANCE_KEYS, ALLOWED_CONFIDENCE } = require('./validator.js');
const { factKey } = require('../project-intelligence/facts-store.js');

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
