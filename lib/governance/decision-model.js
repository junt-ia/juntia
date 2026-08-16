'use strict';

// Decision Model — Phase 15F of the Juntia migration.
//
// Real, triggering evidence: a live dogfooding session in `restaurant-game`
// against the published `@juntia/juntia@0.8.0` (Phase 16 beta) needed two
// real product decisions during M04 work — a wait-timeout duration
// (`TABLE_WAIT_PATIENCE_MS`) and a reputation-penalty magnitude. Neither
// could go through `juntia confirm`: `.juntia/pending.json` never existed
// (never written to), and `.juntia/DECISIONS.md` was hand-edited directly —
// an agent bypassing Juntia's own structured decision mechanism entirely,
// because that mechanism structurally cannot represent the question "what
// value should this be," only "what does this project's evidence suggest is
// true." See phases/15f-decision-model.md §2 for the full, real diff.
//
// "No todo lo que un agente no sabe es una interpretación pendiente. Algunas
// cosas son decisiones que el equipo debe tomar." This module defines the
// three kinds of decision `.juntia/decisions.json` can now hold, and
// validates the one new untrusted-input surface this phase adds: a
// product/architecture DECISION REQUEST an agent may propose. The same
// governing rule as every other untrusted-input validator in this codebase:
// an agent may propose a QUESTION, never an ANSWER — only a human, at
// `juntia confirm` time, supplies the actual decision. An agent must never
// be able to auto-approve its own decision, and this is enforced here as a
// structural, testable property (a forbidden-key check), not a convention.

const DECISION_TYPES = ['interpretation', 'product', 'architecture'];

function isValidDecisionType(type) {
  return DECISION_TYPES.includes(type);
}

// Fields only a human may ever set on a decision — proposing any of these on
// a pending decision REQUEST would let an agent pre-fill (and effectively
// self-confirm) its own answer. Mirrors `project-interpretation-
// validator.js`'s own `FORBIDDEN_INTERPRETATION_KEYS` precedent, applied to
// a structurally different domain. Deliberately does NOT include `status`:
// every pending item legitimately carries `status: "pending"`, set by
// Juntia's own `normalizePendingItems`/`upsertDecisionRequest` before this
// validator ever runs (the same reason `FORBIDDEN_INTERPRETATION_KEYS`
// doesn't forbid it either) — the real trust boundary is the *outcome*
// fields below, not the fact that a pending item has a status at all.
const FORBIDDEN_DECISION_REQUEST_KEYS = [
  'text', 'decision', 'confirmedAt', 'source', 'confidence', 'basedOn',
];

// validateDecisionRequest(raw) -> { valid, result, errors }
//
// Validates an agent-authored pending item of type "product"/"architecture"
// — the proposal that a real decision is needed, never the decision itself.
// Deliberately does NOT check `evidence` against real fact identifiers the
// way `validateProjectInterpretation` checks `basedOn`: a product/
// architecture decision is not grounded in project facts at all (that's the
// whole point of this phase), so `evidence` — when present — is free-text
// context (a milestone doc reference, a prior conversation), not a fact
// citation, and is never fact-validated.
function validateDecisionRequest(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { valid: false, result: null, errors: [`malformed JSON: ${e.message}`] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, result: null, errors: ['output is not an object'] };
  }

  const errors = [];

  if (parsed.type !== 'product' && parsed.type !== 'architecture') {
    errors.push(`type must be "product" or "architecture" for a decision request; got ${JSON.stringify(parsed.type)}`);
  }

  for (const key of FORBIDDEN_DECISION_REQUEST_KEYS) {
    if (key in parsed) errors.push(`a decision request must never set "${key}" — only a human, at confirm time, decides the answer`);
  }

  if (typeof parsed.question !== 'string' || parsed.question.trim() === '') {
    errors.push('question must be a non-empty string');
  }

  if (parsed.context !== undefined && typeof parsed.context !== 'string') {
    errors.push('context, if present, must be a string');
  }

  if (parsed.options !== undefined && (!Array.isArray(parsed.options) || parsed.options.some((o) => typeof o !== 'string'))) {
    errors.push('options, if present, must be an array of strings');
  }

  if (parsed.evidence !== undefined && (!Array.isArray(parsed.evidence) || parsed.evidence.some((e) => typeof e !== 'string'))) {
    errors.push('evidence, if present, must be an array of strings');
  }

  return { valid: errors.length === 0, result: errors.length === 0 ? parsed : null, errors };
}

module.exports = {
  DECISION_TYPES,
  isValidDecisionType,
  FORBIDDEN_DECISION_REQUEST_KEYS,
  validateDecisionRequest,
};
