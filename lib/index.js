'use strict';

// The package's real, documented programmatic entrypoint — closes the gap
// juntia-research's Phase 12A found: no `main`/`exports` ever pointed at any
// governance module, so nothing outside this repo's own tests could ever
// `require()` it. Re-exports each module's real function unmodified; adds no
// new logic of its own.
//
// Governance Level Dynamic and Legacy Cleanup phase: the five legacy,
// nine-intent free-text reasoning exports (`classifyIntent`,
// `analyzeProduct`, `analyzeArchitecture`, `analyzeEngineering`,
// `interpretIntent`) are removed — see this phase's own doc
// (`phases/governance-level-dynamic-and-legacy-cleanup.md`) for the full
// classification and rationale. `classifyTaskIntent`/`routeWorkflow` are
// the only, current, real entrypoint for classifying a request and
// resolving its process — a single architecture, not two competing ones.

const { classifyTaskIntent } = require('./governance/intent-model.js');
const { routeWorkflow } = require('./governance/workflow-router.js');

module.exports = {
  classifyTaskIntent,
  routeWorkflow,
};
