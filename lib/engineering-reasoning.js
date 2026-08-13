'use strict';

// Engineering Reasoning — Phase 07 of the Juntia migration.
//
// Turns a Product Reasoning result (Phase 05) + an Architecture Reasoning
// result (Phase 06) into an Engineering Unit: the smallest structured
// account of WHAT needs to change, WHY, WHERE it likely lands, WHAT
// decisions/unknowns still block it, and HOW we'll know it's right — clear
// enough for an AI runtime to implement without silently reinterpreting,
// but never the implementation itself. Full design rationale, output-
// contract evaluation, and evaluation results:
// .juntia/migration/phases/07-engineering-qa.md
//
// ARCHITECTURAL BOUNDARY (deliberate, per that phase's brief): this module
// decides WHAT EXACTLY needs to change and HOW WE'LL VALIDATE IT. It does
// not write code, choose file paths that weren't supplied as evidence,
// execute anything, install dependencies, run tests, or open PRs. Those
// belong to an AI runtime (outside Juntia) or a human.
//
// Consumes Phase 05's and Phase 06's output shapes directly (`productResult`,
// `architectureResult`) — this module does NOT call classifyIntent(),
// analyzeProduct(), or analyzeArchitecture() itself, and deliberately does
// NOT take raw request text as an input at all (see phase doc §"Does
// Engineering need the original text?" for why: unlike Phases 04-06, this
// module performs no new detection over free text — every field it produces
// is either a direct citation of an upstream field or a small deterministic
// rule over upstream's own already-extracted facts).
//
// Deliberately NOT exposed via the CLI or a Claude Code skill in this phase
// — same reasoning as Phases 04-06 (no evidenced demand yet).

// Intents for which "engineering work" (a change to the system) is even a
// coherent question. UNDERSTAND/EXPLORE/VALIDATION ask/check, they don't
// change anything. AMBIGUOUS has no clarified intent yet — Phase 04/05
// already own asking about that. ARCHITECTURE is deliberately excluded too:
// Phase 04's own WORKFLOW_MAP already treats ARCHITECTURE as a terminal
// workflow (['architecture-analysis'], never chained to implementation) —
// a recommendation is not a decision (Phase 06 §2), and this module must
// not treat "architecture reasoning ran" as authorization to build. Once a
// human turns a recommendation into a decision, the *resulting* request is
// re-submitted as NEW_FEATURE/EVOLUTION/etc., which this module does handle.
const ENGINEERING_APPLICABLE_INTENTS = ['BUG', 'MAINTENANCE', 'REFACTOR', 'NEW_FEATURE', 'EVOLUTION'];

// Base effort tier per intent, before accounting for architecture impact.
// Mirrors GUIDELINES.md's existing tiny/normal/deep/architect vocabulary
// rather than inventing a new scale.
const BASE_TIER_BY_INTENT = {
  MAINTENANCE: 'tiny',
  BUG: 'tiny',
  REFACTOR: 'normal',
  NEW_FEATURE: 'normal',
  EVOLUTION: 'normal',
};

// Architecture impact level's own tier floor — aligned with Phase 06's own
// CONTEXT_NEEDS_BY_IMPACT alignment (low~normal, moderate~deep, high~architect,
// the same threshold that already triggers ctk-architecture-review today).
const TIER_FLOOR_BY_IMPACT = {
  none: 'tiny',
  low: 'normal',
  moderate: 'deep',
  high: 'architect',
};

const TIER_ORDER = ['tiny', 'normal', 'deep', 'architect'];

function higherTier(a, b) {
  return TIER_ORDER[Math.max(TIER_ORDER.indexOf(a), TIER_ORDER.indexOf(b))];
}

function emptyResult(reason) {
  return {
    applicable: false,
    reason,
    status: null,
    effortTier: null,
    humanAction: null,
    objective: null,
    scope: [],
    nonGoals: [],
    affectedAreas: [],
    filesLikelyAffected: [],
    implementationSteps: [],
    validationStrategy: [],
    testStrategy: null,
    risks: [],
    constraints: [],
    decisionsRequired: [],
    unknowns: [],
    questions: [],
    traceability: null,
  };
}

// Deduplicate propagated unknowns/decisions by topic, tagging where each
// one came from — never re-deriving or re-wording them.
function propagate(list, origin) {
  return (list || []).map((item) => ({ ...item, origin }));
}

function dedupeByTopic(items) {
  const seen = new Map();
  for (const item of items) {
    if (!seen.has(item.topic)) seen.set(item.topic, item);
  }
  return Array.from(seen.values());
}

