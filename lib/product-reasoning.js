'use strict';

// Product Reasoning — Phase 05 of the Juntia migration.
//
// Turns a developer's free-text request into an explicit, provenance-tagged
// account of what's known, inferred, unknown, and decided — proportional to
// the request's own intent (consumed from `lib/intent-router.js`, not
// duplicated). Full design rationale, output-contract evaluation, and
// evaluation results: .juntia/migration/phases/05-product.md
//
// ARCHITECTURAL BOUNDARY (deliberate, per that phase's brief): this module
// decides WHAT SHOULD BE BUILT AND WHY. It does not decide how to implement
// it, what framework/components/files to use, what model or runtime to run,
// or how to do technical QA. Those belong to later phases (06 Architecture,
// 07 Engineering/QA).
//
// FIRST PRINCIPLE: never silently promote an inference to a fact. Every
// populated field carries a `status` of 'KNOWN' (literally stated in the
// request or in the caller-supplied `known` facts) or 'INFERRED' (derived,
// with the reasoning named) — nothing is invented outright. Deliberately
// does NOT attempt free-text problem/goal synthesis (see phase doc §6 for
// why rules stop there and what that implies about needing an LLM later).
//
// Deliberately NOT exposed via the CLI or a Claude Code skill in this phase
// — same reasoning as Phase 04 (no evidenced demand yet).
//
// Phase 15C note (documentation only — no logic in this file changed):
// classified Legacy Reasoning Layer since Phase 15A. Phase 15C's own
// Workflow Routing Engine (`lib/governance/`) deliberately does not attempt
// this module's job — free-text product-intent reasoning (what should be
// built, why, what's unknown) stays the external agent's responsibility,
// guided by the real `templates/governance/roles/product.md` and
// `skills/feature-planning/SKILL.md` this module's own logic helped ground
// (Phase 15B §3). Untouched, unremoved, unwired. See
// phases/15c-workflow-routing.md.

const { classifyIntent } = require('./intent-router.js');

// Proportional reasoning level per intent (brief's own guidance, §"Relationship
// with Intent Router"). ARCHITECTURE is explicitly excluded — that's Phase
// 06's remit, not this phase's, per the brief's explicit boundary.
const BASE_LEVEL_BY_INTENT = {
  UNDERSTAND: 'none',
  VALIDATION: 'none',
  MAINTENANCE: 'none',
  REFACTOR: 'none',
  ARCHITECTURE: 'none',
  BUG: 'none', // upgraded to 'light' conditionally — see analyzeProduct()
  EXPLORE: 'light',
  NEW_FEATURE: 'full',
  EVOLUTION: 'full',
  AMBIGUOUS: 'none', // can't reason about product before intent itself clarifies
};

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Structural cue: a domain category/segment named as the subject of the
// request, with no defining criteria anywhere in the same text. Kept to a
// short, explicit list rather than generic NER — see phase doc §6 for why
// this is deliberately narrow (a broader heuristic would false-positive on
// ordinary nouns).
const NAMED_CATEGORY_TERMS = [
  { term: 'vip', label: 'VIP' },
  { term: 'premium', label: 'premium' },
  { term: 'fidelizacion', label: 'programa de fidelización' },
  { term: 'recurrentes', label: 'clientes recurrentes' },
  { term: 'frecuentes', label: 'clientes frecuentes' },
];

// Phrases that indicate the referenced category already has criteria stated
// nearby — presence of any of these near the term means "defined," not
// "unknown."
const DEFINITION_MARKERS = /\b(con mas de|que cumplan|definid\w+ como|criterios?|con al menos|que tengan|mas de \d+)\b/;

const HEDGING_LANGUAGE = /\b(creo que deberiamos|seria bueno|estaria bien|tal vez deberiamos|podriamos considerar|quiza deberiamos)\b/;

// A concrete, observable behavior verb — presence signals the request states
// *some* specific desired behavior, even if surrounding specifics are thin.
const CONCRETE_BEHAVIOR_VERB = /\b(permit\w*|cancel\w*|comparti\w*|acept\w*|envia\w*|mostrar\w*|calcul\w*|aplicar\w*|descuento|notificacion\w*)\b/;

const PERCENTAGE_PATTERN = /\b(\d{1,3})\s?%/;

