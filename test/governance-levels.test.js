'use strict';

// Phase 15C — tests for the Governance Levels registry
// (`lib/governance/governance-levels.js`). Per this phase's own explicit
// restriction ("No crear todavía una clasificación perfecta de riesgo"),
// this module is a small, extensible registry of what LIGHT/STANDARD/STRICT
// mean, not a risk classifier — these tests verify the registry's shape and
// validity, not any escalation logic (none exists yet).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GOVERNANCE_LEVELS, LEVEL_INFO, isValidGovernanceLevel, describeGovernanceLevel,
} = require('../lib/governance/governance-levels.js');

test('exactly three governance levels are defined: light, standard, strict', () => {
  assert.deepEqual([...GOVERNANCE_LEVELS].sort(), ['light', 'standard', 'strict']);
});

test('every level has a real description, examples, and a humanConfirmationRequired flag', () => {
  for (const level of GOVERNANCE_LEVELS) {
    const info = LEVEL_INFO[level];
    assert.ok(info, `LEVEL_INFO must have an entry for "${level}"`);
    assert.equal(typeof info.label, 'string');
    assert.equal(typeof info.description, 'string');
    assert.ok(Array.isArray(info.examples) && info.examples.length > 0);
    assert.ok(Array.isArray(info.mayRequireRoles));
    assert.equal(typeof info.humanConfirmationRequired, 'boolean');
  }
});

test('STRICT is the only level that requires explicit human confirmation', () => {
  assert.equal(LEVEL_INFO.strict.humanConfirmationRequired, true);
  assert.equal(LEVEL_INFO.light.humanConfirmationRequired, false);
  assert.equal(LEVEL_INFO.standard.humanConfirmationRequired, false);
});

test('isValidGovernanceLevel accepts the three real levels, case-insensitively', () => {
  assert.equal(isValidGovernanceLevel('light'), true);
  assert.equal(isValidGovernanceLevel('STANDARD'), true);
  assert.equal(isValidGovernanceLevel('Strict'), true);
});

test('isValidGovernanceLevel rejects anything else, including empty/undefined', () => {
  assert.equal(isValidGovernanceLevel('extreme'), false);
  assert.equal(isValidGovernanceLevel(''), false);
  assert.equal(isValidGovernanceLevel(undefined), false);
  assert.equal(isValidGovernanceLevel(null), false);
});

test('describeGovernanceLevel returns the real registry entry for a valid level, null otherwise', () => {
  assert.equal(describeGovernanceLevel('standard'), LEVEL_INFO.standard);
  assert.equal(describeGovernanceLevel('nonsense'), null);
});
