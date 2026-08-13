'use strict';

// Architecture Reasoning — Phase 06 of the Juntia migration.
//
// Turns a Product Reasoning result (Phase 05's `analyzeProduct()` output)
// into an explicit account of architectural impact, grounded recommendations
// (never decisions), risks, and unknowns — proportional to how much the
// request actually touches the existing system. Full design rationale,
// output-contract evaluation, and evaluation results:
// .juntia/migration/phases/06-architecture.md
//
// ARCHITECTURAL BOUNDARY (deliberate, per that phase's brief): this module
// decides WHETHER/HOW MUCH a request touches architecture, and can
// recommend — it does not decide technology choices, write code, generate
// diagrams, or turn a recommendation into a decision. Those belong to a
// human, an existing decision, or later phases (07 Engineering/QA).
//
// Consumes Phase 05's output shape directly (`productResult`) rather than
// re-deriving intent or product reasoning — this module does NOT call
// classifyIntent() or analyzeProduct() itself. Callers are responsible for
// producing (or, when testing input the current rule-based chain can't
// classify, hand-constructing) that upstream result — see phase doc's
// "Semantic Layer Hypothesis" section for why this matters.
//
// Deliberately NOT exposed via the CLI or a Claude Code skill in this phase
// — same reasoning as Phases 04-05 (no evidenced demand yet).

function normalize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Impact-category cues. Deliberately bilingual (Spanish + English) — a
// scope decision specific to this NEW detector, not a fix to Phase 04/05's
// existing Spanish-only rules (which stay untouched; see phase doc's
// "Relationship with Phase 04/05" section for why). Each category maps to
// one of the "Human in the loop" categories the brief requires to always
// surface a confirmation-required item.
const IMPACT_CUES = [
  { category: 'persistence', pattern: /\b(guardar|almacenar|persisti\w*|modelo de datos|base de datos|store\w*|database|persist\w*|data model)\b/ },
  { category: 'integration', pattern: /\b(proveedor externo|integrar\w*|integracion\w*|api externa|webhook|external provider|integrat\w*|third[- ]party|app movil|aplicacion movil|mobile app|pago\w*|payment\w*|cripto\w*|crypto\w*)\b/ },
  { category: 'security', pattern: /\b(autenticacion\w*|permisos|compliance|pci|datos sensibles|seguridad|authentication|security|sensitive data|autoriza\w*|authoriz\w*)\b/ },
  { category: 'ownership', pattern: /\b(multi-?tenant|multiples? (restaurantes|clientes|organizaciones|tenants)|aislar\w*|multiple (tenants|organizations)|per-tenant|compartir\w*|shar\w*)\b/ },
  { category: 'performance', pattern: /\b(escalar\w*|rendimiento|concurrencia|scale\w*|performance|throughput|carga\b|\bload\b)\b/ },
];

// Categories where the brief's "Human in the loop" section requires a
// confirmation-required item regardless of confidence, unless `known`
// already resolves them explicitly.
const ALWAYS_CONFIRM_CATEGORIES = ['security', 'ownership', 'persistence'];

function detectImpactCategories(normalizedText) {
  const categories = [];
  for (const { category, pattern } of IMPACT_CUES) {
    if (pattern.test(normalizedText)) categories.push(category);
  }
  return categories;
}

// Graduated scale, evidence-based (phase doc §7's dataset): zero categories
// -> 'none'; one narrow category -> 'low'; two, or one combined with an
// explicit evolution/new-entity signal -> 'moderate'; ownership
// (multi-tenant) or 2+ categories together -> 'high'. Deliberately a small,
// explainable rule, not a weighted score — mirrors Phase 04/05's own
// "simple and explicable" precedent.
function impactLevelFromCategories(categories) {
  if (categories.length === 0) return 'none';
  if (categories.includes('ownership') || categories.length >= 2) return 'high';
  if (categories.length === 1) return categories[0] === 'performance' ? 'low' : 'moderate';
  return 'low';
}

// Context-loading recommendation only — nothing is read here. Maps impact
// level to Phase 02's categories, aligned with (not identical to)
// GUIDELINES.md's existing tiny/normal/deep/architect effort tiers: 'low'
// ~ normal, 'moderate' ~ deep, 'high' ~ architect (the same threshold that
// already triggers `ctk-architecture-review` today, per BASELINE.md §2).
const CONTEXT_NEEDS_BY_IMPACT = {
  none: {},
  low: { project: 'minimal', architecture: 'minimal', decisions: 'relevant' },
  moderate: { project: 'relevant', architecture: 'relevant', decisions: 'relevant', state: 'optional' },
  high: { project: 'relevant', architecture: 'relevant', decisions: 'relevant', state: 'relevant', constraints: 'relevant', unknowns: 'relevant' },
};

function findComponentFor(category, known) {
  const components = (known && known.existingArchitecture && known.existingArchitecture.components) || [];
  return components.find((c) => (c.relevantTo || []).includes(category));
}

// Recommendations are assembled ONLY from caller-supplied existing-
// architecture facts, cited by name — never invented. This is the concrete,
// testable anti-hallucination mechanism Experiment 2 (phase doc §9)
// evaluates: with no `known.existingArchitecture`, this returns [].
function buildRecommendations(categories, known) {
  const recs = [];
  for (const category of categories) {
    const component = findComponentFor(category, known);
    if (component) {
      recs.push({
        value: `Considerar reutilizar "${component.name}" (${component.description}) para el aspecto de ${category}.`,
        basis: [`known.existingArchitecture: ${component.name}`],
      });
    }
  }
  return recs;
}