function extractDesiredBehavior(normalizedText, originalText, intent) {
  const behaviors = [];
  const pct = originalText.match(PERCENTAGE_PATTERN);
  if (pct) {
    behaviors.push({ value: `Aplicar un valor de ${pct[0]} tal como se indica en la petición.`, status: 'KNOWN' });
  }
  if (CONCRETE_BEHAVIOR_VERB.test(normalizedText)) {
    behaviors.push({ value: 'La petición nombra un comportamiento concreto (ver texto original), aunque puede necesitar más detalle.', status: 'KNOWN' });
  }
  // Fallback: NEW_FEATURE/EVOLUTION intent alone implies *some* behavior
  // change is wanted, even when none of the concrete-verb patterns above
  // caught it (e.g. "cambiar cómo funcionan los clientes VIP" — a real gap
  // this fallback closes honestly: tagged INFERRED, not KNOWN, and explicit
  // that no detail could be extracted, rather than inventing specifics.
  if (behaviors.length === 0 && (intent === 'NEW_FEATURE' || intent === 'EVOLUTION')) {
    behaviors.push({
      value: 'La petición implica un cambio de comportamiento (según el intent clasificado) pero el texto no permite extraer el detalle específico todavía.',
      status: 'INFERRED',
    });
  }
  return behaviors;
}

// Checks whether `known.decisions` already resolves a named-category
// unknown, per the brief's explicit "consult before asking" requirement —
// consulted, never invented.
function findKnownDecisionFor(term, known) {
  const decisions = (known && known.decisions) || [];
  return decisions.find((d) => normalize(d.topic || '').includes(term));
}

function detectUnknowns(normalizedText, originalText, known) {
  const unknowns = [];

  for (const { term, label } of NAMED_CATEGORY_TERMS) {
    if (!normalizedText.includes(term)) continue;
    const existing = findKnownDecisionFor(term, known);
    if (existing) continue; // resolved by a known decision — not an unknown
    const nearbyDefined = DEFINITION_MARKERS.test(normalizedText);
    if (nearbyDefined) continue; // criteria stated in the same text
    unknowns.push({
      topic: `Definición de "${label}"`,
      blocking: true,
      reason: `"${label}" se menciona como el sujeto de la petición pero no se establecen criterios que lo definan, ni existe una decisión previa conocida.`,
    });
  }

  const isHedged = HEDGING_LANGUAGE.test(normalizedText);
  const hasConcreteBehavior = CONCRETE_BEHAVIOR_VERB.test(normalizedText) || PERCENTAGE_PATTERN.test(originalText);
  if (isHedged && !hasConcreteBehavior) {
    unknowns.push({
      topic: 'Comportamiento deseado no especificado',
      blocking: true,
      reason: 'La petición expresa una idea en tono tentativo ("creo que deberíamos", "sería bueno") sin describir ningún comportamiento observable concreto todavía.',
    });
  }

  return unknowns;
}

function knownDecisionsConsulted(normalizedText, known) {
  const decisions = (known && known.decisions) || [];
  const cited = [];
  for (const { term, label } of NAMED_CATEGORY_TERMS) {
    if (!normalizedText.includes(term)) continue;
    const found = findKnownDecisionFor(term, known);
    if (found) cited.push({ topic: label, decision: found.decision, source: found.source || 'existing' });
  }
  return cited.length ? cited : decisions.map((d) => ({ topic: d.topic, decision: d.decision, source: d.source || 'existing' })).filter(() => false);
}

function buildQuestions(unknowns) {
  return unknowns
    .filter((u) => u.blocking)
    .map((u) => `${u.topic}: ${u.reason} ¿Puedes precisarlo antes de continuar?`);
}

// Assembled only from already-known/decided fragments — never free-text
// synthesized. Deliberately thin: see phase doc §6 for why this stops short
// of generating full acceptance-criteria prose from scratch.
function assembleAcceptanceCriteria(desiredBehavior, knownDecisions) {
  if (desiredBehavior.length === 0) return [];
  return desiredBehavior.map((b) => ({
    value: knownDecisions.length
      ? `${b.value} (según: ${knownDecisions.map((d) => d.decision).join('; ')})`
      : b.value,
    basis: knownDecisions.length ? 'desiredBehavior + knownDecisions' : 'desiredBehavior only',
  }));
}

