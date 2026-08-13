'use strict';

// Evaluation dataset for Phase 09 (Semantic Strategy Evaluation). Builds on
// Phase 08's 35-item baseline + 1 false-confidence item WITHOUT replacing or
// tuning them (imported directly, not copied) — per this phase's explicit
// "do not tune the evaluation system until the dataset passes an explicit
// integrity review" and "preserve known misses" instructions.
//
// New items added this phase are clearly separated into their own arrays
// (never merged silently into Phase 08's own dataset) and cover: more
// adversarial/contradictory wording, positive/clear control examples, and a
// paraphrase set specifically for the semantic-similarity experiment (§C),
// split into a TRAIN set (canonical exemplars, drawn from already-known-
// working Phase 04-08 dataset items, never from newly-written text) and a
// TEST set (paraphrase items + negative controls, never used to build the
// exemplars) — the train/test separation the brief requires for any
// evaluated "learned" (nearest-neighbor) approach.

const phase08 = require('./semantic-layer-baseline-dataset.js');

module.exports = {
  // Re-exported, unmodified — the origin of every Model A/B measurement's
  // "baseline" numbers in phases/09-evaluation.md.
  phase08Baseline: phase08.baseline,
  phase08FalseConfidence: phase08.falseConfidence,

  // --- New adversarial / contradictory cases (Phase 09) ---
  // Per the brief's explicit instruction to include more cases like
  // "No añadas nada, solo revisa el código." — testing whether the SAME
  // false-confidence failure mode generalizes across other creation verbs,
  // or is specific to the one Phase 04 rule that uses a stem pattern
  // (`\banad\w*\b`) instead of an exact-word match.
  adversarial: [
    { text: 'No añadas nada, solo revisa el código.', origin: 'phase08', expectedIntent: 'NEW_FEATURE', expectedConfidence: 'medium', expectedAction: 'auto', note: 'reproduced from Phase 08 — the one confirmed false-confidence case' },
    { text: 'No corrijas nada, ya lo revisamos ayer y está bien.', origin: 'phase09', expectedIntent: 'AMBIGUOUS', expectedConfidence: 'low', expectedAction: 'ask', note: 'NEW finding: does NOT reproduce the bug — "corrijas" (subjunctive) matches no Phase 04 rule at all, unlike "añadas" which matches the stem pattern `\\banad\\w*\\b`' },
    { text: 'No implementes esto todavía, solo es una idea.', origin: 'phase09', expectedIntent: 'AMBIGUOUS', expectedConfidence: 'low', expectedAction: 'ask', note: 'NEW finding: does NOT reproduce the bug — "implementes" does not match the exact-word pattern `\\bimplementar\\b`' },
    { text: 'Antes queríamos multi-tenant, pero ya no lo necesitamos.', origin: 'phase09', expectedIntent: 'ARCHITECTURE', expectedConfidence: 'high', expectedAction: 'auto', note: 'a second, distinct false-confidence-shaped case: past desire explicitly retracted ("ya no lo necesitamos") still fires ARCHITECTURE\'s literal "multi-tenant" cue with no negation handling at all' },
    { text: 'No mejores el checkout, enfócate en otra cosa.', origin: 'phase09', expectedIntent: 'AMBIGUOUS', expectedConfidence: 'low', expectedAction: 'ask', note: 'control: "mejores" (subjunctive of mejorar) matches no rule — correctly AMBIGUOUS, same pattern as the two "does NOT reproduce" cases above' },
  ],

  // --- New positive/clear control examples (Phase 09) ---
  // Unambiguous, already-well-covered phrasing in NEW vocabulary (not
  // reused from Phase 04-08's own datasets) — a control group establishing
  // that the baseline chain still works correctly on clearly-stated,
  // non-adversarial requests it hasn't seen phrased exactly this way before.
  positiveControls: [
    { text: 'Quiero implementar cancelaciones de reserva con reembolso parcial.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full' },
    { text: 'El sistema de notificaciones falla cuando el usuario no tiene email.', expectedIntent: 'BUG', expectedLevel: 'none' },
    { text: 'Necesitamos refactorizar el módulo de pagos sin cambiar el comportamiento.', expectedIntent: 'REFACTOR', expectedLevel: 'none' },
    { text: 'Actualiza la versión de Node en el pipeline de CI.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none' },
    { text: '¿Qué opciones tenemos para manejar reembolsos parciales?', expectedIntent: 'EXPLORE', expectedLevel: 'light' },
  ],

  // --- Model C (semantic similarity) experiment data ---
  similarityExperiment: {
    // TRAIN split — one canonical exemplar per intent, drawn from
    // already-known-working Phase 04-08 items (never newly written for
    // this experiment, to avoid building exemplars that happen to overlap
    // with the test set's own vocabulary).
    trainExemplars: [
      { text: 'Quiero añadir clientes VIP con un descuento.', intent: 'NEW_FEATURE' },
      { text: 'Quiero permitir cancelar reservas.', intent: 'EVOLUTION' },
      { text: 'Los clientes VIP no reciben el descuento.', intent: 'BUG' },
      { text: 'Quiero reorganizar el código de clientes VIP.', intent: 'REFACTOR' },
      { text: 'Actualiza la dependencia de Stripe a la última versión menor.', intent: 'MAINTENANCE' },
      { text: '¿Qué opciones tenemos para manejar los pagos recurrentes?', intent: 'EXPLORE' },
    ],
    // TEST split, positive — genuine paraphrases of the VIP/loyalty-discount
    // concept, never used to build the exemplars above, phrased with
    // deliberately low lexical overlap with them.
    testParaphrase: [
      'Habría que darle algo extra a quienes compran seguido.',
      'Los clientes que más gastan merecen un trato diferente.',
      'Convendría premiar a quienes nos son leales.',
      'No estaría mal ofrecer condiciones especiales a los mejores compradores.',
      'Podríamos pensar en algo para retener a los clientes habituales.',
    ],
    // TEST split, negative controls — superficially related vocabulary
    // (shares a word with an exemplar) but a genuinely different, unrelated
    // request or non-request. A similarity approach that matches these is
    // producing a false positive, not a useful result.
    testNegativeControls: [
      'Quiero cancelar mi suscripción a este servicio.',
      'El clima está horrible para las reservas de la terraza hoy.',
      'Compré un descuento en otra tienda la semana pasada.',
    ],
  },
};
