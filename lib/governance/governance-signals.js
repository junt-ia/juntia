'use strict';

// Governance Signals — dynamic governance level.
//
// Reads `.juntia/governance/rules/governance-signals.md` — a small, curated
// catalog of named signals, each naming a governance level — the same
// "Knowledge Layer is the only source of truth, parse the real file,
// hardcode nothing about its content" discipline `decision-triggers.js`
// already established. The catalog's own content (which signals exist,
// their level, their reason, their optional decision type) lives entirely
// in that markdown file; this module only knows how to read it and combine
// it with a workflow's own base level.
//
// ARCHITECTURAL BOUNDARY (deliberate, same as `decision-triggers.js`): this
// module never matches a signal against a request's own free text, and
// never decides on its own that a signal applies. A caller (an agent,
// following its own judgment, or a human via `juntia route --signal <name>`)
// declares which signals apply; this module only computes the deterministic
// result of that declaration. No AI, no NLP, no text interpretation — the
// same restriction the governance-level-dynamic brief states explicitly.
//
// Escalation/de-escalation rule: with no declared signals, the workflow's
// own base level applies unchanged. With one or more recognized declared
// signals, the final level is the HIGHEST level named among them — a single
// `strict` signal always wins, and an all-`light` declaration can resolve
// BELOW the workflow's own base (the brief's own worked example: an
// isolated, dependency-free change under a STANDARD-default workflow
// resolving to LIGHT). Unrecognized signal names are silently ignored —
// never guessed at, never an error — the same discipline every other parser
// in this codebase already follows for malformed/unexpected input.

const fs = require('fs');
const path = require('path');

const { GOVERNANCE_LEVELS, isValidGovernanceLevel } = require('./governance-levels.js');

const GOVERNANCE_SIGNALS_FILE = path.join('.juntia', 'governance', 'rules', 'governance-signals.md');

const SIGNAL_LEVEL_LINE = /^- \*\*Level:\*\*\s*(light|standard|strict)\s*$/m;
const SIGNAL_DECISION_TYPE_LINE = /^- \*\*Decision type:\*\*\s*(product|architecture)\s*$/m;

// A field's value can wrap onto indented continuation lines — same
// convention, same reason, as `decision-triggers.js`'s own `extractField`.
function extractField(body, label) {
  const pattern = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+(?:\\n(?! *- \\*\\*)[^\\n]*)*)`, 'm');
  const match = pattern.exec(body);
  if (!match) return null;
  return match[1].split('\n').map((line) => line.trim()).join(' ').trim();
}

// parseGovernanceSignals(markdown) -> [{ signal, level, reason, decisionType
// }, ...]. Each `## name` heading is one signal; an entry missing a real
// `Level`/`Reason` is skipped, never guessed at — the same "unreadable is a
// real, honest result, not something to paper over" discipline
// `decision-triggers.js`'s own parser already follows. `decisionType` is
// `null` when the entry names none (most signals have no natural
// decision-type tie-in, e.g. `documentation_only`).
function parseGovernanceSignals(markdown) {
  const signals = [];
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const newlineIndex = section.indexOf('\n');
    const signal = (newlineIndex === -1 ? section : section.slice(0, newlineIndex)).trim();
    const body = newlineIndex === -1 ? '' : section.slice(newlineIndex + 1);

    const levelMatch = SIGNAL_LEVEL_LINE.exec(body);
    const reason = extractField(body, 'Reason');
    if (!signal || !levelMatch || !reason) continue;

    const decisionTypeMatch = SIGNAL_DECISION_TYPE_LINE.exec(body);
    signals.push({
      signal,
      level: levelMatch[1],
      reason,
      decisionType: decisionTypeMatch ? decisionTypeMatch[1] : null,
    });
  }
  return signals;
}

// loadGovernanceSignals(projectRoot) -> { ok: true, signals } or
// { ok: false, reason }. A missing file (a project that never scaffolded the
// Knowledge Layer, or trimmed this file to nothing) is a real, honest "no
// signals" — never invented, never crashes.
function loadGovernanceSignals(projectRoot) {
  const filePath = path.join(projectRoot, GOVERNANCE_SIGNALS_FILE);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `${GOVERNANCE_SIGNALS_FILE} not found — run \`juntia init\` to scaffold the Knowledge Layer first` };
  }
  const markdown = fs.readFileSync(filePath, 'utf8');
  return { ok: true, signals: parseGovernanceSignals(markdown) };
}

function levelRank(level) {
  return GOVERNANCE_LEVELS.indexOf(level);
}

// evaluateGovernanceLevel({ baseLevel, declaredSignals, catalogSignals }) ->
// { baseLevel, detectedSignals, finalLevel, requiredReview }.
//
// `declaredSignals` — signal names the caller declares apply (never
// computed by this function). `catalogSignals` — the real catalog read by
// `loadGovernanceSignals` (or an equivalent array, e.g. hand-constructed by
// a test). `detectedSignals` is the catalog-recognized subset of what was
// declared, in catalog order — never invents a signal `catalogSignals`
// doesn't actually define. `requiredReview` is the deduped `decisionType`s
// of whichever detected signals are AT the final level (the ones that
// actually determined it) — empty when none name one, or when no signal
// changed the outcome from the base level.
function evaluateGovernanceLevel({ baseLevel, declaredSignals = [], catalogSignals = [] }) {
  const declaredNames = new Set(
    (declaredSignals || []).map((s) => String(s || '').trim().toLowerCase()).filter(Boolean),
  );

  const detectedSignals = catalogSignals.filter((entry) => declaredNames.has(entry.signal.toLowerCase()));

  let finalLevel = isValidGovernanceLevel(baseLevel) ? baseLevel : null;
  if (detectedSignals.length > 0 && finalLevel !== null) {
    const highest = detectedSignals.reduce(
      (best, entry) => (levelRank(entry.level) > levelRank(best) ? entry.level : best),
      detectedSignals[0].level,
    );
    finalLevel = highest;
  }

  const requiredReview = detectedSignals.length > 0
    ? [...new Set(
      detectedSignals
        .filter((entry) => entry.level === finalLevel && entry.decisionType)
        .map((entry) => entry.decisionType),
    )]
    : [];

  return {
    baseLevel: isValidGovernanceLevel(baseLevel) ? baseLevel : null,
    detectedSignals,
    finalLevel,
    requiredReview,
  };
}

module.exports = {
  GOVERNANCE_SIGNALS_FILE,
  parseGovernanceSignals,
  loadGovernanceSignals,
  evaluateGovernanceLevel,
};