// analyzeProduct(text, intentResult, known) -> structured result.
// `intentResult` is the Phase 04 `classifyIntent()` output — this module
// consumes it, never re-derives intent itself (per the brief's explicit
// "no dupliques el Intent Router").
// `known` is optional, caller-supplied, never fetched/loaded by this module:
// { decisions: [{ topic, decision, source }], constraints: [{ topic, constraint }] }
function analyzeProduct(text, intentResult, known = {}) {
  const normalizedText = normalize(text || '');
  const intent = intentResult ? intentResult.intent : 'AMBIGUOUS';
  const isHedged = HEDGING_LANGUAGE.test(normalizedText);
  const hasConcreteBehavior = CONCRETE_BEHAVIOR_VERB.test(normalizedText) || PERCENTAGE_PATTERN.test(text || '');

  let level = BASE_LEVEL_BY_INTENT[intent] ?? 'none';
  let levelReason = `Nivel base para el intent ${intent}.`;

  // An AMBIGUOUS intent whose text nonetheless reads as a tentatively-framed
  // idea (hedging language, e.g. "creo que deberíamos...") is treated as an
  // exploratory idea for product-reasoning purposes, even though Phase 04
  // correctly couldn't assign one of its 9 formal intents to it — this is
  // Product Reasoning's own, separate judgment about applicability, not a
  // redefinition of intent. Real dataset case that surfaced this gap: "Creo
  // que deberíamos tener un programa de fidelización" scores no Phase 04
  // rule at all (AMBIGUOUS, no signal) — without this refinement Product
  // Reasoning would silently do nothing for a request that clearly needs
  // problem-framing (see phase doc §7 for the full honest account).
  if (intent === 'AMBIGUOUS' && isHedged) {
    level = 'light';
    levelReason = 'Intent AMBIGUOUS (sin señal para el Intent Router) pero el texto tiene forma de idea exploratoria (lenguaje tentativo) — tratado como light por Product Reasoning, no por el router.';
  }

  const unknowns = level === 'none' && intent !== 'BUG' ? [] : detectUnknowns(normalizedText, text, known);

  // BUG: escalate 'none' -> 'light' only when a functional/definitional
  // unknown surfaces (the brief's own "salvo impacto funcional" carve-out) —
  // otherwise stays 'none' (an ordinary technical bug needs no product
  // reasoning at all).
  if (intent === 'BUG') {
    if (unknowns.some((u) => u.blocking)) {
      level = 'light';
      levelReason = 'BUG con posible impacto funcional/de definición de producto (criterio ambiguo detectado) — elevado a light.';
    } else {
      levelReason = 'BUG sin ambigüedad de definición detectada — no requiere Product Reasoning.';
    }
  }

  // EXPLORE / NEW_FEATURE / EVOLUTION: an extremely vague, hedged request
  // with no concrete behavior at all is capped at 'light' regardless of
  // intent — there isn't enough content yet for a full analysis, only for
  // framing the problem (this is an evidence-based refinement tested in
  // the experiment, not assumed — see phase doc §7).
  if (level === 'full' && isHedged && !hasConcreteBehavior) {
    level = 'light';
    levelReason = 'Petición en tono tentativo sin comportamiento concreto todavía — capada a light aunque el intent sugiera full.';
  }

  if (level === 'none' && intent !== 'BUG') {
    return {
      intent,
      level,
      levelReason,
      problem: null,
      goal: null,
      actors: [],
      desiredBehavior: [],
      constraints: [],
      knownDecisions: [],
      unknowns: [],
      decisionsRequired: [],
      acceptanceCriteria: [],
      nonGoals: [],
      questions: [],
    };
  }

  const desiredBehavior = level === 'none' ? [] : extractDesiredBehavior(normalizedText, text, intent);
  const knownDecisions = knownDecisionsConsulted(normalizedText, known);
  const constraints = ((known && known.constraints) || []).map((c) => ({ value: c.constraint, source: c.topic || 'known' }));
  const decisionsRequired = unknowns.filter((u) => u.blocking).map((u) => ({ topic: u.topic, question: `${u.topic}: ${u.reason}` }));
  const questions = buildQuestions(unknowns);
  const acceptanceCriteria = level === 'full' ? assembleAcceptanceCriteria(desiredBehavior, knownDecisions) : [];

  return {
    intent,
    level,
    levelReason,
    problem: null, // deliberately not free-text synthesized — see phase doc §6
    goal: null, // deliberately not free-text synthesized — see phase doc §6
    actors: [],
    desiredBehavior,
    constraints,
    knownDecisions,
    unknowns,
    decisionsRequired,
    acceptanceCriteria,
    nonGoals: [],
    questions,
  };
}

// Context-loading recommendation for Product Reasoning specifically —
// refines Phase 04's generic NEW_FEATURE/EVOLUTION/EXPLORE CONTEXT_MAP rows
// for this consumer only: Decisions goes from 'optional' to 'relevant'
// because this module specifically needs to *consult* existing decisions
// before asking (the brief's own worked NEW_FEATURE/EVOLUTION/EXPLORE
// example table). Still a recommendation only — nothing is loaded here.
const CONTEXT_NEEDS = {
  full: { product: 'relevant', state: 'relevant', decisions: 'relevant', constraints: 'relevant' },
  light: { product: 'minimal', state: 'optional', decisions: 'relevant', constraints: 'minimal' },
  none: {},
};

module.exports = {
  BASE_LEVEL_BY_INTENT,
  CONTEXT_NEEDS,
  analyzeProduct,
  normalize, // exported for tests only
};