const GENERIC_OBJECTIVE_BY_INTENT = {
  BUG: 'Investigar la causa de la desviación reportada y corregirla.',
  MAINTENANCE: 'Realizar el cambio mecánico/de mantenimiento solicitado.',
  REFACTOR: 'Reestructurar el código indicado sin cambiar el comportamiento observable.',
  NEW_FEATURE: 'Construir la capacidad solicitada.',
  EVOLUTION: 'Modificar el comportamiento existente según lo solicitado.',
};

function buildObjective(productResult, architectureResult) {
  const parts = [];
  const basis = [];
  if (productResult.desiredBehavior && productResult.desiredBehavior.length) {
    parts.push(productResult.desiredBehavior.map((b) => b.value).join(' '));
    basis.push('productResult.desiredBehavior');
  }
  if (parts.length === 0) {
    parts.push(GENERIC_OBJECTIVE_BY_INTENT[productResult.intent] || 'Realizar el cambio solicitado.');
    basis.push(`generic objective for intent ${productResult.intent}`);
  }
  if (architectureResult.recommendations && architectureResult.recommendations.length) {
    parts.push('Arquitectónicamente: ' + architectureResult.recommendations.map((r) => r.value).join(' '));
    basis.push('architectureResult.recommendations');
  }
  return { value: parts.join(' '), basis };
}

function findFilesForCategory(category, known) {
  const components = (known && known.existingArchitecture && known.existingArchitecture.components) || [];
  const match = components.find((c) => (c.relevantTo || []).includes(category) && Array.isArray(c.files) && c.files.length);
  if (match) {
    return { category, value: match.files, status: 'KNOWN', basis: [`known.existingArchitecture: ${match.name}`] };
  }
  return {
    category,
    value: null,
    status: 'UNKNOWN',
    reason: `known.existingArchitecture no especifica archivos reales para "${category}" — requiere inspección del repositorio.`,
  };
}

function buildFilesLikelyAffected(categories, known) {
  return categories.map((category) => findFilesForCategory(category, known));
}

function buildImplementationSteps(tier, productResult, architectureResult) {
  if (tier === 'tiny') return [];
  const steps = [];
  for (const b of productResult.desiredBehavior || []) {
    steps.push({ value: `Implementar el comportamiento: ${b.value}`, basis: 'productResult.desiredBehavior' });
  }
  for (const r of architectureResult.recommendations || []) {
    steps.push({ value: `Aplicar la recomendación arquitectónica: ${r.value}`, basis: 'architectureResult.recommendations' });
  }
  steps.push({ value: 'Validar según la estrategia de validación.', basis: 'validationStrategy' });
  return steps;
}

function buildValidationStrategy(tier, productResult) {
  const criteria = productResult.acceptanceCriteria || [];
  if (criteria.length === 0) return [];
  if (tier === 'tiny') {
    return [{ criterion: 'objective', scenarios: ['Validar manualmente que el objetivo se cumple.'] }];
  }
  return criteria.map((c) => ({
    criterion: c.value,
    scenarios: [
      `Camino feliz: ${c.value}`,
      'Caso límite/negativo: la condición contraria no debe aplicar.',
    ],
  }));
}

function buildTestStrategy(tier, impactCategories) {
  const base = {
    tiny: { manual: true, unit: false, integration: false, e2e: false },
    normal: { manual: false, unit: true, integration: false, e2e: false },
    deep: { manual: false, unit: true, integration: true, e2e: false },
    architect: { manual: false, unit: true, integration: true, e2e: true },
  }[tier];
  const strategy = { ...base };
  let reason = `Nivel de esfuerzo ${tier}.`;
  if ((impactCategories || []).some((c) => c === 'security' || c === 'ownership') && !strategy.integration) {
    strategy.integration = true;
    reason += ' Se añade integration porque la petición toca security/ownership, independientemente del tier.';
  }
  return { ...strategy, reason };
}

function buildRegressionRisks(architectureResult, known) {
  const risks = [...(architectureResult.risks || [])];
  const components = (known && known.existingArchitecture && known.existingArchitecture.components) || [];
  for (const c of components) {
    if (c.testCoverage === 'none' || c.testCoverage === 'low') {
      risks.push({
        value: `"${c.name}" reporta testCoverage: ${c.testCoverage} — una regresión en este componente no se detectaría automáticamente.`,
        category: 'regression',
        basis: [`known.existingArchitecture: ${c.name}`],
      });
    }
  }
  return risks;
}

