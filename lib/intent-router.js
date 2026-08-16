'use strict';

// Intent Router — Phase 04 of the Juntia migration.
//
// Classifies a free-text developer request into one of Juntia's core
// intents using explainable rules (keyword/phrase cues + a simple scoring
// margin), with zero AI calls and zero runtime dependencies. Full design
// rationale, taxonomy definitions, and evaluation results:
// .juntia/migration/phases/04-intent-router.md
//
// ARCHITECTURAL BOUNDARY (deliberate, per that phase's brief): this module
// decides WHAT KIND of work a request is. It does not implement the work,
// call a model, write code, perform product/architecture reasoning, run QA,
// select a runtime/provider, or orchestrate agents. Those belong to later
// phases (05 Product, 06 Architecture, 07 Engineering/QA, 11 Runtime).
//
// Deliberately NOT exposed via the CLI or a Claude Code skill in this phase
// — see the phase doc §5 for why (no evidenced need yet to expose it
// publicly; keeping it an internal, runtime-independent library is itself
// the point being validated).
//
// Phase 15C note (documentation only — no logic in this file changed):
// classified Legacy Reasoning Layer since Phase 15A, confirmed still legacy
// by Phase 15B. Phase 15C built the real, CLI-exposed replacement for this
// module's free-text classification responsibility —
// `lib/governance/intent-model.js` (four work-shaped intents, numeric
// confidence) feeding `lib/governance/workflow-router.js` (`juntia route`)
// — rather than extending this module's nine-intent taxonomy. This file is
// untouched, unremoved, and still unwired to anything, per Phase 15A/15B's
// own explicit "no eliminarlas todavía." `WORKFLOW_MAP` above remains real,
// tested, disconnected data — a candidate for a future phase to retire once
// the new router has real dogfooding evidence behind it, not before. See
// phases/15c-workflow-routing.md.

const INTENTS = [
  'UNDERSTAND', 'EXPLORE', 'NEW_FEATURE', 'EVOLUTION', 'BUG',
  'REFACTOR', 'MAINTENANCE', 'ARCHITECTURE', 'VALIDATION',
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip accents (á->a, ñ->n, etc.)
}

// Each rule fires independently; a request can match several. Weight is a
// small, hand-assigned integer reflecting how distinctive the cue is on its
// own — not a trained/tuned probability (see phase doc §6 for why this
// stays qualitative, not ML).
// Patterns use word-stem matching (`\w*` after a stem) wherever Spanish
// conjugation varies (añadir/añade/añadamos, permitir/permiten/permitan,
// etc.) rather than one fixed word form — see phase doc §7 for the honest
// account of the first evaluation run, which failed exactly the dataset
// items these stems now cover (e.g. "reciben" vs a rule that only matched
// "recibe").
const RULES = [
  // Broad negation-of-action is the single most reliable BUG signal in
  // Spanish ("no funciona", "no reciben", "no se están enviando") — a
  // generic "no (se)? <stem>" catches far more real phrasing than a list of
  // fixed phrases would.
  { intent: 'BUG', weight: 3, cue: 'deviation/failure language', pattern:
    /\bno (se )?(esta\w*|recib\w*|guard\w*|envia\w*|funcion\w*|aplic\w*)\b|\bno deberia\b|\bdejan? de funcionar\b|\bse rompe\b|\brompe\b|\bdesaparece\w*\b|\bfalla\w*\b|\berror\b|\bbug\b|\bincorrect\w*\b|\bmal calcul\w*\b|\bcalcul\w* mal\b|\bexcepcion\b|\bcrash\b/ },

  { intent: 'REFACTOR', weight: 3, cue: 'structure-only / code-shape language', pattern:
    /\brefactor\w*\b|\breorganizar\b|\breestructurar\b|\bextraer\b|\brenombrar\b|\blimpiar el codigo\b|\bmover\b.*\bmodulo\b|\bseparar en modulos\b|\bsin cambiar el comportamiento\b/ },

  { intent: 'MAINTENANCE', weight: 3, cue: 'small mechanical/tooling language', pattern:
    /\bactualiza\w* la dependencia\b|\bactualizar dependencias\b|\bbump\b|\btypo\b|\barregla\w* el (lint|warning)\b|\bactualiza\w* el changelog\b|\bactualiza\w* la version\b|\bhousekeeping\b|\bajuste menor\b/ },

  { intent: 'VALIDATION', weight: 3, cue: 'explicit checking/verification language', pattern:
    /\bverifica\w* que\b|\bcomprueba\w* que\b|\bvalida\w* que\b|\brevisa\w* el pr\b|\brevisa\w* los cambios\b|\btestear\b|\bhaz(?: el)? qa\b|\bhacer qa\b|\bconfirma\w* que funciona\b/ },

  { intent: 'ARCHITECTURE', weight: 3, cue: 'foundational/system-design language', pattern:
    /\bdeberiamos migrar\b|\breemplazar el mecanismo\b|\barquitectura\b|\bdiseno del sistema\b|\bescalabilidad\b|\belegir entre\b|\bque base de datos\b|\bmulti-tenant\b|\bmultiples inquilinos\b|\bmicroservicios\b|\bframework a usar\b|\bcomo deberiamos estructurar\b/ },

  { intent: 'UNDERSTAND', weight: 3, cue: 'comprehension-question language', pattern:
    /\bque hace\b|\bcomo funciona\b|\bexplica\w*\b|\bno entiendo como\b|\bentender como\b|\bpor que (funciona|esta|se comporta)\b|\bque es exactamente\b/ },

  { intent: 'EXPLORE', weight: 2, cue: 'open-ended exploration language', pattern:
    /\bdeberiamos considerar\b|\bque opciones (tenemos|hay)\b|\bque pasaria si\b|\bcomparar enfoques\b|\bvale la pena evaluar\b|\bantes de decidir nada\b/ },

  { intent: 'EVOLUTION', weight: 2, cue: 'existing-behavior-change language', pattern:
    /\bcambiar como funciona\w*\b|\bmodificar el comportamiento\b|\bque tambien pueda\w*\b|\bpermit\w*\b|\bampliar\b|\bextender\b|\bactualizar la logica de\b|\bademas del?\b|\btambien\b/ },

  { intent: 'NEW_FEATURE', weight: 2, cue: 'creation language', pattern:
    /\banad\w*\b|\bagreg\w*\b|\bcrear (un|una|el|la)\b|\bimplementar\b|\bnueva funcionalidad\b|\bnueva caracteristica\b|\bconstruir (un|una)\b/ },
];

