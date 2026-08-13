'use strict';

// Intent Runtime Bridge — built in Phase 11C, extended in Phase 11 (Runtime
// Routing) of the Juntia migration.
//
// Deterministic-first routing between the existing, unmodified Phase 04
// router (`classifyIntent()`) and an injected runtime adapter (Phase 11C's
// Claude CLI adapter, or any future swap-in satisfying the same
// `interpret(text) -> Promise<RuntimeResponse>` shape). Implements the
// architecture Phase 11B recommended: interpretation may be delegated,
// governance never is. Phase 11 extended the original single-condition
// (AMBIGUOUS-only) escalation with a second, evidenced condition closing
// the routing blind spot Phase 11C measured directly. Full rationale:
// phases/11c-runtime-provider-bridge.md (original bridge) and
// phases/11-runtime-routing.md (the escalation-condition fix).
//
// `lib/intent-router.js` is required, never modified — this module composes
// with it exactly the way Phases 05-07 already compose with their own
// upstream phases (destructure the real output shape directly, no adapter
// layer, no duplication of its rules).

const { classifyIntent, RISK } = require('./intent-router.js');
const { validateInterpretation } = require('./runtime/validator.js');
const { hasFalseConfidenceRisk } = require('./runtime/false-confidence-risk-signal.js');

function isLowOrNoneRisk(intent) {
  return RISK[intent] === 'none' || RISK[intent] === 'low';
}

// Governance decision for a validated runtime interpretation. NOT a call
// into lib/intent-router.js's own action policy (its buildResult()/
// buildAmbiguousResult() functions are private, unexported, and this phase
// does not modify Phase 04's file to export them) — a small, intentionally
// separate re-implementation, reusing only the exported RISK table. This is
// a real, found coupling point: Phase 04's governance policy is not
// currently factored for reuse outside classifyIntent() itself. Documented,
// not hidden — see phase doc's "Architectural test" section.
function actionFor(intent, confidence, hasUnknowns) {
  if (intent === 'AMBIGUOUS' || confidence === 'low') return 'ask';
  if (confidence === 'medium' && (hasUnknowns || !isLowOrNoneRisk(intent))) return 'confirm';
  return 'auto';
}

function safeFallback(reasonPrefix, detail) {
  return {
    intent: 'AMBIGUOUS',
    confidence: 'low',
    reason: `${reasonPrefix}: ${detail}. Falling back to AMBIGUOUS rather than guessing or trusting unverified output.`,
    action: 'ask',
    questions: ['No pude interpretar automáticamente esta petición — ¿puedes describirla de otra forma?'],
  };
}

// interpretIntent(text, { adapter, deterministicOnly, adapterOptions }) ->
// Promise<{ source, runtimeInvoked, escalationReason, result, validation, runtimeMeta }>
//
// Fallback condition — extended in Phase 11 (Runtime Routing) from 11C's
// original single-condition version. Escalates on EITHER of two
// independent, evidenced conditions, not a broadened single one:
//   1. `AMBIGUOUS` (11C's original condition — confidence is only ever
//      'low' when intent is 'AMBIGUOUS' in the real Phase 04 router, so
//      this remains the single check it always was);
//   2. `hasFalseConfidenceRisk()` (new — Phase 11's own real-corpus-
//      validated fix for the blind spot 11C measured directly: a
//      confidently-`auto` NEW_FEATURE/EVOLUTION/ARCHITECTURE result whose
//      text contains a negation/retraction marker). See
//      lib/runtime/false-confidence-risk-signal.js and
//      phases/11-runtime-routing.md for the full corpus validation (143
//      real historical items, 2 flagged, both are the known bugs, zero
//      false positives).
async function interpretIntent(text, { adapter, deterministicOnly = false, adapterOptions } = {}) {
  const deterministic = classifyIntent(text);
  const isAmbiguous = deterministic.intent === 'AMBIGUOUS';
  const isFalseConfidenceRisk = !isAmbiguous && hasFalseConfidenceRisk(text, deterministic);
  const shouldEscalate = isAmbiguous || isFalseConfidenceRisk;

  if (!shouldEscalate || deterministicOnly || !adapter) {
    return {
      source: 'deterministic',
      runtimeInvoked: false,
      escalationReason: null,
      result: deterministic,
      validation: null,
      runtimeMeta: null,
    };
  }

  const escalationReason = isAmbiguous ? 'ambiguous' : 'false_confidence_risk';

  const runtimeResponse = await adapter.interpret(text, adapterOptions);

  if (!runtimeResponse.ok) {
    return {
      source: 'runtime_failure_fallback',
      runtimeInvoked: true,
      escalationReason,
      result: safeFallback('Runtime failure', `${runtimeResponse.error} — ${runtimeResponse.message || 'no detail'}`),
      validation: null,
      runtimeMeta: { error: runtimeResponse.error, message: runtimeResponse.message, durationMs: runtimeResponse.durationMs },
    };
  }

  const validation = validateInterpretation(runtimeResponse.raw);

  if (!validation.valid) {
    return {
      source: 'validation_failure_fallback',
      runtimeInvoked: true,
      escalationReason,
      result: safeFallback('Runtime output failed validation', validation.errors.join('; ')),
      validation,
      runtimeMeta: { durationMs: runtimeResponse.durationMs, costUsd: runtimeResponse.costUsd },
    };
  }

  const { intent, confidence, interpretation, unknowns, evidence } = validation.result;
  const action = actionFor(intent, confidence, unknowns.length > 0);

  return {
    source: 'runtime',
    runtimeInvoked: true,
    escalationReason,
    result: {
      intent,
      confidence,
      interpretation,
      unknowns,
      evidence,
      alternateIntent: (deterministic.intent !== 'AMBIGUOUS' && deterministic.intent !== intent) ? deterministic.intent : null,
      action,
      questions: (action === 'ask' || action === 'confirm')
        ? [`Interpreto esto como ${intent} (${interpretation}). ¿Es correcto?`]
        : [],
    },
    validation,
    runtimeMeta: { durationMs: runtimeResponse.durationMs, costUsd: runtimeResponse.costUsd, usage: runtimeResponse.usage },
  };
}

module.exports = { interpretIntent, actionFor };
