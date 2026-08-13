'use strict';

// Phase 11 (Runtime Routing) — frozen recording of REAL Claude Code CLI
// invocations closing the loop on the routing blind spot Phase 11C
// measured: with the new false-confidence-risk-signal escalation condition
// wired in (lib/intent-runtime-bridge.js), both of Phase 08/09's known
// false-confidence bugs now reach the runtime and get a real, measured
// second opinion — captured here rather than asserted hypothetically.
//
// Captured 2026-08-13, same session/auth/model as
// test/fixtures/runtime-bridge-11c-results.js (claude-haiku-4-5-20251001,
// Claude Code CLI, existing OAuth session, no API key).

module.exports = {
  model: 'claude-haiku-4-5-20251001',
  capturedAt: '2026-08-13',

  cases: [
    {
      label: 'negation_false_confidence_bug (Phase 08)',
      text: 'No añadas nada, solo revisa el código.',
      deterministicOnly: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      escalationReason: 'false_confidence_risk',
      runtimeResult: {
        intent: 'VALIDATION',
        confidence: 'medium',
        action: 'confirm',
        interpretation: 'El usuario solicita una revisión del código sin realizar cambios ni adiciones.',
        alternateIntent: 'NEW_FEATURE',
        unknownsCount: 3,
      },
      runtimeMeta: { durationMs: 15594, costUsd: 0.007237 },
      totalMs: 15595,
      verdict: 'FIXED: the deterministic router\'s wrong, silently-auto NEW_FEATURE classification is superseded by a runtime result that (a) correctly identifies the actual intent as VALIDATION, (b) explicitly cites the deterministic router\'s original (wrong) guess as alternateIntent, and (c) sets action=confirm instead of auto — a human sees this before anything proceeds.',
    },
    {
      label: 'retraction_false_confidence_bug (Phase 09)',
      text: 'Antes queríamos multi-tenant, pero ya no lo necesitamos.',
      deterministicOnly: { intent: 'ARCHITECTURE', confidence: 'high', action: 'auto' },
      escalationReason: 'false_confidence_risk',
      runtimeResult: {
        intent: 'ARCHITECTURE',
        confidence: 'medium',
        action: 'confirm',
        interpretation: 'El usuario comunica que se está retractando de una decisión arquitectónica anterior: ya no necesitan un diseño multi-tenant para el sistema.',
        alternateIntent: null,
        unknownsCount: 2,
      },
      runtimeMeta: { durationMs: 25270, costUsd: 0.014584 },
      totalMs: 25271,
      verdict: 'FIXED: intent label unchanged (ARCHITECTURE), but the deterministic router\'s silent action=auto is superseded by action=confirm, and the interpretation explicitly names the retraction ("se está retractando") the deterministic router had no way to represent — a human sees this before anything proceeds, instead of the request silently being treated as an affirmative multi-tenant decision.',
    },
  ],

  summary: {
    bothCasesNowEscalate: true,
    bothCasesNowAskForConfirmationInsteadOfAuto: true,
    totalRealCostUsd: 0.007237 + 0.014584,
    note: 'Neither case is claimed "solved" in the sense of always producing the one objectively correct label — both are solved in the sense this migration has consistently used since Phase 04: no longer silently, confidently wrong. A human now sees the ambiguity before the system proceeds.',
  },
};
