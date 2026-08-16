'use strict';

// The package's real, documented programmatic entrypoint — closes the gap
// juntia-research's Phase 12A found: no `main`/`exports` ever pointed at any
// reasoning module, so nothing outside this repo's own tests could ever
// `require()` it. Re-exports each module's real function unmodified; adds no
// new logic of its own.

const { classifyIntent } = require('./intent-router.js');
const { analyzeProduct } = require('./product-reasoning.js');
const { analyzeArchitecture } = require('./architecture-reasoning.js');
const { analyzeEngineering } = require('./engineering-reasoning.js');
const { interpretIntent } = require('./intent-runtime-bridge.js');
const { classifyTaskIntent } = require('./governance/intent-model.js');
const { routeWorkflow } = require('./governance/workflow-router.js');

module.exports = {
  classifyIntent,
  analyzeProduct,
  analyzeArchitecture,
  analyzeEngineering,
  interpretIntent,
  // Phase 15C — the Workflow Routing Engine's real, public entrypoint.
  // `classifyIntent`/`interpretIntent` above are the legacy, nine-intent
  // free-text reasoning layer (Phase 15A/15B: kept, not wired to anything
  // new); `classifyTaskIntent`/`routeWorkflow` are the new, four-workflow-
  // shaped classifier and its Knowledge Layer resolution, the mechanism that
  // actually powers `juntia route`.
  classifyTaskIntent,
  routeWorkflow,
};
