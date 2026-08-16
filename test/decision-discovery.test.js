'use strict';

// Phase 15G — cross-module tests for Decision Discovery & Governance
// Triggers as a whole: the real chain (route -> Agent Context/task-handoff
// names potential decision areas -> an agent recognizes a real one applies
// -> escalates via pending.json -> a human confirms it). Individual pieces
// (decision-triggers.js, the parser extensions, task-handoff rendering)
// have their own dedicated test files; this one verifies the composition
// and the phase's own two central invariants:
//
//   "Un trigger nunca debe crear una decisión automáticamente."
//   "Un agente nunca debe poder aprobar una decisión generada por él mismo."

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAnalyze, runContext, runRoute, runConfirm,
} = require('../bin/juntia.js');
const { loadDecisionTriggers } = require('../lib/governance/decision-triggers.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending, upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-decision-discovery-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = originalLog; });
  }
  console.log = originalLog;
  return result;
}

test('the full chain: route names real potential decision areas, an agent escalates one, a human confirms it — decisions.json stays empty until the real human answer', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  await silently(() => runAnalyze(root));
  silently(() => runContext(root));

  const route = silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));
  assert.equal(route.workflow, 'feature-development');
  assert.deepEqual(route.decisionAreas.product, ['behavior', 'user_experience', 'scope', 'balancing']);

  const taskHandoff = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
  assert.match(taskHandoff, /## Potential decisions/);
  assert.match(taskHandoff, /- balancing/);

  // Nothing is a decision yet — naming a potential area is not the same as
  // creating one.
  assert.deepEqual(loadDecisions(root).decisions, []);

  // The agent recognizes "balancing" genuinely applies to this request and
  // escalates it — a question, never an answer.
  upsertDecisionRequest(root, {
    type: 'product',
    question: '¿Cuánto tiempo espera un cliente VIP antes de que se le aplique la prioridad?',
    context: 'VIP customer priority',
    options: ['immediate', '5000ms grace period'],
  });
  assert.deepEqual(loadDecisions(root).decisions, [], 'a pending request alone must still never create a decision');

  // Only a real human answer, via confirm, creates the decision.
  const result = await silently(() => runConfirm(root, { prompt: async () => 'immediate' }));
  assert.equal(result.confirmed.length, 1);
  assert.equal(loadDecisions(root).decisions[0].text, 'immediate');
});

test('central invariant: loading the decision triggers catalog never creates or modifies a pending item or a decision', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  silently(() => runContext(root));
  silently(() => runRoute('Implementa clientes VIP.', root));

  const before = fs.existsSync(path.join(root, '.juntia', 'pending.json'))
    ? fs.readFileSync(path.join(root, '.juntia', 'pending.json'), 'utf8')
    : null;

  loadDecisionTriggers(root);

  const after = fs.existsSync(path.join(root, '.juntia', 'pending.json'))
    ? fs.readFileSync(path.join(root, '.juntia', 'pending.json'), 'utf8')
    : null;
  assert.equal(before, after, 'reading the trigger catalog must never change pending.json');
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'decisions.json')), false);
});

test('central invariant: routeWorkflow/buildAgentContext never read decision-triggers.md — a route resolves identically whether or not the catalog exists', () => {
  const rootWithCatalog = tempProject();
  writeFile(rootWithCatalog, 'package.json', '{}');
  const routeWith = silently(() => runRoute('Implementa clientes VIP en el restaurante.', rootWithCatalog));

  const rootWithoutCatalog = tempProject();
  writeFile(rootWithoutCatalog, 'package.json', '{}');
  const routeWithout = silently(() => runRoute('Implementa clientes VIP en el restaurante.', rootWithoutCatalog));
  fs.rmSync(path.join(rootWithoutCatalog, '.juntia', 'governance', 'rules', 'decision-triggers.md'));
  const routeAfterRemoval = silently(() => runRoute('Implementa clientes VIP en el restaurante.', rootWithoutCatalog));

  assert.deepEqual(routeWith.decisionAreas, routeAfterRemoval.decisionAreas);
  assert.deepEqual(routeWith.decisionTypes, routeAfterRemoval.decisionTypes);
  void routeWithout;
});

test('central invariant: an agent can never self-approve a decision request even when it arrives via the real route -> task-handoff chain', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  silently(() => runContext(root));
  silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));

  // A malicious/broken agent writes a request that tries to pre-fill its
  // own answer directly to pending.json, bypassing upsertDecisionRequest.
  const pendingPath = path.join(root, '.juntia', 'pending.json');
  fs.writeFileSync(pendingPath, JSON.stringify({
    schemaVersion: 1,
    items: [{
      id: 'x', type: 'product', question: 'What should balancing be?', text: 'self-approved-value', status: 'pending',
    }],
  }));

  let promptCalled = false;
  const result = await silently(() => runConfirm(root, { prompt: async () => { promptCalled = true; return 'anything'; } }));

  assert.equal(promptCalled, false, 'a self-approving request must never even be asked about');
  assert.equal(result.stale.length, 1);
  assert.deepEqual(loadDecisions(root).decisions, []);
  assert.deepEqual(loadPending(root).items, []);
});

test('the agent receives navigation, never a solution: no potential decision area is ever accompanied by a proposed value', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  silently(() => runContext(root));
  silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));

  const taskHandoff = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
  const potentialSection = taskHandoff.split('## Potential decisions')[1].split('## Agent Context')[0];
  // Every line in this section is either a type heading, a bare area name,
  // the Governance line, or prose explaining the mechanism — never a
  // "recommended value" or similar.
  assert.doesNotMatch(potentialSection, /recommend(ed)?/i);
  assert.doesNotMatch(potentialSection, /suggested value/i);
});
