'use strict';

// Phase 14A — tests for lib/project-intelligence/agent-governance.js: the
// AI Handoff (13D) gave a connected agent memory; this gives it behavior.
// `buildAgentRules`/`buildWorkflows` are fixed, deterministic content — no
// facts/decisions input, same for every project, per this phase's own
// explicit "las reglas deben ser generadas por Juntia y no inventadas por
// Claude."

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  AGENT_RULES_FILE, WORKFLOWS_FILE, buildAgentRules, buildWorkflows, writeAgentGovernance,
} = require('../lib/project-intelligence/agent-governance.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-test-'));
}

test('buildAgentRules is deterministic: same output every time, no input needed', () => {
  assert.equal(buildAgentRules(), buildAgentRules());
});

test('buildWorkflows is deterministic: same output every time, no input needed', () => {
  assert.equal(buildWorkflows(), buildWorkflows());
});

test('buildAgentRules covers every rule the brief named: analyze first, respect decisions, justify dependencies, ask on conflict, validate', () => {
  const rules = buildAgentRules();
  assert.match(rules, /Analyze before modifying/);
  assert.match(rules, /Respect confirmed decisions/);
  assert.match(rules, /Never introduce a dependency without stating why/);
  assert.match(rules, /Ask when a request conflicts/);
  assert.match(rules, /Validate changes/);
});

test('buildAgentRules never claims to be this project\'s own constraints — distinct from .juntia/RULES.md', () => {
  const rules = buildAgentRules();
  assert.match(rules, /RULES\.md/);
  assert.match(rules, /same\s+rules for every Juntia-governed project/);
});

test('buildAgentRules forbids an agent from writing directly to decisions.json', () => {
  const rules = buildAgentRules();
  assert.match(rules, /Never write directly to `\.juntia\/decisions\.json`/);
});

test('buildWorkflows covers a new-feature sequence and a bug-fix sequence', () => {
  const workflows = buildWorkflows();
  assert.match(workflows, /## New feature/);
  assert.match(workflows, /## Bug fix/);
  assert.match(workflows, /Analyze the impact/);
  assert.match(workflows, /Reproduce the bug/);
});

test('writeAgentGovernance writes exactly .juntia/agent-rules.md and .juntia/workflows.md', () => {
  const root = tempProject();
  writeAgentGovernance(root);

  assert.ok(fs.existsSync(path.join(root, AGENT_RULES_FILE)));
  assert.ok(fs.existsSync(path.join(root, WORKFLOWS_FILE)));
  assert.equal(AGENT_RULES_FILE, path.join('.juntia', 'agent-rules.md'));
  assert.equal(WORKFLOWS_FILE, path.join('.juntia', 'workflows.md'));
});

test('writeAgentGovernance is idempotent: regenerating twice produces byte-identical files', () => {
  const root = tempProject();
  writeAgentGovernance(root);
  const firstRules = fs.readFileSync(path.join(root, AGENT_RULES_FILE), 'utf8');
  const firstWorkflows = fs.readFileSync(path.join(root, WORKFLOWS_FILE), 'utf8');

  writeAgentGovernance(root);
  assert.equal(fs.readFileSync(path.join(root, AGENT_RULES_FILE), 'utf8'), firstRules);
  assert.equal(fs.readFileSync(path.join(root, WORKFLOWS_FILE), 'utf8'), firstWorkflows);
});

test('writeAgentGovernance always regenerates fully — a stale/hand-edited file is overwritten with the current version, detecting the change', () => {
  const root = tempProject();
  writeAgentGovernance(root);
  fs.writeFileSync(path.join(root, AGENT_RULES_FILE), 'stale content from a previous version');

  writeAgentGovernance(root);

  assert.equal(fs.readFileSync(path.join(root, AGENT_RULES_FILE), 'utf8'), buildAgentRules());
});

test('both generated files carry the juntia:generated marker', () => {
  assert.match(buildAgentRules(), /^<!-- juntia:generated -->/);
  assert.match(buildWorkflows(), /^<!-- juntia:generated -->/);
});
