'use strict';

// Governance Levels — Phase 15C of the Juntia migration.
//
// Defines the three proportional governance levels named in this phase's
// own brief, grounded directly in the tier/impact tables Phase 15A already
// found real and evidence-tested inside the (now legacy)
// `lib/architecture-reasoning.js`/`lib/engineering-reasoning.js` — see those
// files' own header comments and phases/15a-governance-architecture.md §7.
// This module does not recompute or re-derive a level from a request's
// text; the level a given piece of work actually gets is read from the
// Knowledge Layer workflow file that already declares one (Phase 15B), via
// `workflow-knowledge.js`. This module only defines what LIGHT/STANDARD/
// STRICT *mean* — a small, deliberately extensible registry, not a risk
// classifier. Per this phase's own explicit restriction: "No crear todavía
// una clasificación perfecta de riesgo. Crear una arquitectura extensible
// que pueda evolucionar."

const GOVERNANCE_LEVELS = ['light', 'standard', 'strict'];

const LEVEL_INFO = {
  light: {
    label: 'LIGHT',
    description: 'Simple, low-risk changes with no open unknown and no architectural impact.',
    examples: ['documentation', 'small visual adjustments', 'isolated, mechanical changes'],
    mayRequireRoles: ['engineer'],
    humanConfirmationRequired: false,
  },
  standard: {
    label: 'STANDARD',
    description: 'Ordinary functional changes — new capabilities, behavior changes, new mechanics.',
    examples: ['new features', 'functional changes', 'new mechanics'],
    mayRequireRoles: ['product', 'architect', 'engineer', 'qa'],
    humanConfirmationRequired: false,
  },
  strict: {
    label: 'STRICT',
    description: 'Important, hard-to-reverse changes — architectural or structural decisions, high impact.',
    examples: ['architectural changes', 'structural decisions', 'high-impact modifications'],
    mayRequireRoles: ['architect'],
    humanConfirmationRequired: true,
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