function labelFor(intent) {
  return intent;
}

function describeMatches(matches) {
  if (matches.length === 0) return 'No rule matched.';
  return matches.map((m) => `${m.intent} <- ${m.cue}`).join('; ');
}

const CONTEXT_CATEGORIES = [
  'product', 'project', 'architecture', 'state',
  'decisions', 'constraints', 'unknowns', 'task',
];

// Recommendation only — per the phase brief, the router must NOT load any
// of this. It names which of Phase 02's 8 categories are minimal / relevant
// / optional / prohibited for a given intent; loading is a future phase's
// job (the intent router only produces the recommendation, deliberately
// separating "what context I need" from "how it gets loaded").
const CONTEXT_MAP = {
  UNDERSTAND: { product: 'optional', project: 'minimal', architecture: 'optional', state: 'optional', decisions: 'optional', constraints: 'prohibited', unknowns: 'optional', task: 'minimal' },
  EXPLORE: { product: 'minimal', project: 'optional', architecture: 'relevant', state: 'optional', decisions: 'optional', constraints: 'minimal', unknowns: 'relevant', task: 'minimal' },
  NEW_FEATURE: { product: 'relevant', project: 'minimal', architecture: 'optional', state: 'relevant', decisions: 'optional', constraints: 'relevant', unknowns: 'optional', task: 'minimal' },
  EVOLUTION: { product: 'optional', project: 'minimal', architecture: 'optional', state: 'minimal', decisions: 'relevant', constraints: 'relevant', unknowns: 'optional', task: 'minimal' },
  BUG: { product: 'prohibited', project: 'minimal', architecture: 'relevant', state: 'minimal', decisions: 'relevant', constraints: 'optional', unknowns: 'optional', task: 'minimal' },
  REFACTOR: { product: 'prohibited', project: 'minimal', architecture: 'relevant', state: 'optional', decisions: 'relevant', constraints: 'optional', unknowns: 'optional', task: 'minimal' },
  MAINTENANCE: { product: 'prohibited', project: 'minimal', architecture: 'prohibited', state: 'optional', decisions: 'prohibited', constraints: 'prohibited', unknowns: 'prohibited', task: 'minimal' },
  ARCHITECTURE: { product: 'optional', project: 'relevant', architecture: 'relevant', state: 'optional', decisions: 'relevant', constraints: 'relevant', unknowns: 'relevant', task: 'minimal' },
  VALIDATION: { product: 'prohibited', project: 'minimal', architecture: 'prohibited', state: 'minimal', decisions: 'relevant', constraints: 'relevant', unknowns: 'optional', task: 'minimal' },
};

// Conceptual pipeline names only — naming which stages apply, not
// implementing any of them. Product/Architecture/Engineering-QA stages are
// Phases 05/06/07's responsibility once they exist.
const WORKFLOW_MAP = {
  UNDERSTAND: ['explain'],
  EXPLORE: ['explore-options'],
  NEW_FEATURE: ['product', 'architecture-if-needed', 'implementation', 'validation'],
  EVOLUTION: ['impact', 'implementation', 'validation'],
  BUG: ['investigate', 'fix', 'validation'],
  REFACTOR: ['impact', 'implementation', 'regression-validation'],
  MAINTENANCE: ['implementation', 'narrow-validation'],
  ARCHITECTURE: ['architecture-analysis'],
  VALIDATION: ['validation'],
};

