'use strict';

// Phase 15C — tests for `lib/governance/workflow-router.js`: the Workflow
// Routing Engine, the real composition of the Intent Model + Workflow
// Knowledge that turns a free-text request into the structured contract
// this phase's brief names (intent/confidence/workflow/governanceLevel/
// roles/skills). The central property under test: an ambiguous request, or
// a request routed against a project with no real Knowledge Layer, must
// never produce a false workflow.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { init } = require('../bin/juntia.js');
const { routeWorkflow } = require('../lib/governance/workflow-router.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-workflow-router-test-'));
}

test('the brief\'s own worked example: "Implementa clientes VIP en el restaurante." routes to feature-development, STANDARD, with all four roles/skills', () => {
  const root = tempProject();
  init(root);

  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root);

  assert.equal(route.intent, 'feature');
  assert.ok(route.confidence >= 0.85);
  assert.equal(route.workflow, 'feature-development');
  assert.equal(route.governanceLevel, 'standard');
  assert.deepEqual(route.roles, ['product', 'architect', 'engineer', 'qa']);
  assert.deepEqual(route.skills, ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy']);
  assert.equal(route.needsClarification, false);
});

test('a bug report routes to bug-fix, LIGHT, with its own real roles/skills', () => {
  const root = tempProject();
  init(root);

  const route = routeWorkflow('El botón de pago no funciona.', root);

  assert.equal(route.intent, 'bug');
  assert.equal(route.workflow, 'bug-fix');
  assert.equal(route.governanceLevel, 'light');
  assert.deepEqual(route.roles, ['qa', 'engineer', 'architect']);
});

test('an investigation question routes to investigation, LIGHT', () => {
  const root = tempProject();
  init(root);

  const route = routeWorkflow('Analiza cómo funciona el sistema de reservas.', root);

  assert.equal(route.intent, 'investigation');
  assert.equal(route.workflow, 'investigation');
  assert.equal(route.governanceLevel, 'light');
});

test('a refactor request routes to refactor, STANDARD', () => {
  const root = tempProject();
  init(root);

  const route = routeWorkflow('Refactoriza el módulo de pagos sin cambiar el comportamiento.', root);

  assert.equal(route.intent, 'refactor');
  assert.equal(route.workflow, 'refactor');
  assert.equal(route.governanceLevel, 'standard');
});

// --- Never a false workflow ---

test('an ambiguous request never produces a workflow — workflow is null, needsClarification is true', () => {
  const root = tempProject();
  init(root);

  const route = routeWorkflow('Hola, buenos días.', root);

  assert.equal(route.intent, 'unknown');
  assert.equal(route.workflow, null);
  assert.equal(route.governanceLevel, null);
  assert.deepEqual(route.roles, []);
  assert.deepEqual(route.skills, []);
  assert.equal(route.needsClarification, true);
  assert.equal(typeof route.reason, 'string');
});

test('empty text never produces a workflow', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('', root);
  assert.equal(route.workflow, null);
  assert.equal(route.needsClarification, true);
});

test('a real intent classified against a project with no Knowledge Layer at all still never fabricates a workflow', () => {
  const root = tempProject(); // no init() — no .juntia/ at all

  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root);

  assert.equal(route.intent, 'feature'); // classification itself is independent of the filesystem
  assert.equal(route.workflow, null); // but resolution against a missing Knowledge Layer must not invent one
  assert.equal(route.needsClarification, true);
  assert.match(route.reason, /juntia init/);
});

test('routeWorkflow defaults projectRoot to process.cwd() when not given', () => {
  const route = routeWorkflow('Hola');
  assert.equal(typeof route, 'object');
  assert.equal(route.intent, 'unknown');
});
