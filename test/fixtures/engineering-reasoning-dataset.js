'use strict';

// Evaluation dataset for Engineering Reasoning (Phase 07). 30 requests
// across the 6 buckets the phase brief required (5 each: tiny changes,
// normal features, evolution tasks, architecture-impacting changes,
// ambiguous/incomplete tasks, high-risk changes), plus 2 deliberately
// preserved misses and a real-repository experiment (bonus, not part of
// the 30).
//
// Every expected value was recorded from actually running the real chain
// (classifyIntent() -> analyzeProduct() -> analyzeArchitecture() ->
// analyzeEngineering()) — not predicted first and reconciled after, same
// discipline as Phases 04-06. No item in this dataset uses
// `simulatedUpstream` for the required 30 or the misses — Engineering
// Reasoning takes no raw text, so there is nothing of its own to simulate;
// every item runs the real upstream chain with `known` supplied exactly as
// a real caller would. One bonus item at the end (`semanticLayerInheritance`)
// DOES hand-construct upstream output, to demonstrate what Engineering would
// do if Phase 04/05's language ceiling (documented in Phase 06) were fixed —
// labeled `simulatedUpstream: true` with an explicit reason, same convention
// Phase 06 established.

module.exports = {
  core: [
    // --- Tiny changes (5) — MAINTENANCE / clean BUG, no architecture impact ---
    { bucket: 'tiny_changes', text: 'Actualiza la dependencia de Stripe a la última versión menor.', known: {}, expectedIntent: 'MAINTENANCE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'tiny', expectedHumanAction: 'AUTO' },
    { bucket: 'tiny_changes', text: 'Arregla el warning de lint en el archivo de checkout.', known: {}, expectedIntent: 'MAINTENANCE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'tiny', expectedHumanAction: 'AUTO' },
    { bucket: 'tiny_changes', text: 'Corrige el typo en el mensaje de confirmación.', known: {}, expectedIntent: 'MAINTENANCE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'tiny', expectedHumanAction: 'AUTO' },
    { bucket: 'tiny_changes', text: 'Actualiza el changelog con los cambios de esta semana.', known: {}, expectedIntent: 'MAINTENANCE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'tiny', expectedHumanAction: 'AUTO' },
    { bucket: 'tiny_changes', text: 'Los emails de confirmación no se están enviando desde ayer.', known: {}, expectedIntent: 'BUG', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'tiny', expectedHumanAction: 'AUTO', note: 'clean technical bug, no product/architecture reasoning ran upstream (level none, impact none) — Engineering still applies at tiny tier, since a bug is engineering work even when Product/Architecture stayed silent' },

    // --- Normal features (5) — NEW_FEATURE, no architecture signal in text ---
    { bucket: 'normal_features', text: 'Quiero añadir clientes VIP con más de 10 reservas de descuento.', known: {}, expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO', note: '"con más de 10 reservas" satisfies Product Reasoning\'s DEFINITION_MARKERS — VIP is defined inline, no blocking unknown' },
    { bucket: 'normal_features', text: 'Quiero añadir reservas.', known: {}, expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'normal_features', text: 'Necesitamos implementar un sistema de notificaciones por email.', known: {}, expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'normal_features', text: 'Quiero construir un flujo de checkout para el carrito.', known: {}, expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'normal_features', text: 'Quiero crear un panel de administración.', known: {}, expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },

    // --- Evolution tasks (5) — EVOLUTION, mostly no architecture signal, one exception ---
    { bucket: 'evolution_tasks', text: 'Quiero permitir cancelar reservas.', known: {}, expectedIntent: 'EVOLUTION', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'evolution_tasks', text: 'Quiero ampliar el sistema de descuentos para incluir cupones combinables.', known: {}, expectedIntent: 'EVOLUTION', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'evolution_tasks', text: 'Quiero extender el sistema de notificaciones para incluir SMS.', known: {}, expectedIntent: 'EVOLUTION', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'evolution_tasks', text: 'Quiero cambiar cómo funcionan los clientes VIP con más de 10 reservas.', known: {}, expectedIntent: 'EVOLUTION', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO' },
    { bucket: 'evolution_tasks', text: 'Quiero permitir reservas desde una app móvil.', known: {}, expectedIntent: 'EVOLUTION', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'deep', expectedHumanAction: 'CONFIRM', expectedCategories: ['integration'], expectFilesUnknownFor: 'integration', note: 'new client/API surface — impact moderate/integration, no known.existingArchitecture supplied so files stay UNKNOWN' },

    // --- Architecture-impacting changes (5) — the core Product->Architecture->Engineering chain ---
    {
      bucket: 'architecture_impacting',
      text: 'Quiero agregar pagos con un proveedor externo.',
      known: { existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente para Stripe', relevantTo: ['integration'], files: ['src/payments/adapter.js'] }] } },
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'deep', expectedHumanAction: 'CONFIRM',
      expectFilesKnownFor: 'integration',
    },
    {
      bucket: 'architecture_impacting',
      text: 'Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.',
      known: {},
      expectedIntent: 'ARCHITECTURE', expectedApplicable: false,
      expectedReasonIncludes: 'no autoriza trabajo de ingeniería',
      note: 'ARCHITECTURE intent alone — recommendation, not decision (Phase 06 §2) — Engineering does not engage',
    },
    {
      bucket: 'architecture_impacting',
      text: 'Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.',
      known: {
        decisions: [{ topic: 'arquitectura multi-tenant', decision: 'Se decidió adoptar TenantContext como mecanismo de aislamiento.', source: 'human' }],
        existingArchitecture: { components: [{ name: 'TenantContext', description: 'contexto existente', relevantTo: ['ownership'], files: ['src/tenant/context.js'] }] },
      },
      expectedIntent: 'ARCHITECTURE', expectedApplicable: false,
      expectedReasonIncludes: 'no autoriza trabajo de ingeniería',
      note: 'DELIBERATE LIMITATION, tested not assumed: even with a known.decisions entry AND a resolving component supplied, this version\'s gate keys off intent alone (ARCHITECTURE is never in ENGINEERING_APPLICABLE_INTENTS) — it does not check whether a decision already exists. The correct workflow today is: re-submit the resulting work as a NEW_FEATURE/EVOLUTION request once the decision is made, not expect Engineering to detect the decision itself. See phase doc for why a decision-matching heuristic was investigated and not built this phase.',
    },
    {
      bucket: 'architecture_impacting',
      text: 'Quiero crear un sistema de fidelización con persistencia propia.',
      known: {},
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'BLOCKED', expectedTier: 'deep', expectedHumanAction: 'BLOCK',
      expectedBlockingTopicsInclude: ['Definición de "programa de fidelización"', 'Confirmación humana requerida: impacto en persistence'],
    },
    {
      bucket: 'architecture_impacting',
      text: 'Quiero crear un sistema de fidelización con persistencia propia.',
      known: {
        decisions: [{ topic: 'fidelizacion', decision: 'Programa de fidelización = 1 punto por cada $10 gastados, canjeable por descuentos.', source: 'product-team' }],
        existingArchitecture: { components: [{ name: 'CustomerProfileStore', description: 'almacén de datos de cliente existente', relevantTo: ['persistence'], files: ['src/customers/store.js'], testCoverage: 'low' }] },
      },
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'deep', expectedHumanAction: 'CONFIRM',
      expectFilesKnownFor: 'persistence',
      expectRegressionRiskCiting: 'CustomerProfileStore',
      note: 'same request as the item above, now BLOCKED -> READY once both a product decision (fidelización definition) and an architecture component (persistence) are supplied — demonstrates unknown resolution is entirely upstream-driven, Engineering invents nothing',
    },

    // --- Ambiguous / incomplete tasks (5) — expect the chain to correctly decline ---
    { bucket: 'ambiguous_incomplete', text: 'Algo pasa con las reservas.', known: {}, expectedIntent: 'AMBIGUOUS', expectedApplicable: false },
    { bucket: 'ambiguous_incomplete', text: 'Mejora el sistema de pagos.', known: {}, expectedIntent: 'AMBIGUOUS', expectedApplicable: false },
    { bucket: 'ambiguous_incomplete', text: '¿Deberíamos considerar añadir un sistema de referidos?', known: {}, expectedIntent: 'AMBIGUOUS', expectedApplicable: false },
    { bucket: 'ambiguous_incomplete', text: 'Quiero que los clientes premium tengan beneficios especiales.', known: {}, expectedIntent: 'AMBIGUOUS', expectedApplicable: false },
    {
      bucket: 'ambiguous_incomplete',
      text: 'Quiero añadir un programa de puntos.',
      known: {},
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'normal', expectedHumanAction: 'AUTO',
      note: 'INHERITED RISK, not a new Engineering bug: this is Phase 05\'s own documented miss (phases/05-product.md §7) — "programa de puntos" isn\'t in NAMED_CATEGORY_TERMS, so Product Reasoning detects zero unknowns despite the request being obviously under-specified (what earns points? what are they worth?). Engineering inherits this false confidence and reports READY/AUTO for something a human would still want to question. See phase doc for why this is preserved, not patched, here.',
    },

    // --- High-risk changes (5) — security/persistence, ALWAYS_CONFIRM categories ---
    {
      bucket: 'high_risk',
      text: 'Quiero agregar autenticación de dos factores para proteger las cuentas.',
      known: {},
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'BLOCKED', expectedTier: 'deep', expectedHumanAction: 'BLOCK',
      expectedBlockingTopicsInclude: ['Confirmación humana requerida: impacto en security'],
    },
    {
      bucket: 'high_risk',
      text: 'Quiero agregar autenticación de dos factores para proteger las cuentas.',
      known: { existingArchitecture: { components: [{ name: 'AuthModule', description: 'módulo de autenticación existente', relevantTo: ['security'], files: ['src/auth/module.js'] }] } },
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'deep', expectedHumanAction: 'CONFIRM',
      expectFilesKnownFor: 'security',
    },
    {
      bucket: 'high_risk',
      text: 'Quiero implementar el guardar de datos sensibles de tarjetas para compras futuras.',
      known: {},
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'BLOCKED', expectedTier: 'architect', expectedHumanAction: 'BLOCK',
      expectedBlockingTopicsInclude: ['Confirmación humana requerida: impacto en security', 'Confirmación humana requerida: impacto en persistence'],
      note: 'two ALWAYS_CONFIRM categories at once (persistence + security) -> impactLevel high -> effortTier architect',
    },
    {
      bucket: 'high_risk',
      text: 'Quiero implementar el guardar de datos sensibles de tarjetas para compras futuras.',
      known: { existingArchitecture: { components: [{ name: 'VaultedCardStore', description: 'almacén PCI-compliant existente, gestiona persistencia y control de acceso', relevantTo: ['persistence', 'security'], files: ['src/payments/vault.js'], testCoverage: 'ok' }] } },
      expectedIntent: 'NEW_FEATURE', expectedApplicable: true, expectedStatus: 'READY', expectedTier: 'architect', expectedHumanAction: 'CONFIRM',
      expectFilesKnownFor: 'persistence',
      note: 'one component resolving BOTH always-confirm categories at once — unblocks both, files cited for both',
    },
    {
      bucket: 'high_risk',
      text: 'Quiero migrar el sistema de reservas a multi-tenant y permitir pagos con criptomonedas.',
      known: {},
      expectedIntent: 'ARCHITECTURE', expectedApplicable: false,
      expectedReasonIncludes: 'no autoriza trabajo de ingeniería',
      note: 'high-risk AND architecture-gated — the two-category (ownership+integration) architecture-impact finding does not, by itself, unlock Engineering; a decision is still required first',
    },
  ],

  // Deliberately preserved misses — real, inherited Phase 04 gaps surfaced
  // by this phase's own dataset construction, not fixed here (phase-boundary
  // discipline, same as Phase 05 finding the imperative-conjugation gap in
  // Phase 04, and Phase 06 finding the payment/crypto cue gap in itself).
  misses: [
    {
      bucket: 'documented_miss',
      text: 'Necesitamos guardar datos de tarjetas de crédito para pagos recurrentes.',
      known: {},
      expectedIntent: 'AMBIGUOUS',
      note: 'DELIBERATE MISS: "necesitamos guardar X" is not recognized as NEW_FEATURE creation language by Phase 04\'s RULES (which require anadir/agregar/crear/implementar/construir) — a human reading this immediately understands it as a high-risk, well-formed feature request (touches persistence + security), but the chain never gets past AMBIGUOUS, so Engineering never even sees it. Not fixed here — that file belongs to Phase 04\'s already-checkpointed scope.',
    },
    {
      bucket: 'documented_miss',
      text: 'Quiero guardar datos sensibles de tarjetas de crédito para compras futuras.',
      known: {},
      expectedIntent: 'AMBIGUOUS',
      note: 'Same root cause as above with a first-person "quiero" framing that usually classifies cleanly elsewhere in this dataset — "guardar" alone (without a preceding "implementar el"/"crear un") still isn\'t a recognized NEW_FEATURE cue. Confirms the gap is about the specific verb "guardar", not about person/framing.',
    },
  ],

  // Real-repository experiment (bonus, not part of the 30) — per the
  // brief's explicit instruction to use this repo as a minimum case. Uses
  // BASELINE.md §9/§10's own real finding ("lib/*.js modules are
  // deliberately zero-dependency and stateless today"; "no telemetry
  // exists") as the known.existingArchitecture input, exactly as Phase 06's
  // own real-repo experiment did.
  realRepoExperiment: {
    text: 'Quiero implementar un sistema de telemetría para guardar datos de uso de los skills.',
    knownWithoutGrounding: {},
    knownWithGrounding: {
      existingArchitecture: {
        components: [{
          name: 'lib/*.js modules',
          description: 'módulos deliberadamente sin dependencias y sin estado hoy (BASELINE.md §9)',
          relevantTo: ['persistence'],
          testCoverage: 'ok',
          // Deliberately NO `files` array — BASELINE.md names a pattern
          // ("lib/*.js modules"), not concrete file paths. This is the
          // point of the experiment: grounding can be specific enough to
          // resolve a human-confirmation unknown while still not being
          // specific enough to name real files.
        }],
      },
    },
  },

  // Bonus item demonstrating what Engineering WOULD produce once Phase 06's
  // documented Semantic Layer ceiling is addressed — hand-constructs the
  // upstream shape instead of running the real chain, because the real
  // chain returns AMBIGUOUS/none for this English phrasing today (same
  // finding Phase 06 demonstrated, not re-litigated here). Labeled
  // explicitly, used once, same convention as Phase 06's own
  // `simulatedUpstream` items.
  semanticLayerInheritance: {
    text: "Let's give our loyal customers a 10% discount.",
    simulatedUpstream: true,
    reason: 'Real chain returns AMBIGUOUS/none for this English phrasing (Phase 06\'s documented Semantic Layer finding) — Engineering never even receives it today. This hand-constructed input shows Engineering\'s OWN logic is already ready to consume a corrected upstream, whenever one exists; the gap is entirely upstream, not in this module.',
    productResult: {
      intent: 'NEW_FEATURE', level: 'full', levelReason: 'simulated',
      problem: null, goal: null, actors: [],
      desiredBehavior: [{ value: 'Aplicar un descuento del 10% a clientes frecuentes.', status: 'KNOWN' }],
      constraints: [], knownDecisions: [], unknowns: [], decisionsRequired: [],
      acceptanceCriteria: [{ value: 'Aplicar un descuento del 10% a clientes frecuentes.', basis: 'desiredBehavior only' }],
      nonGoals: [], questions: [],
    },
    architectureResult: {
      impactLevel: 'none', impactCategories: [], contextNeeds: {}, recommendations: [],
      tradeoffs: [], risks: [], constraints: [], unknowns: [], decisionsRequired: [], questions: [],
    },
  },
};
