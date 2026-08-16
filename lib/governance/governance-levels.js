'use strict';

// Governance Levels — Phase 15C of the Juntia migration.
//
// Defines the three proportional governance levels named in this phase's
// own brief, grounded directly in the tier/impact tables Phase 15A already
// found real and evidence-tested inside `lib/architecture-reasoning.js`/
// `lib/engineering-reasoning.js` — both since deleted (Governance Level
// Dynamic and Legacy Cleanup phase; see phases/governance-level-dynamic-
// and-legacy-cleanup.md), their tier concept recognized here, not extracted
// as code. This module does not recompute or re-derive a level from a
// request's text; a workflow's own BASE level is read from the Knowledge
// Layer file that declares one (Phase 15B), via `workflow-knowledge.js`,
// and can be adjusted from there by declared, deterministic signals — see
// `governance-signals.js`. This module only defines what LIGHT/STANDARD/
// STRICT *mean* — a small, deliberately extensible registry, not a risk
// classifier. Per this phase's own explicit restriction: "No crear todavía
// una clasificación perfecta de riesgo. Crear una arquitectura extensible
// que pueda evolucionar."

const GOVERNANCE_LEVELS = ['light', 'standard', 'strict'];

// `decisionGuidance` (Phase 15G) — a short, fixed instruction naming how
// seriously to treat this workflow's own declared decision areas at this
// level. Still not a risk classifier: the text never depends on the
// request's own content, only on the level already resolved from the
// Knowledge Layer — the brief's own worked example almost verbatim (LIGHT:
// no triggers relevant; STANDARD: may require review; STRICT: requires a
// human decision before continuing).
const LEVEL_INFO = {
  light: {
    label: 'LIGHT',
    description: 'Simple, low-risk changes with no open unknown and no architectural impact.',
    examples: ['documentation', 'small visual adjustments', 'isolated, mechanical changes'],
    mayRequireRoles: ['engineer'],
    humanConfirmationRequired: false,
    decisionGuidance: 'No decision review required by default — proceed unless something unexpectedly touches a real decision area.',
  },
  standard: {
    label: 'STANDARD',
    description: 'Ordinary functional changes — new capabilities, behavior changes, new mechanics.',
    examples: ['new features', 'functional changes', 'new mechanics'],
    mayRequireRoles: ['product', 'architect', 'engineer', 'qa'],
    humanConfirmationRequired: false,
    decisionGuidance: 'Review the potential decision areas below before implementing; escalate any that actually apply.',
  },
  strict: {
    label: 'STRICT',
    description: 'Important, hard-to-reverse changes — architectural or structural decisions, high impact.',
    examples: ['architectural changes', 'structural decisions', 'high-impact modifications'],
    mayRequireRoles: ['architect'],
    humanConfirmationRequired: true,
    decisionGuidance: 'Human confirmation is required before implementing — do not proceed until every applicable decision area has a real, confirmed answer.',
  },
};

function normalizeLevel(level) {
  return String(level || '').trim().toLowerCase();
}

function isValidGovernanceLevel(level) {
  return GOVERNANCE_LEVELS.includes(normalizeLevel(level));
}

// describeGovernanceLevel(level) -> the registry entry for a valid level, or
// null for anything else — never guesses at a level this registry doesn't
// know about.
function describeGovernanceLevel(level) {
  const key = normalizeLevel(level);
  return isValidGovernanceLevel(key) ? LEVEL_INFO[key] : null;
}

module.exports = {
  GOVERNANCE_LEVELS,
  LEVEL_INFO,
  isValidGovernanceLevel,
  describeGovernanceLevel,
};
