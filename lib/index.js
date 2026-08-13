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

module.exports = {
  classifyIntent,
  analyzeProduct,
  analyzeArchitecture,
  analyzeEngineering,
  interpretIntent,
};
