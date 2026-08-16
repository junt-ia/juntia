'use strict';

// Phase 12B — smoke test for lib/index.js, the package's real programmatic
// entrypoint. Verifies the re-export is exact and every function is callable
// through it, not just present as a file.
//
// Governance Level Dynamic and Legacy Cleanup phase: the five legacy,
// nine-intent free-text reasoning exports this test used to also verify
// (`classifyIntent`, `analyzeProduct`, `analyzeArchitecture`,
// `analyzeEngineering`, `interpretIntent`) are gone — their backing modules
// were deleted, not just unexported. `classifyTaskIntent`/`routeWorkflow`
// are the only, current, real public API.

const test = require('node:test');
const assert = require('node:assert/strict');

const juntia = require('../lib/index.js');
const direct = {
  classifyTaskIntent: require('../lib/governance/intent-model.js').classifyTaskIntent,
  routeWorkflow: require('../lib/governance/workflow-router.js').routeWorkflow,
};

test('lib/index.js re-exports exactly the two documented functions, unmodified', () => {
  assert.deepEqual(Object.keys(juntia).sort(), Object.keys(direct).sort());
  for (const name of Object.keys(direct)) {
    assert.equal(juntia[name], direct[name], `${name} should be the same function reference`);
  }
});

test('juntia.routeWorkflow is callable through the entrypoint and behaves identically to the direct import', () => {
  const text = 'Quiero cambiar cómo funcionan los clientes VIP';
  assert.deepEqual(juntia.routeWorkflow(text), direct.routeWorkflow(text));
});

test('the five legacy reasoning exports are gone — not just unexported, their backing modules were deleted', () => {
  for (const name of ['classifyIntent', 'analyzeProduct', 'analyzeArchitecture', 'analyzeEngineering', 'interpretIntent']) {
    assert.equal(name in juntia, false, `${name} should no longer be part of the public API`);
  }
});