// Used only by the ambiguity-resolution policy below, not exposed as a
// separate "risk assessment" feature — see phase doc §3 for the taxonomy's
// full risk/reversibility definitions.
const RISK = {
  UNDERSTAND: 'none', EXPLORE: 'none', VALIDATION: 'low', MAINTENANCE: 'low',
  BUG: 'medium', EVOLUTION: 'medium', NEW_FEATURE: 'medium',
  REFACTOR: 'medium', ARCHITECTURE: 'high',
};

function isLowOrNoneRisk(intent) {
  return RISK[intent] === 'none' || RISK[intent] === 'low';
}

function buildAmbiguousResult({ reason, candidates }) {
  const questions = candidates
    ? [`No tengo suficiente confianza para elegir entre ${candidates[0]} y ${candidates[1]} — ¿cuál de las dos describe mejor lo que necesitas?`]
    : ['No reconozco suficiente señal en esta petición. ¿Puedes describir qué debería cambiar, o si es solo una pregunta sobre el sistema actual?'];
  return {
    intent: 'AMBIGUOUS',
    confidence: 'low',
    reason,
    alternateIntent: candidates ? candidates[1] : null,
    contextRequirements: null,
    workflow: null,
    action: 'ask',
    questions,
  };
}

function buildResult({ intent, confidence, reason, alternateIntent = null }) {
  const contextRequirements = CONTEXT_MAP[intent];
  const workflow = WORKFLOW_MAP[intent];

  // Ambiguity-resolution policy: only interrupt with a question when the
  // uncertainty would materially change the workflow. A medium-confidence
  // guess whose alternate reading leads to the same workflow, or where both
  // readings are low/no risk, is not worth asking about — proportional to
  // the contract's Second principle ("no preguntes si la incertidumbre no
  // cambia materialmente el workflow").
  let action = 'auto';
  let questions = [];
  if (confidence === 'medium' && alternateIntent) {
    const sameWorkflow = JSON.stringify(WORKFLOW_MAP[alternateIntent]) === JSON.stringify(workflow);
    const materiallyRisky = !isLowOrNoneRisk(intent) || !isLowOrNoneRisk(alternateIntent);
    if (!sameWorkflow && materiallyRisky) {
      action = 'confirm';
      questions = [`Interpreto esto como ${labelFor(intent)}. ¿Es correcto, o te refieres más bien a ${labelFor(alternateIntent)}?`];
    }
  }

  return { intent, confidence, reason, alternateIntent, contextRequirements, workflow, action, questions };
}

// classifyIntent(text) -> structured result, see phase doc §4 (Output
// contract) for the full field-by-field rationale.
function classifyIntent(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return buildAmbiguousResult({ reason: 'Empty request text.', candidates: null });
  }

  const normalized = normalize(text);
  const matches = RULES.filter((r) => r.pattern.test(normalized));
  const scores = {};
  for (const m of matches) scores[m.intent] = (scores[m.intent] || 0) + m.weight;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return buildAmbiguousResult({ reason: 'No recognizable intent signal in the request text.', candidates: null });
  }

  const [topIntent, topScore] = ranked[0];

  // BUG's deviation language is treated as an unconditionally dominant
  // signal: whenever it's present, classify BUG at high confidence
  // regardless of whether another, weaker cue also fired in the same
  // sentence (e.g. "los clientes VIP no reciben el descuento que deberiamos
  // anadir" — deviation language wins even though a creation cue is also
  // present) and regardless of whether BUG already happened to be the
  // top-scored candidate. This is a deliberate, documented exception to the
  // margin-based logic below, not an accident of scoring order — see phase
  // doc §"Critical distinction."
  if (scores.BUG) {
    return buildResult({
      intent: 'BUG',
      confidence: 'high',
      reason: matches.length > matches.filter((m) => m.intent === 'BUG').length
        ? `Deviation/failure language present (score ${scores.BUG}) alongside other cues (${describeMatches(matches)}); BUG is treated as the dominant signal regardless of relative score.`
        : describeMatches(matches),
    });
  }

  if (ranked.length === 1) {
    return buildResult({
      intent: topIntent,
      confidence: topScore >= 3 ? 'high' : 'medium',
      reason: describeMatches(matches),
    });
  }

  const [secondIntent, secondScore] = ranked[1];
  const margin = topScore - secondScore;

  if (margin >= 2) {
    return buildResult({ intent: topIntent, confidence: 'high', reason: describeMatches(matches) });
  }
  if (margin === 1) {
    return buildResult({ intent: topIntent, confidence: 'medium', alternateIntent: secondIntent, reason: describeMatches(matches) });
  }
  // margin === 0: a genuine tie between the top two candidates.
  return buildAmbiguousResult({
    reason: `${topIntent} and ${secondIntent} cues present with equal strength (${describeMatches(matches)}).`,
    candidates: [topIntent, secondIntent],
  });
}

module.exports = {
  INTENTS,
  CONTEXT_CATEGORIES,
  CONTEXT_MAP,
  WORKFLOW_MAP,
  RISK,
  classifyIntent,
  normalize, // exported for tests only
};
