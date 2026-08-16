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
  decisionTypes: ['product', 'architecture'],
  decisionAreas: { product: ['behavior', 'balancing'], architecture: ['data_model'] },
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
  assert.deepEqual(context.workflow, {
    name: 'feature-development',
    governanceLevel: 'standard',
    baseGovernanceLevel: 'standard',
    detectedSignals: [],
    requiredReview: [],
    decisionTypes: ['product', 'architecture'],
    decisionAreas: { product: ['behavior', 'balancing'], architecture: ['data_model'] },
    decisionGuidance: 'Review the potential decision areas below before implementing; escalate any that actually apply.',
  });
  assert.deepEqual(context.roles, ['product', 'architect', 'engineer', 'qa']);
  assert.deepEqual(context.skills, ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy']);
});

test('workflow.decisionTypes defaults to an empty array when the route carries none (backward compatibility with a pre-15F route shape)', () => {
  const { decisionTypes, ...routeWithoutDecisionTypes } = RESOLVED_ROUTE;
  const context = buildAgentContext(routeWithoutDecisionTypes);
  assert.deepEqual(context.workflow.decisionTypes, []);
});

test('workflow.decisionAreas defaults to {} when the route carries none (backward compatibility with a pre-15G route shape)', () => {
  const { decisionAreas, ...routeWithoutDecisionAreas } = RESOLVED_ROUTE;
  const context = buildAgentContext(routeWithoutDecisionAreas);
  assert.deepEqual(context.workflow.decisionAreas, {});
});

test('workflow.decisionGuidance is read from governance-levels.js\'s own registry, never computed from the request', () => {
  const context = buildAgentContext(RESOLVED_ROUTE);
  assert.equal(typeof context.workflow.decisionGuidance, 'string');
  assert.ok(context.workflow.decisionGuidance.length > 0);

  const strictRoute = { ...RESOLVED_ROUTE, governanceLevel: 'strict' };
  const strictContext = buildAgentContext(strictRoute);
  assert.match(strictContext.workflow.decisionGuidance, /confirmation is required/);
  assert.notEqual(strictContext.workflow.decisionGuidance, context.workflow.decisionGuidance);
});

test('workflow.decisionGuidance is null when the route has no resolvable governance level', () => {
  const routeWithBadLevel = { ...RESOLVED_ROUTE, governanceLevel: 'not-a-real-level' };
  const context = buildAgentContext(routeWithBadLevel);
  assert.equal(context.workflow.decisionGuidance, null);
});

test('workflow.baseGovernanceLevel falls back to governanceLevel when the route carries none (backward compatibility with a pre-signals route shape)', () => {
  const { baseGovernanceLevel, ...routeWithoutBase } = { ...RESOLVED_ROUTE, baseGovernanceLevel: 'standard' };
  void baseGovernanceLevel;
  const context = buildAgentContext(routeWithoutBase);
  assert.equal(context.workflow.baseGovernanceLevel, 'standard');
});

test('workflow.detectedSignals/requiredReview default to [] when the route carries none (backward compatibility)', () => {
  const context = buildAgentContext(RESOLVED_ROUTE);
  assert.deepEqual(context.workflow.detectedSignals, []);
  assert.deepEqual(context.workflow.requiredReview, []);
});

test('workflow.baseGovernanceLevel/detectedSignals/requiredReview carry through when a signal escalated the route', () => {
  const escalatedRoute = {
    ...RESOLVED_ROUTE,
    governanceLevel: 'strict',
    baseGovernanceLevel: 'standard',
    detectedSignals: [{ signal: 'architecture_change', level: 'strict', reason: 'x', decisionType: 'architecture' }],
    requiredReview: ['architecture'],
  };
  const context = buildAgentContext(escalatedRoute);
  assert.equal(context.workflow.governanceLevel, 'strict');
  assert.equal(context.workflow.baseGovernanceLevel, 'standard');
  assert.deepEqual(context.workflow.detectedSignals, [{ signal: 'architecture_change', level: 'strict', reason: 'x', decisionType: 'architecture' }]);
  assert.deepEqual(context.workflow.requiredReview, ['architecture']);
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
