'use strict';

// AI Handoff — Phase 13D of the Juntia migration.
//
// Implements the architecture Phase 13C proposed and validated against
// real dogfooding evidence (`analyze --explain`'s spawn("claude") ENOENT
// failure, traced to a structural mismatch: Juntia was trying to be an AI
// agent itself, instead of preparing a project for whichever AI agent the
// user already has open). Juntia never executes an AI model internally to
// produce a project interpretation — this module only ever writes a plain,
// deterministic markdown file explaining, to whatever agent reads it, how
// to do that reasoning itself and hand the result back safely.
//
// Deliberately reuses, rather than re-derives, the exact same input
// rendering and rules an internal runtime call would have used before this
// phase (`buildRequestText` from context-synthesis-bridge.js, `SYSTEM_PROMPT`
// from runtime/project-interpretation-guideline.js, and the forbidden-key
// list from runtime/project-interpretation-validator.js) — the contract an
// interpretation must satisfy did not change with this phase, only WHO
// produces it. Single source of truth for that contract stays in those two
// files; this module only explains it in agent-facing prose.

const fs = require('fs');
const path = require('path');

const { buildRequestText } = require('./context-synthesis-bridge.js');
const { SYSTEM_PROMPT } = require('../runtime/project-interpretation-guideline.js');
const { FORBIDDEN_INTERPRETATION_KEYS } = require('../runtime/project-interpretation-validator.js');

const HANDOFF_FILE = path.join('.juntia', 'agent-instructions.md');

const EXAMPLE_ITEM = {
  interpretation: 'This project appears to use Phaser as its main game engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser'],
  unknowns: [],
};

const EXAMPLE_PENDING_DOCUMENT = { schemaVersion: 1, items: [EXAMPLE_ITEM] };

// buildHandoffInstructions(facts, diff, decisions) -> markdown string
//
// Pure and deterministic: same inputs always produce the same output, no
// network call, no subprocess, no AI involved in generating it. Everything
// an agent needs to help is either given here directly or pointed at a
// real, already-persisted file (`.juntia/context.md`) — nothing is copied
// from that file, per this migration's own recurring "pointer, not a copy"
// rule (see agent-integration.js).
function buildHandoffInstructions(facts, diff, decisions) {
  return [
    '<!-- juntia:generated -->',
    '# AI Handoff Instructions',
    '',
    'You are reading this because a human asked you to help interpret this project for Juntia.',
    'Juntia does not run AI models itself — it prepares context and validates proposals. The',
    'reasoning below is yours to do.',
    '',
    '## Objective',
    '',
    'Propose ONE plausible interpretation of what the facts below suggest about this project —',
    'not a certainty, a reading of the evidence. Do not scan files yourself for this beyond what',
    'you already know from working in this project; the FACTS below are what Juntia has already',
    'verified mechanically and is asking you to reason about.',
    '',
    '## Available context',
    '',
    '```',
    buildRequestText(facts, diff, decisions),
    '```',
    '',
    '`.juntia/context.md` has the same confirmed decisions in human-readable form, if useful.',
    '',
    '## Rules',
    '',
    SYSTEM_PROMPT,
    '',
    '## Expected response format',
    '',
    'A single JSON object shaped exactly like this:',
    '',
    '```json',
    JSON.stringify(EXAMPLE_ITEM, null, 2),
    '```',
    '',
    '- `interpretation`: a string, your proposed reading of the facts.',
    '- `confidence`: exactly one of "high", "medium", "low".',
    '- `basedOn`: a non-empty array of fact identifiers, each copied character-for-character from',
    '  an `id:[...]` bracket shown above — never invented, never paraphrased.',
    '- `unknowns`: an array (can be empty) of `{"topic": "...", "reason": "..."}` objects for',
    '  anything the facts do not tell you.',
    `- Never include any of these fields — they are Juntia's own, never yours: ${FORBIDDEN_INTERPRETATION_KEYS.map((k) => `\`${k}\``).join(', ')}.`,
    '',
    '## Where to write your result',
    '',
    `Write (or update) \`.juntia/pending.json\`. If the file already exists, add your object to its`,
    '`items` array without removing what is already there. If it does not exist yet, create it with',
    'exactly this shape:',
    '',
    '```json',
    JSON.stringify(EXAMPLE_PENDING_DOCUMENT, null, 2),
    '```',
    '',
    'Juntia validates every item in that file before a human ever sees it — an item citing a fact',
    'that is not in the FACTS above, or missing a required field, is rejected and dropped silently,',
    'never shown, never confirmed. A valid item is presented to the human via `juntia confirm`, who',
    'decides to confirm or reject it. You never write directly to a decision — only a human does,',
    'and only through that command.',
    '',
  ].join('\n');
}

function writeHandoffInstructions(projectRoot, markdown) {
  const targetPath = path.join(projectRoot, HANDOFF_FILE);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, markdown);
  return targetPath;
}

module.exports = { HANDOFF_FILE, buildHandoffInstructions, writeHandoffInstructions };
