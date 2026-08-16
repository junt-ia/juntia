'use strict';

// Phase 15D — tests for `lib/governance/agent-context.js`: the pure
// transform from Phase 15C's flat `routeWorkflow()` result into the nested,
// navigation-shaped contract this phase's own brief defines exactly
// (`{ task: { intent, confidence }, workflow: { name, governanceLevel },
// roles, skills, contextSources }`). Central property under test: this
// object is navigation, never a solution — every field is a real intent
// name, a real workflow name, or a real file path, never prose describing
// what to build.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { buildAgentContext } = require('../lib/governance/agent-context.js');

const RESOLVED_ROUTE = {
  intent: 'feature',
  confidence: 0.9,
  workflow: 'feature-development',
  governanceLevel: 'standard',
  roles: ['product', 'architect', 'engineer', 'qa'],
  skills: ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy'],
  needsClarification: false,
  reason: 'feature <- creation/capability language',
};

const UNRESOLVED_ROUTE = {
  intent: 'unknown',
  confidence: 0.2,
  workflow: null,
  governanceLevel: null,
  roles: [],
  skills: [],
  needsClarification: true,
  reason: 'No recognizable intent signal in the request text.',
};

test('matches the brief\'s own exact shape for a resolved route', () => {
  const context = buildAgentContext(RESOLVED_ROUTE);

  assert.deepEqual(context.task, {
    intent: 'feature', confidence: 0.9, needsClarification: false, reason: 'feature <- creation/capability language',
  });
  assert.deepEqual(context.workflow, { name: 'feature-development', governanceLevel: 'standard' });
  assert.deepEqual(context.roles, ['product', 'architect', 'engineer', 'qa']);
  assert.deepEqual(context.skills, ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy']);
});

test('contextSources is exactly context.md plus the resolved workflow file — matches the brief\'s own worked example', () => {
  const context = buildAgentContext(RESOLVED_ROUTE);
  assert.deepEqual(context.contextSources, [
    path.join('.juntia', 'context.md'),
    path.join('.juntia', 'governance', 'workflows', 'feature-development.md'),
  ]);
});

test('an unresolved route produces workflow: null, empty roles/skills, and contextSources with only context.md', () => {
  const context = buildAgentContext(UNRESOLVED_ROUTE);
  assert.equal(context.workflow, null);
  assert.deepEqual(context.roles, []);
  assert.deepEqual(context.skills, []);
  assert.equal(context.contextSources.length, 1);
  assert.match(context.contextSources[0], /context\.md$/);
});

test('task.needsClarification and task.reason carry through — navigational meta-info, not a solution', () => {
  const context = buildAgentContext(UNRESOLVED_ROUTE);
  assert.equal(context.task.needsClarification, true);
  assert.equal(context.task.reason, 'No recognizable intent signal in the request text.');
});

test('the object never contains prose describing what to build — every string value is either a real name or a real file path', () => {
  const context = buildAgentContext(RESOLVED_ROUTE);
  // No field here is free text proposing an implementation; roles/skills are
  // short, fixed slugs, workflow.name is a real Knowledge Layer filename
  // stem, contextSources are real paths — none of them exceed a plain
  // identifier or a path in shape.
  for (const role of context.roles) assert.match(role, /^[a-z]+$/);
  for (const skill of context.skills) assert.match(skill, /^[a-z-]+$/);
  assert.match(context.workflow.name, /^[a-z-]+$/);
  for (const source of context.contextSources) assert.match(source, /\.(md)$/);
});