// analyzeEngineering(productResult, architectureResult, known) -> structured
// Engineering Unit. `productResult` is Phase 05's analyzeProduct() output.
// `architectureResult` is Phase 06's analyzeArchitecture() output (called
// with the same productResult). `known` is optional, same shape Phases
// 05-06 already established, plus: existingArchitecture.components[].files
// (string[], optional) and .testCoverage ('none'|'low'|'ok', optional).
function analyzeEngineering(productResult, architectureResult, known = {}) {
  if (!productResult || !architectureResult) {
    return emptyResult('Falta productResult o architectureResult — no hay nada que razonar todavía.');
  }

  const intent = productResult.intent;
  if (!ENGINEERING_APPLICABLE_INTENTS.includes(intent)) {
    const reason = intent === 'ARCHITECTURE'
      ? 'Una recomendación de arquitectura no autoriza trabajo de ingeniería por sí sola — requiere que un humano la convierta en una decisión primero (ver Phase 06 §2, recommendation vs decision).'
      : `El intent "${intent}" no implica un cambio al sistema (no hay nada que construir/corregir) — no aplica razonamiento de ingeniería.`;
    return emptyResult(reason);
  }

  const productUnknowns = propagate(productResult.unknowns, 'product');
  const architectureUnknowns = propagate(architectureResult.unknowns, 'architecture');
  const unknowns = dedupeByTopic([...productUnknowns, ...architectureUnknowns]);
  const decisionsRequired = dedupeByTopic([
    ...propagate(productResult.decisionsRequired, 'product'),
    ...propagate(architectureResult.decisionsRequired, 'architecture'),
  ]);
  const blocking = unknowns.filter((u) => u.blocking);
  const questions = [...(productResult.questions || []), ...(architectureResult.questions || [])];

  const tier = higherTier(
    BASE_TIER_BY_INTENT[intent] || 'normal',
    TIER_FLOOR_BY_IMPACT[architectureResult.impactLevel] || 'tiny',
  );

  const traceability = {
    intent,
    productLevel: productResult.level,
    architectureImpactLevel: architectureResult.impactLevel,
  };

  if (blocking.length > 0) {
    return {
      applicable: true,
      reason: 'Aplica, pero hay decisiones bloqueantes sin resolver — no se genera un plan de implementación.',
      status: 'BLOCKED',
      effortTier: tier,
      humanAction: 'BLOCK',
      objective: null,
      scope: [],
      nonGoals: productResult.nonGoals || [],
      affectedAreas: architectureResult.impactCategories || [],
      filesLikelyAffected: [],
      implementationSteps: [],
      validationStrategy: [],
      testStrategy: null,
      risks: [],
      constraints: [
        ...(productResult.constraints || []),
        ...(architectureResult.constraints || []),
      ],
      decisionsRequired,
      unknowns,
      questions,
      traceability,
    };
  }

  const objective = buildObjective(productResult, architectureResult);
  const scope = tier === 'tiny' ? [] : [
    ...(productResult.acceptanceCriteria || []).map((c) => c.value),
    ...(architectureResult.impactCategories || []),
  ];
  const affectedAreas = architectureResult.impactCategories || [];
  const filesLikelyAffected = buildFilesLikelyAffected(affectedAreas, known);
  const implementationSteps = buildImplementationSteps(tier, productResult, architectureResult);
  const validationStrategy = buildValidationStrategy(tier, productResult);
  const testStrategy = buildTestStrategy(tier, affectedAreas);
  const risks = buildRegressionRisks(architectureResult, known);
  const constraints = [
    ...(productResult.constraints || []),
    ...(architectureResult.constraints || []),
  ];

  const humanAction = (tier === 'deep' || tier === 'architect') ? 'CONFIRM' : 'AUTO';

  return {
    applicable: true,
    reason: `Intent "${intent}" implica un cambio al sistema; sin decisiones bloqueantes pendientes.`,
    status: 'READY',
    effortTier: tier,
    humanAction,
    objective,
    scope,
    nonGoals: productResult.nonGoals || [],
    affectedAreas,
    filesLikelyAffected,
    implementationSteps,
    validationStrategy,
    testStrategy,
    risks,
    constraints,
    decisionsRequired,
    unknowns,
    questions,
    traceability,
  };
}

module.exports = {
  ENGINEERING_APPLICABLE_INTENTS,
  BASE_TIER_BY_INTENT,
  TIER_FLOOR_BY_IMPACT,
  analyzeEngineering,
};
