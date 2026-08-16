'use strict';

// Phase 15C — tests for bin/juntia.js's `route` command: the real CLI
// entrypoint over `lib/governance/workflow-router.js` +
// `lib/governance/task-handoff.js`. Verifies the full, real flow a
// developer or an external agent actually runs, including on a project that
// never explicitly ran `juntia init` (route scaffolds it first, silently,
// same precedent `runIntegrate` already set).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runRoute } = require('../bin/juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-route-cli-test-'));
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  const result = fn();
  console.log = originalLog;
  return result;
}

test('no request text -> usage guidance, nothing written, no .juntia/ created', () => {
  const root = tempProject();
  const result = silently(() => runRoute('', root));
  assert.equal(result.ok, false);
  assert.equal(fs.existsSync(path.join(root, '.juntia')), false);
});

test('a real feature request on a project that never ran `juntia init` still scaffolds the Knowledge Layer and resolves a real workflow', () => {
  const root = tempProject();
  const route = silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));

  assert.equal(route.intent, 'feature');
  assert.equal(route.workflow, 'feature-development');
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'workflows', 'feature-development.md')));
});

test('a resolved request writes .juntia/task-handoff.md with the real, matching content', () => {
  const root = tempProject();
  const route = silently(() => runRoute('El botón de pago no funciona.', root));

  const handoffPath = path.join(root, '.juntia', 'task-handoff.md');
  assert.ok(fs.existsSync(handoffPath));
  const content = fs.readFileSync(handoffPath, 'utf8');
  assert.match(content, /Workflow: bug-fix/);
  assert.match(content, new RegExp(`Governance: ${route.governanceLevel.toUpperCase()}`));
});

test('an ambiguous request never writes .juntia/task-handoff.md', () => {
  const root = tempProject();
  silently(() => runRoute('Hola, buenos días.', root));
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'task-handoff.md')), false);
});

test('route refreshes .juntia/BOOTSTRAP.md regardless of whether the request resolved to a real workflow', () => {
  const root = tempProject();
  silently(() => runRoute('Implementa clientes VIP.', root));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'BOOTSTRAP.md')));

  const root2 = tempProject();
  silently(() => runRoute('Hola, buenos días.', root2));
  assert.ok(fs.existsSync(path.join(root2, '.juntia', 'BOOTSTRAP.md')));
});

test('after a resolved route, BOOTSTRAP.md reflects that a task handoff now exists', () => {
  const root = tempProject();
  silently(() => runRoute('Implementa clientes VIP.', root));
  const bootstrap = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
  assert.match(bootstrap, /A task handoff already exists/);
});

// --- Governance Level Dynamic: the `--signal` flag's programmatic equivalent ---

test('runRoute accepts a declared `signals` option and escalates governance level end-to-end, reflected in both the return value and task-handoff.md', () => {
  const root = tempProject();
  const route = silently(() => runRoute('Implementa clientes VIP en el restaurante.', root, { signals: ['architecture_change'] }));

  assert.equal(route.baseGovernanceLevel, 'standard');
  assert.equal(route.governanceLevel, 'strict');

  const content = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
  assert.match(content, /Final governance: STRICT/);
  assert.match(content, /Required review: architecture decision/);
});

test('runRoute with no `signals` option behaves exactly as before this addition', () => {
  const root = tempProject();
  const route = silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));
  assert.equal(route.governanceLevel, 'standard');
  assert.deepEqual(route.detectedSignals, []);
});

test('route never modifies real project source files', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'index.js'), 'console.log("real code");');
  const before = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');

  silently(() => runRoute('Implementa clientes VIP.', root));

  assert.equal(fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8'), before);
});
