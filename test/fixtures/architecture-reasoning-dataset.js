'use strict';

// Evaluation dataset for Architecture Reasoning (Phase 06). 30 requests
// across the 6 buckets the phase brief required (5 each: tiny maintenance,
// normal features, evolution, new architecture-impacting features,
// ambiguous/incomplete requirements, cases with meaningful existing
// architecture constraints), plus a bonus multilingual/informal set
// specifically probing the Semantic Layer Hypothesis (phase doc §6).
//
// Every `expectedIntent`/`expectedLevel`/`expectedImpact` value was recorded
// from actually running the real chain (`classifyIntent()` ->
// `analyzeProduct()` -> `analyzeArchitecture()`) — not predicted first and
// reconciled after. Items marked `simulatedUpstream: true` hand-construct
// the Product Reasoning input directly instead of chaining through the real
// (Spanish-only) upstream, because the real chain returns AMBIGUOUS/none for
// that exact phrasing — this is the concrete evidence for the Semantic
// Layer Hypothesis discussion, not a shortcut around it. See phase doc §6-7
// for the full honest account, including which items are deliberately
// preserved misses rather than tuned to pass.

module.exports = {
  core: [
    // --- Tiny maintenance (5) — expect product level 'none', architecture impact 'none' ---
    { bucket: 'tiny_maintenance', text: 'Actualiza la dependencia de Stripe a la última versión menor.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'tiny_maintenance', text: 'Arregla el warning de lint en el archivo de checkout.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'tiny_maintenance', text: 'Corrige el typo en el mensaje de confirmación.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'tiny_maintenance', text: 'Actualiza el changelog con los cambios de esta semana.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'tiny_maintenance', text: 'Quiero renombrar el texto del botón de reservar.', expectedIntent: 'REFACTOR', expectedLevel: 'none', expectedImpact: 'none', note: 'phase brief\'s own example #1 ("renombrar el botón"), reworded to infinitive form — the imperative "renombra" hits the same Phase 04 conjugation gap already documented in Phase 05' },

    // --- Normal features (5) — NEW_FEATURE/full, no clear architecture signal in text ---
    { bucket: 'normal_feature', text: 'Quiero añadir clientes VIP con un descuento.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none', note: 'phase brief\'s own example #2 — a discount rule alone doesn\'t name persistence/integration/security explicitly' },
    { bucket: 'normal_feature', text: 'Quiero añadir reservas.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none', note: 'phase brief\'s own example #3' },
    { bucket: 'normal_feature', text: 'Necesitamos implementar un sistema de notificaciones por email.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none' },
    { bucket: 'normal_feature', text: 'Quiero construir un flujo de checkout para el carrito.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none' },
    { bucket: 'normal_feature', text: 'Quiero crear un panel de administración.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none' },

    // --- Evolution (5) — EVOLUTION/full, mostly no architecture signal, one exception ---
    { bucket: 'evolution', text: 'Quiero permitir cancelar reservas.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'none', note: 'phase brief\'s own example #4' },
    { bucket: 'evolution', text: 'Quiero ampliar el sistema de descuentos para incluir cupones combinables.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'none' },
    { bucket: 'evolution', text: 'Necesitamos que el checkout también acepte pagos con criptomonedas.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'moderate', expectedCategories: ['integration'] },
    { bucket: 'evolution', text: 'Quiero extender el sistema de notificaciones para incluir SMS.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'none' },
    { bucket: 'evolution', text: 'Quiero cambiar cómo funcionan los clientes VIP.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'none' },

    // --- New architecture-impacting features (5) — the core value proposition ---
    { bucket: 'architecture_impacting', text: 'Quiero agregar pagos con un proveedor externo.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'moderate', expectedCategories: ['integration'], note: 'phase brief\'s own example #6' },
    { bucket: 'architecture_impacting', text: 'Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.', expectedIntent: 'ARCHITECTURE', expectedLevel: 'none', expectedImpact: 'high', expectedCategories: ['ownership'], note: 'phase brief\'s own example #9 — real cross-phase finding: Phase 05 returns level=none for ARCHITECTURE intent on purpose (deferred to this phase); this module\'s gate has an explicit exception for intent===ARCHITECTURE so it still engages (see phase doc §7)' },
    { bucket: 'architecture_impacting', text: 'Quiero crear un sistema de fidelización con persistencia propia.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'moderate', expectedCategories: ['persistence'], note: 'phase brief\'s own example #8, reworded to state persistence explicitly — see the "miss" companion item below for the unworded version' },
    { bucket: 'architecture_impacting', text: 'Quiero permitir reservas desde una app móvil.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'moderate', expectedCategories: ['integration'], note: 'phase brief\'s own example #7 — a new client/API surface' },
    {
      bucket: 'architecture_impacting',
      text: "Let's add payments through an external provider with PCI compliance.",
      expectedIntent: 'NEW_FEATURE',
      expectedLevel: 'full',
      expectedImpact: 'high',
      expectedCategories: ['integration', 'security'],
      simulatedUpstream: true,
      note: 'ENGLISH — the real chain returns AMBIGUOUS/none for this (0% English coverage, phase doc §6); upstream hand-constructed to test this module\'s OWN logic in isolation from Phase 04/05\'s known language gap',
    },

    // --- Ambiguous / incomplete requirements (5) — expect the chain to correctly decline ---
    { bucket: 'ambiguous', text: 'Algo pasa con las reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'ambiguous', text: 'Mejora el sistema de pagos.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'ambiguous', text: 'Quiero mejorar el rendimiento del checkout.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'ambiguous', text: '¿Deberíamos considerar añadir un sistema de referidos?', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none' },
    { bucket: 'ambiguous', text: 'Quiero que los clientes premium tengan beneficios especiales.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none' },

    // --- Cases with meaningful existing architecture constraints (5) — consult-before-recommend ---
    {
      bucket: 'existing_constraints',
      text: 'Necesitamos que el checkout también acepte pagos con criptomonedas.',
      expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'moderate',
      known: { existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente para Stripe', relevantTo: ['integration'] }] } },
      expectRecommendationCiting: 'PaymentGatewayAdapter',
    },
    {
      bucket: 'existing_constraints',
      text: 'Quiero agregar pagos con un proveedor externo.',
      expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'moderate',
      known: { existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente para Stripe', relevantTo: ['integration'] }] } },
      expectRecommendationCiting: 'PaymentGatewayAdapter',
    },
    {
      bucket: 'existing_constraints',
      text: 'Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.',
      expectedIntent: 'ARCHITECTURE', expectedLevel: 'none', expectedImpact: 'high',
      known: { existingArchitecture: { components: [{ name: 'TenantContext', description: 'contexto de aislamiento existente, usado hoy solo para logging', relevantTo: ['ownership'] }] } },
      expectNoBlockingUnknownFor: 'ownership',
      note: 'a supplied known component resolves the otherwise-always-required human-confirmation unknown for ownership',
    },
    {
      bucket: 'existing_constraints',
      text: 'Quiero crear un sistema de fidelización con persistencia propia.',
      expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'moderate',
      known: { existingArchitecture: { components: [{ name: 'CustomerProfileStore', description: 'almacén de datos de cliente existente', relevantTo: ['persistence'] }] } },
      expectRecommendationCiting: 'CustomerProfileStore',
    },
    {
      bucket: 'existing_constraints',
      text: 'Necesitamos que el checkout también acepte pagos con criptomonedas.',
      expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedImpact: 'moderate',
      known: {
        existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente para Stripe', relevantTo: ['integration'] }] },
        alternatives: [
          { option: 'Extender PaymentGatewayAdapter para soportar criptomonedas', pros: ['reutiliza infraestructura existente'], cons: ['acopla el adapter a dos dominios de pago distintos'] },
          { option: 'Crear un CryptoPaymentAdapter dedicado', pros: ['aislamiento total'], cons: ['duplica lógica de checkout, mayor mantenimiento'] },
        ],
      },
      expectTradeoffs: 2,
      note: 'trade-offs only appear when the caller supplies 2+ real alternatives — never generic pros/cons',
    },
  ],

  // Deliberately preserved misses / boundary cases (not tuned to pass) —
  // see phase doc §7-8 for why these stay as documented limitations.
  misses: [
    {
      bucket: 'documented_miss',
      text: 'Quiero crear un sistema de fidelización.',
      expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedImpact: 'none',
      note: 'DELIBERATE MISS: unlike its "con persistencia propia" sibling above, this unadorned phrasing names no explicit persistence/integration/security cue, so impact stays "none" even though a real loyalty program almost certainly needs storage — the module requires an explicit textual cue, it does not infer implied architecture needs from domain knowledge (see phase doc §6)',
    },
    {
      bucket: 'documented_miss',
      text: 'Quiero que restaurantes puedan integrar sus propios sistemas mediante una API.',
      expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedImpact: 'none',
      note: 'phase brief\'s own example #10, preserved verbatim — the same "poder" conjugation gap Phase 05 already documented blocks this from ever reaching Architecture Reasoning, despite reading as an unambiguous, high-impact integration request to a human',
    },
  ],

  // Semantic Layer Hypothesis demonstration set (bonus, not part of the
  // required 30) — same underlying request, three phrasings, run through
  // the REAL chain with no simulation. See phase doc §6.
  semanticLayerProbe: [
    { text: 'Quiero que los clientes VIP tengan un 10% menos.', lang: 'es-formal' },
    { text: "Let's give our loyal customers a 10% discount.", lang: 'en' },
    { text: 'Metamos un descuento a los que más compran.', lang: 'es-informal' },
  ],
};
