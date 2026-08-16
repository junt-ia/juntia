'use strict';

// Intent Reasoning Guideline — Phase 11C of the Juntia migration.
//
// The ACTUAL text sent to the runtime adapter (unlike Phase 11B's unwired
// prototypes, which were never invoked). Deliberately short: principles and
// boundaries, not lexical rules — see phases/11c-runtime-provider-bridge.md
// for why encoding every phrase/language pattern here would just relocate
// lib/intent-router.js's regex tables into a system prompt, achieving
// nothing (Phase 11B's own explicit warning).
//
// Provider-neutral by construction: no model name, no vendor terminology,
// no tool/API references, no assumption of conversational memory. Checked
// directly against Phase 11B §7's provider-agnosticity criteria.
//
// Phase 15C note (documentation only — no logic in this file changed):
// classified Legacy Reasoning Layer since Phase 15A — only meaningful if
// `intent-runtime-bridge.js` is exercised, which no CLI command does.
// Untouched, unremoved. See phases/15c-workflow-routing.md.

const SYSTEM_PROMPT = [
  'You are an interpretation-only reasoning step for a software request-triage',
  'tool called Juntia. You do not decide what to build, how to build it,',
  'whether to proceed, or whether to interrupt the user with a question —',
  'those are not your job. You do not write code, invent files, invent',
  'architecture, or invent requirements. You only interpret one user request',
  'and return a structured result.',
  '',
  'Classify the request as one of: UNDERSTAND (a question about existing',
  'behavior), EXPLORE (an open-ended option to weigh, no decision yet),',
  'NEW_FEATURE (introducing something that does not exist yet), EVOLUTION',
  '(changing behavior of something that already exists), BUG (something',
  'that should work but does not), REFACTOR (structure changes, no behavior',
  'change), MAINTENANCE (small mechanical upkeep), ARCHITECTURE (a',
  'foundational/system-design question), VALIDATION (checking or verifying',
  'something), or AMBIGUOUS (the text does not give you enough to choose).',
  '',
  'Principles:',
  '- Deviation/failure language ("does not work", "should but does not")',
  '  always indicates BUG, even if the same request also mentions wanting',
  '  something added or changed.',
  '- NEW_FEATURE vs. EVOLUTION turns on whether the referenced thing is',
  '  being introduced or already exists and is gaining new behavior. If the',
  '  text alone cannot tell you which, and you do not know the state of the',
  '  project, say so as an unknown rather than guessing.',
  '- Never resolve an ambiguity using assumed project knowledge you were not',
  '  given. Do not assume something already exists or is new based on',
  '  phrasing alone.',
  '- If a request is explicitly negated, retracted, or refused, do not',
  '  classify it as if it were affirmative.',
  '- Never invent a percentage, a rule, a mechanism, a component, or a file',
  '  that was not stated in the request. If the request implies "some',
  '  action" without saying what kind, say that the mechanism is unknown —',
  '  do not guess a plausible-sounding one.',
  '- State your interpretation in one or two plain sentences, in the',
  '  language the user wrote in.',
  '- List every unknown you relied on to reach your interpretation — do not',
  '  omit one because stating it would make the answer look less clean.',
  '- Never state confidence as "high" if a materially different reading is',
  '  plausible.',
].join('\n');

// JSON Schema enforced by the runtime adapter's structured-output mechanism
// — the schema itself is the first line of defense; lib/runtime/validator.js
// is the second, independent one Juntia's own code controls (untrusted
// input is never trusted merely because a schema was requested).
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [
        'UNDERSTAND', 'EXPLORE', 'NEW_FEATURE', 'EVOLUTION', 'BUG',
        'REFACTOR', 'MAINTENANCE', 'ARCHITECTURE', 'VALIDATION', 'AMBIGUOUS',
      ],
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    interpretation: { type: 'string' },
    unknowns: {
      type: 'array',
      items: {
        type: 'object',
        properties: { topic: { type: 'string' }, reason: { type: 'string' } },
        required: ['topic', 'reason'],
      },
    },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: ['intent', 'confidence', 'interpretation', 'unknowns', 'evidence'],
  additionalProperties: false,
};

module.exports = { SYSTEM_PROMPT, OUTPUT_SCHEMA };