// Trade-offs only when the caller supplied 2+ real alternatives for the
// same concern — never generic pros/cons lists (brief's explicit "no
// produzcas trade-offs genéricos").
function buildTradeoffs(known) {
  const alternatives = (known && known.alternatives) || [];
  if (alternatives.length < 2) return [];
  return alternatives.map((a) => ({ option: a.option, pros: a.pros || [], cons: a.cons || [] }));
}

function buildUnknowns(categories, known) {
  const unknowns = [];
  for (const category of ALWAYS_CONFIRM_CATEGORIES) {
    if (!categories.includes(category)) continue;
    const resolved = findComponentFor(category, known);
    if (resolved) continue;
    unknowns.push({
      topic: `Confirmación humana requerida: impacto en ${category}`,
      blocking: true,
      reason: `La petición toca ${category}, una de las categorías que el Human-in-the-loop principle exige confirmar explícitamente (breaking changes, dependencias nuevas, datos, seguridad) — no hay contexto de arquitectura existente que ya lo resuelva.`,
    });
  }
  const hasAnyArchContext = !!(known && known.existingArchitecture && known.existingArchitecture.components && known.existingArchitecture.components.length);
  if (categories.length > 0 && !hasAnyArchContext) {
    unknowns.push({
      topic: 'Contexto de arquitectura existente no suministrado',
      blocking: false,
      reason: 'No se proporcionó known.existingArchitecture — las recomendaciones específicas de reutilización no pueden fundamentarse todavía, aunque el impacto sí se detectó.',
    });
  }
  return unknowns;
}

function buildQuestions(unknowns) {
  return unknowns.filter((u) => u.blocking).map((u) => `${u.topic}: ${u.reason} ¿Puedes confirmar antes de continuar?`);
}

// analyzeArchitecture(text, productResult, known) -> structured result.
// `productResult` is Phase 05's `analyzeProduct()` output (or an equivalent
// hand-constructed shape — see phase doc). `known` is optional:
// { decisions: [], constraints: [], existingArchitecture: { components: [{name, description, relevantTo: [category,...]}] }, alternatives: [{option, pros, cons}] }
function analyzeArchitecture(text, productResult, known = {}) {
  const level = productResult ? productResult.level : 'none';
  const intent = productResult ? productResult.intent : null;

  // Proportionality gate: no product-level reasoning happened upstream
  // (MAINTENANCE, clean BUG, UNDERSTAND, VALIDATION, REFACTOR, AMBIGUOUS
  // without hedging) -> no architecture reasoning either. Mirrors Phase 05's
  // own `level: 'none'` short-circuit precedent.
  //
  // EXCEPTION, found by testing rather than assumed: Phase 05 returns
  // `level: 'none'` for ARCHITECTURE-intent requests on purpose (its own
  // BASE_LEVEL_BY_INTENT comment says "explicitly out of scope for this
  // phase... belongs to Phase 06") — meaning this module's own gate, if it
  // only checked `level`, would silently never engage for exactly the
  // requests it exists to handle (e.g. "necesitamos soporte multi-tenant").
  // ARCHITECTURE intent always proceeds to impact detection regardless of
  // Phase 05's level.
  if (!productResult || (level === 'none' && intent !== 'ARCHITECTURE')) {
    return {
      impactLevel: 'none',
      impactCategories: [],
      contextNeeds: CONTEXT_NEEDS_BY_IMPACT.none,
      recommendations: [],
      tradeoffs: [],
      risks: [],
      constraints: [],
      unknowns: [],
      decisionsRequired: [],
      questions: [],
    };
  }

  const normalizedText = normalize(text);
  const categories = detectImpactCategories(normalizedText);
  const impactLevel = impactLevelFromCategories(categories);

  if (impactLevel === 'none') {
    return {
      impactLevel: 'none',
      impactCategories: [],
      contextNeeds: CONTEXT_NEEDS_BY_IMPACT.none,
      recommendations: [],
      tradeoffs: [],
      risks: [],
      constraints: [],
      unknowns: [],
      decisionsRequired: [],
      questions: [],
    };
  }

  const recommendations = buildRecommendations(categories, known);
  const tradeoffs = buildTradeoffs(known);
  const constraints = ((known && known.constraints) || []).map((c) => ({ value: c.constraint, source: c.topic || 'known' }));
  const unknowns = buildUnknowns(categories, known);
  const decisionsRequired = unknowns.filter((u) => u.blocking).map((u) => ({ topic: u.topic, question: `${u.topic}: ${u.reason}` }));
  const questions = buildQuestions(unknowns);

  // Risks: only from concrete, evidence-backed signals — never boilerplate
  // ("this could be risky") padding.
  const risks = [];
  if (categories.includes('persistence') && level === 'full') {
    risks.push({ value: 'Cambios en el modelo de datos son difíciles de revertir una vez hay datos reales.', category: 'persistence' });
  }
  if (categories.includes('ownership')) {
    risks.push({ value: 'Cambios de ownership/multi-tenant suelen tener alcance amplio e imprevisto en el resto del sistema.', category: 'ownership' });
  }

  return {
    impactLevel,
    impactCategories: categories,
    contextNeeds: CONTEXT_NEEDS_BY_IMPACT[impactLevel],
    recommendations,
    tradeoffs,
    risks,
    constraints,
    unknowns,
    decisionsRequired,
    questions,
  };
}

module.exports = {
  IMPACT_CUES,
  ALWAYS_CONFIRM_CATEGORIES,
  CONTEXT_NEEDS_BY_IMPACT,
  analyzeArchitecture,
  normalize, // exported for tests only
};
