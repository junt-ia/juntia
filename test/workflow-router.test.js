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
  assert.deepEqual(route.skills, ['feature-planning', 'architecture-review', 'governance-review', 'implementation', 'testing-strategy']);
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

// --- Phase 15F: decisionTypes propagates from the real workflow file ---

test('a feature route carries decisionTypes: ["product", "architecture"], read from the real workflow file', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root);
  assert.deepEqual(route.decisionTypes, ['product', 'architecture']);
});

// Phase 15G refinement: investigation.md now names an architecture decision
// area (`technical_direction`) it commonly surfaces, even though the
// workflow itself never writes one — see phases/15g-decision-discovery.md.
test('an investigation route carries decisionTypes: ["architecture"] — it commonly surfaces the need for one, even though it never writes one itself', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Analiza cómo funciona el sistema de reservas.', root);
  assert.deepEqual(route.decisionTypes, ['architecture']);
});

test('an unresolved route always carries decisionTypes: [] — never invented for a workflow that was never actually resolved', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Hola, buenos días.', root);
  assert.deepEqual(route.decisionTypes, []);
});

// --- Phase 15G: decisionAreas propagates from the real workflow file ---

test('a feature route carries the real, named decision areas per type, read from the workflow file', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root);
  assert.deepEqual(route.decisionAreas, {
    product: ['behavior', 'user_experience', 'scope', 'balancing'],
    architecture: ['data_model', 'module_boundary', 'dependency_choice'],
  });
});

test('an unresolved route always carries decisionAreas: {} — never invented', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Hola, buenos días.', root);
  assert.deepEqual(route.decisionAreas, {});
});

// --- Governance Level Dynamic: signals escalate/de-escalate the resolved workflow's own base level ---

test('with no signals declared, governanceLevel equals baseGovernanceLevel — identical to pre-signals behavior', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root);
  assert.equal(route.baseGovernanceLevel, 'standard');
  assert.equal(route.governanceLevel, 'standard');
  assert.deepEqual(route.detectedSignals, []);
  assert.deepEqual(route.requiredReview, []);
});

test('a declared strict signal escalates feature-development from STANDARD to STRICT end-to-end', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root, { signals: ['architecture_change'] });
  assert.equal(route.baseGovernanceLevel, 'standard');
  assert.equal(route.governanceLevel, 'strict');
  assert.deepEqual(route.detectedSignals.map((s) => s.signal), ['architecture_change']);
  assert.deepEqual(route.requiredReview, ['architecture']);
});

test('declared light-only signals de-escalate feature-development from STANDARD to LIGHT end-to-end', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root, {
    signals: ['documentation_only', 'isolated_change'],
  });
  assert.equal(route.baseGovernanceLevel, 'standard');
  assert.equal(route.governanceLevel, 'light');
});

test('an unrecognized declared signal is ignored — governanceLevel stays at the base', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Implementa clientes VIP en el restaurante.', root, { signals: ['not_a_real_signal'] });
  assert.equal(route.governanceLevel, 'standard');
  assert.deepEqual(route.detectedSignals, []);
});

test('an unresolved route carries baseGovernanceLevel: null and empty detectedSignals/requiredReview', () => {
  const root = tempProject();
  init(root);
  const route = routeWorkflow('Hola, buenos días.', root, { signals: ['architecture_change'] });
  assert.equal(route.baseGovernanceLevel, null);
  assert.deepEqual(route.detectedSignals, []);
  assert.deepEqual(route.requiredReview, []);
});
