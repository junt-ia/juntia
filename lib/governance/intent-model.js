'use strict';

// Intent Model — Phase 15C of the Juntia migration.
//
// Classifies a free-text request into one of Juntia's four work-shaped
// intents (feature/bug/investigation/refactor) — or `unknown`, when there
// isn't enough signal to classify responsibly — using explainable keyword
// rules, zero AI calls, zero runtime dependencies. Full design rationale:
// phases/15c-workflow-routing.md.
//
// ARCHITECTURAL BOUNDARY (deliberate, per this phase's own brief): this
// module decides WHAT KIND of work a request is — never what the request
// should build, how to build it, or what files/components are involved.
// That reasoning belongs entirely to whatever external agent (Claude Code,
// Codex, etc.) reads this classification's output. "Juntia classifies the
// request and determines the right process; it does not decide how the
// request gets solved."
//
// Deliberately NOT the same taxonomy the legacy `lib/intent-router.js` used
// (nine intents, string confidence; module deleted in the Governance Level
// Dynamic and Legacy Cleanup phase — see phases/governance-level-dynamic-
// and-legacy-cleanup.md). That module's own free-text detection half was
// documented, since Phase 15A, as duplicated reasoning an external agent
// already does natively — this module never extended it or reused its
// rules; it is a smaller, four-workflow-shaped classifier built to match the
// real Knowledge Layer workflow files Phase 15B shipped
// (`.juntia/governance/workflows/{feature-development,bug-fix,investigation,
// refactor}.md`), with a numeric [0,1] confidence instead of a string label.

const INTENTS = ['feature', 'bug', 'investigation', 'refactor'];

// Below this, a classification is not trustworthy enough to select a
// workflow on its own — the request comes back `unknown` and asks for
// clarification instead of guessing. Per this phase's own explicit
// requirement: "una petición ambigua nunca debe producir un workflow falso."
const CONFIDENCE_THRESHOLD = 0.6;

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip accents (á->a, ñ->n, etc.)
}

// BUG's deviation/failure language is the most reliable single-intent
// signal, and is treated as dominant below regardless of what else fires in
// the same sentence — the same real, corpus-evidenced pattern the (since
// deleted) `lib/intent-router.js`'s own BUG rule already established,
// reused here as grounding for a fresh rule, not copied code.
const RULES = [
  {
    intent: 'bug',
    weight: 3,
    cue: 'deviation/failure language',
    pattern: /\bno (se )?(esta\w*|recib\w*|guard\w*|envia\w*|funcion\w*|aplic\w*|carga\w*|muestr\w*)\b|\bno deberia\b|\bdejan? de funcionar\b|\bse rompe\b|\brompe\b|\bdesaparece\w*\b|\bfalla\w*\b|\berror\b|\bbug\b|\bincorrect\w*\b|\bmal calcul\w*\b|\bcalcul\w* mal\b|\bexcepcion\b|\bcrash\w*\b/,
  },
  {
    intent: 'refactor',
    weight: 3,
    cue: 'structure-only / code-shape language',
    pattern: /\brefactor\w*\b|\breorganiz\w*\b|\breestructur\w*\b|\bextrae\w*\b|\brenombr\w*\b|\blimpiar el codigo\b|\bmover\b.*\bmodulo\w*\b|\bseparar en modulos\b|\bsin cambiar el comportamiento\b/,
  },
  {
    intent: 'investigation',
    weight: 3,
    cue: 'analysis/exploration-question language',
    pattern: /\banaliz\w*\b|\binvestig\w*\b|\bevalu\w*\b|\bcomo funciona\w*\b|\bque opciones\b|\bque alternativas\b|\bentender como\b|\bexplica\w*\b|\bpor que (funciona|esta|se comporta)\b|\bvale la pena evaluar\b|\bdeberiamos considerar\b/,
  },
  {
    intent: 'feature',
    weight: 3,
    cue: 'creation/capability language',
    pattern: /\banad\w*\b|\bagreg\w*\b|\bcrea\w*\b|\bimplement\w*\b|\bincorpor\w*\b|\bconstrui\w*\b|\bnueva (funcionalidad|caracteristica|pantalla|mecanica|feature)\b|\bnuevo (sistema|modulo)\b/,
  },
];

function describeMatches(matches) {
  if (matches.length === 0) return 'No rule matched.';
  return matches.map((m) => `${m.intent} <- ${m.cue}`).join('; ');
}

function unknownResult(confidence, reason) {
  return { intent: 'unknown', confidence, needsClarification: true, reason };
}

// classifyTaskIntent(text) -> { intent, confidence, needsClarification, reason }
// `confidence` is always a number in [0, 1], rounded to 2 decimals — never a
// string label. `intent` is `unknown` whenever no rule fired, the top two
// candidates tie, or the computed confidence falls below
// CONFIDENCE_THRESHOLD; `unknown` never carries a guessed workflow anywhere
// downstream (see `workflow-router.js`).
function classifyTaskIntent(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return unknownResult(0, 'Empty request text.');
  }

  const normalized = normalize(text);
  const matches = RULES.filter((r) => r.pattern.test(normalized));

  if (matches.length === 0) {
    return unknownResult(0.2, 'No recognizable intent signal in the request text.');
  }

  const scores = {};
  for (const m of matches) scores[m.intent] = (scores[m.intent] || 0) + m.weight;

  // BUG dominance: an unconditional exception to the margin-based logic
  // below, matching the documented, evidence-based precedent this module's
  // own header cites.
  if (scores.bug) {
    return {
      intent: 'bug',
      confidence: 0.9,
      needsClarification: false,
      reason: describeMatches(matches),
    };
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = ranked[0];
  const second = ranked[1];

  let confidence;
  if (!second) {
    confidence = Math.min(0.95, 0.6 + topScore * 0.1);
  } else {
    const [, secondScore] = second;
    if (topScore === secondScore) {
      return unknownResult(0.5, `${topIntent} and ${second[0]} cues present with equal strength (${describeMatches(matches)}).`);
    }
    confidence = topScore / (topScore + secondScore);
  }

  confidence = Math.round(confidence * 100) / 100;
  const reason = describeMatches(matches);

  if (confidence < CONFIDENCE_THRESHOLD) {
    return unknownResult(confidence, `Low-confidence match (${reason}) — not enough signal to select a workflow responsibly.`);
  }

  return { intent: topIntent, confidence, needsClarification: false, reason };
}

module.exports = {
  INTENTS,
  CONFIDENCE_THRESHOLD,
  classifyTaskIntent,
  normalize, // exported for tests only
};
