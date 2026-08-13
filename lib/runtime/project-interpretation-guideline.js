'use strict';

// Project Interpretation Guideline — Phase 12J of the Juntia migration.
//
// The text actually sent to the runtime adapter for the SECOND
// interpretation domain this migration has built (the first was intent
// interpretation, Phase 11C). Reuses `lib/runtime/claude-cli-adapter.js`
// unmodified in behavior for existing callers (Phase 12J only added an
// optional systemPrompt/schema parameter, defaulting to
// reasoning-guideline.js's pair) — this file is the second guideline
// plugged into that same generalized adapter, not a new transport.
//
// Deliberately narrower than Phase 12H's conceptual example (which showed
// the runtime returning a "QUESTIONS" field): asking a human is a
// governance decision (Phase 11B/11C's own conclusion, reused here without
// re-litigating it), so this guideline never asks the runtime for a
// question — only for an interpretation, a confidence, and the facts it
// used. See phases/12j-context-synthesis-runtime-evaluation.md's
// "Decisiones descartadas" for why this deviates from the brief's own
// illustrative example.

const SYSTEM_PROMPT = [
  'You are an interpretation-only reasoning step for a project intelligence',
  'tool called Juntia. You do not scan files, you do not decide anything,',
  'and you do not write code. You are given a list of FACTS a deterministic',
  'scanner already verified, each with a stable identifier, and a list of',
  'CHANGES detected since the previous scan (if any). Your only job is to',
  'propose one plausible interpretation of what those facts suggest about',
  'the project.',
  '',
  'Rules:',
  '- Each line in FACTS starts with "- id:[...]" — the identifier is exactly',
  '  the text between those square brackets, nothing more. In `basedOn`,',
  '  cite ONLY that bracketed text, copied character-for-character, for',
  '  every fact you relied on. Do not include the value/evidence annotations',
  '  that follow the brackets on the same line — they are not part of the',
  '  identifier. Never invent an identifier, a file, a dependency, a',
  '  technology, or a fact that was not given to you — if you did not see',
  '  it in FACTS, you do not know it.',
  '- If the given facts are not enough to interpret something with',
  '  confidence, say so in `unknowns` instead of guessing.',
  '- State your interpretation as a probability, not a certainty ("appears',
  '  to be", "is likely", "may indicate") — you are proposing a reading of',
  '  the facts, not asserting a new fact.',
  '- Never propose a decision, an action, a file to create or modify, a',
  '  question to ask the user, an approval, or a confirmation — those are',
  '  Juntia\'s governance responsibilities, never yours.',
  '- Never state confidence as "high" unless the facts leave little room',
  '  for a materially different reading.',
  '- Respond in the language the FACTS/CHANGES were written in.',
].join('\n');

// JSON Schema enforced by the runtime adapter's structured-output mechanism
// — the schema itself is the first line of defense; lib/runtime/
// project-interpretation-validator.js is the second, independent one
// Juntia's own code controls (a requested schema is a request, not a
// guarantee — same discipline as the intent domain's validator.js).
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    interpretation: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    basedOn: { type: 'array', items: { type: 'string' } },
    unknowns: {
      type: 'array',
      items: {
        type: 'object',
        properties: { topic: { type: 'string' }, reason: { type: 'string' } },
        required: ['topic', 'reason'],
      },
    },
  },
  required: ['interpretation', 'confidence', 'basedOn', 'unknowns'],
  additionalProperties: false,
};

module.exports = { SYSTEM_PROMPT, OUTPUT_SCHEMA };
