'use strict';

// Baseline reproduction dataset for Phase 08 (Semantic Layer investigation).
// 35 requests across the 11 categories the phase brief required (formal
// Spanish, colloquial Spanish, English, natural imperative forms,
// paraphrases, omitted subjects, indirect requests, conversational
// shorthand, ambiguous requests, domain terminology, context-dependent
// requests), plus Phase 06's exact 3-item Semantic Layer probe and Phase
// 07's exact 5 anti-hallucination examples (both reused verbatim, per the
// brief's explicit instruction to include them).
//
// Every `expectedIntent`/`expectedLevel` value was recorded from actually
// running the real chain (classifyIntent() -> analyzeProduct()) — not
// predicted first and reconciled after, same discipline as every prior
// phase. This dataset documents the CURRENT real failure surface as of
// Phase 08 — it is not tuned, and several items are deliberately preserved
// as known, documented gaps (see phases/08-semantic-layer.md for the full
// analysis of each category).

module.exports = {
  baseline: [
    // --- formal Spanish (control group — expected to already work) ---
    { cat: 'formal_es', text: 'Quiero añadir clientes VIP con un descuento.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full' },
    { cat: 'formal_es', text: '¿Deberíamos migrar de PostgreSQL a un almacenamiento distribuido?', expectedIntent: 'ARCHITECTURE', expectedLevel: 'none' },

    // --- colloquial Spanish ---
    { cat: 'colloquial_es', text: 'Metamos un descuento a los que más compran.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'colloquial_es', text: 'Dale soporte a los VIP.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'colloquial_es', text: "Pon un descuento pa' los que compran seguido.", expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- English ---
    { cat: 'english', text: "Let's give our loyal customers a 10% discount.", expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'english', text: 'Add multi-tenant support so each restaurant has isolated data.', expectedIntent: 'ARCHITECTURE', expectedLevel: 'none', note: 'accidental partial coverage — "multi-tenant" is a hardcoded literal cue in ARCHITECTURE\'s pattern, not general English support' },
    { cat: 'english', text: "Fix the bug where VIP customers don't get their discount.", expectedIntent: 'BUG', expectedLevel: 'light', note: 'accidental partial coverage — "bug" is a hardcoded literal English loanword in BUG\'s own pattern' },
    { cat: 'english', text: 'We need to store credit card data for recurring payments.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- natural imperative forms (Spanish) ---
    { cat: 'imperative_es', text: 'Implementa un sistema de descuentos para clientes VIP.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', note: 'documented Phase 04/05 gap — "implementa" (imperative) does not match the infinitive-only "\\bimplementar\\b" pattern' },
    { cat: 'imperative_es', text: 'Crea un panel de administración.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', note: 'same root cause — "crea" vs "\\bcrear (un|una|el|la)\\b"' },
    { cat: 'imperative_es', text: 'Añade soporte multi-tenant.', expectedIntent: 'ARCHITECTURE', expectedLevel: 'none', note: '"añade" DOES match (NEW_FEATURE\'s "\\banad\\w*\\b" stem pattern already covers it via the \\w* wildcard) — but ARCHITECTURE\'s literal "multi-tenant" cue outscores it here' },
    { cat: 'imperative_es', text: 'Guarda esto.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', note: 'no creation-verb cue matches "guardar" at all (Phase 07\'s own documented finding, phases/07-engineering-qa.md §9)' },

    // --- paraphrases (same meaning, different words — no lexical overlap with any rule) ---
    { cat: 'paraphrase', text: 'Necesitamos que los clientes que más compran tengan alguna ventaja.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'paraphrase', text: 'Sería bueno ofrecer algo especial a los mejores clientes.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'light', note: 'hedging language ("sería bueno") is recognized, so Product Reasoning treats it as an exploratory idea (light) even though Intent Router itself has no signal' },

    // --- omitted subjects ---
    { cat: 'omitted_subject', text: 'Añade un descuento del 10%.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', note: 'works despite the omitted subject (who gets the discount?) — the creation verb alone is enough for Phase 04; Product Reasoning does not flag the missing subject as an unknown either (no NAMED_CATEGORY_TERMS match)' },
    { cat: 'omitted_subject', text: 'Corrígelo, no está funcionando bien.', expectedIntent: 'BUG', expectedLevel: 'none', note: 'the pronoun "lo" (referring to something unspecified) does not prevent BUG detection — the negation language alone is sufficient signal for Phase 04, even though a human still would not know WHAT is broken' },

    // --- indirect requests ---
    { cat: 'indirect', text: '¿Podrías revisar por qué los clientes VIP no reciben su descuento?', expectedIntent: 'BUG', expectedLevel: 'light' },
    { cat: 'indirect', text: 'Estaría bien que revisáramos el checkout, últimamente da problemas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'light' },

    // --- conversational shorthand (requires conversation memory this system does not have) ---
    { cat: 'shorthand', text: 'Igual que el otro pero para reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'shorthand', text: 'Lo mismo de siempre.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- ambiguous requests (already-known class, Phase 04's own dataset covers more) ---
    { cat: 'ambiguous', text: 'Mejora el checkout.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'ambiguous', text: 'Arregla las reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- domain terminology (business jargon, no generic creation/change verb present) ---
    { cat: 'domain_jargon', text: 'Necesitamos churn reduction para los clientes en riesgo.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'domain_jargon', text: 'El onboarding de nuevos restaurantes debería ser más rápido.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- requests that require context to interpret (no antecedent in the text itself) ---
    { cat: 'context_dependent', text: 'Vuelve a como estaba.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'context_dependent', text: 'Como en el otro proyecto.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- Phase 06's exact Semantic Layer probe, reused verbatim ---
    { cat: 'phase06_probe', text: 'Quiero que los clientes VIP tengan un 10% menos.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'phase06_probe', text: "Let's give our loyal customers a 10% discount.", expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'phase06_probe', text: 'Metamos un descuento a los que más compran.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },

    // --- Phase 07's exact anti-hallucination examples, reused verbatim ---
    { cat: 'phase07_underspec', text: 'haz que los VIP tengan descuento', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'phase07_underspec', text: 'añade soporte multi-tenant', expectedIntent: 'ARCHITECTURE', expectedLevel: 'none' },
    { cat: 'phase07_underspec', text: 'guarda esto', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'phase07_underspec', text: 'mejora el checkout', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
    { cat: 'phase07_underspec', text: 'hazlo como antes', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none' },
  ],

  // A real, previously undocumented gap found while building this phase's
  // own adversarial/failure-mode probes (brief §9: "adversarial or
  // contradictory wording") — NOT introduced or fixed by this phase, a
  // pre-existing Phase 04 rule-scope gap. Preserved as a documented,
  // passing test of CURRENT (wrong) behavior, same discipline as every
  // prior phase's preserved misses.
  falseConfidence: [
    {
      text: 'No añadas nada, solo revisa el código.',
      expectedIntent: 'NEW_FEATURE',
      expectedConfidence: 'medium',
      expectedAction: 'auto',
      note: 'DOCUMENTED BUG, not fixed: an explicit refusal ("don\'t add anything") is misclassified as a request TO add, with action:auto (proceeds without asking). Root cause: NEW_FEATURE\'s "\\banad\\w*\\b" cue fires on "añadas" regardless of the preceding "no", because Phase 04\'s BUG negation pattern (\\bno (se)?(esta\\w*|recib\\w*|guard\\w*|envia\\w*|funcion\\w*|aplic\\w*)\\b) does not cover "añad" as a negatable stem — so the negation never overrides the creation cue. This is worse than an honest AMBIGUOUS: it is a confident, silent misclassification. See phases/08-semantic-layer.md §9 for why confidence-gated routing alone cannot catch this class of failure.',
    },
  ],
};
