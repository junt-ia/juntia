'use strict';

// Phase 12B — smoke test for lib/index.js, the package's real programmatic
// entrypoint. Verifies the re-export is exact and every function is callable
// through it, not just present as a file.
//
// Phase 15C added two more: `classifyTaskIntent`/`routeWorkflow`, the new
// Workflow Routing Engine's own public entrypoint — a deliberately separate
// pair from the five legacy exports above, not a replacement for any of
// them (see lib/index.js's own comment on why both taxonomies are exported).

const test = require('node:test');
const assert = require('node:assert/strict');

const juntia = require('../lib/index.js');
const direct = {
  classifyIntent: require('../lib/intent-router.js').classifyIntent,
  analyzeProduct: require('../lib/product-reasoning.js').analyzeProduct,
  analyzeArchitecture: require('../lib/architecture-reasoning.js').analyzeArchitecture,
  analyzeEngineering: require('../lib/engineering-reasoning.js').analyzeEngineering,
  interpretIntent: require('../lib/intent-runtime-bridge.js').interpretIntent,
  classifyTaskIntent: require('../lib/governance/intent-model.js').classifyTaskIntent,
  routeWorkflow: require('../lib/governance/workflow-router.js').routeWorkflow,
};

test('lib/index.js re-exports exactly the seven documented functions, unmodified', () => {
  assert.deepEqual(Object.keys(juntia).sort(), Object.keys(direct).sort());
  for (const name of Object.keys(direct)) {
    assert.equal(juntia[name], direct[name], `${name} should be the same function reference`);
  }
});

test('juntia.classifyIntent is callable through the entrypoint and behaves identically to the direct import', () => {
  const text = 'Quiero cambiar cómo funcionan los clientes VIP';
  assert.deepEqual(juntia.classifyIntent(text), direct.classifyIntent(text));
});
