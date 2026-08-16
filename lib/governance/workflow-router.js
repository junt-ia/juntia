'use strict';

// Workflow Routing Engine — Phase 15C of the Juntia migration.
//
// The real entrypoint this phase's brief describes: turns a free-text
// request into the structured work framework an external agent needs —
// intent, confidence, workflow, governance level, roles, skills — by
// composing `intent-model.js` (classification) with `workflow-knowledge.js`
// (Knowledge Layer resolution). Owns no interpretation logic of its own.
//
// ARCHITECTURAL BOUNDARY: this module decides WHICH PROCESS to follow for a
// request — never WHAT TO BUILD or HOW. "Juntia clasifica la petición y
// determina el proceso adecuado para que un agente resuelva la tarea," not
// "Juntia entiende la petición y propone una solución."
//
// Never invents a workflow. An `unknown`/low-confidence intent, or a
// classified intent whose Knowledge Layer workflow can't be resolved
// (project never scaffolded, or a hand-edited file this parser can't read),
// both return `workflow: null` and `needsClarification: true` — the caller
// (a human or an external agent) is expected to ask, not guess.

const { classifyTaskIntent } = require('./intent-model.js');
const { resolveWorkflowForIntent } = require('./workflow-knowledge.js');
const { loadGovernanceSignals, evaluateGovernanceLevel } = require('./governance-signals.js');

function emptyRoute({ intent, confidence, needsClarification, reason }) {
  return {
    intent,
    confidence,
    workflow: null,
    governanceLevel: null,
    baseGovernanceLevel: null,
    detectedSignals: [],
    requiredReview: [],
    roles: [],
    skills: [],
    decisionTypes: [],
    decisionAreas: {},
    needsClarification,
    reason,
  };
}

// routeWorkflow(text, projectRoot, { signals }) -> {
//   intent, confidence, workflow, governanceLevel, baseGovernanceLevel,
//   detectedSignals, requiredReview, roles, skills, decisionTypes,
//   decisionAreas, needsClarification, reason
// }
//
// `decisionTypes` (Phase 15F) — which decision type(s) this workflow itself
// names as something it may require a human to settle ("product",
// "architecture", both, or neither) — read from the same Knowledge Layer
// file as everything else here, never computed or guessed by this module.
// `decisionAreas` (Phase 15G) — the specific, named areas within each type
// (e.g. `{ product: ["behavior", "balancing"] }`) — same source, same
// discipline: read, never computed.
//
// Governance Level Dynamic — `signals` is a caller-declared array of signal
// names (never computed from `text`; see `governance-signals.js`'s own
// architectural boundary). `baseGovernanceLevel` is always the workflow's
// own static default, read exactly as before. `governanceLevel` is now the
// FINAL level: with no `signals` passed (or none of them recognized),
// `governanceLevel` equals `baseGovernanceLevel`, byte-identical to every
// caller's pre-existing behavior; a recognized signal can escalate or
// de-escalate it. `detectedSignals`/`requiredReview` come straight from
// `evaluateGovernanceLevel` — see that module for the escalation rule.
function routeWorkflow(text, projectRoot = process.cwd(), { signals = [] } = {}) {
  const classification = classifyTaskIntent(text);

  if (classification.intent === 'unknown') {
    return emptyRoute(classification);
  }

  const resolution = resolveWorkflowForIntent(projectRoot, classification.intent);
  if (!resolution.ok) {
    return emptyRoute({
      intent: classification.intent,
      confidence: classification.confidence,
      needsClarification: true,
      reason: `Intent classified as "${classification.intent}" but its workflow could not be resolved: ${resolution.reason}`,
    });
  }

  const baseGovernanceLevel = resolution.workflow.governanceLevel;
  const signalsResult = loadGovernanceSignals(projectRoot);
  const { detectedSignals, finalLevel, requiredReview } = evaluateGovernanceLevel({
    baseLevel: baseGovernanceLevel,
    declaredSignals: signals,
    catalogSignals: signalsResult.ok ? signalsResult.signals : [],
  });

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    workflow: resolution.workflow.name,
    governanceLevel: finalLevel,
    baseGovernanceLevel,
    detectedSignals,
    requiredReview,
    roles: resolution.workflow.roles,
    skills: resolution.workflow.skills,
    decisionTypes: resolution.workflow.decisionTypes,
    decisionAreas: resolution.workflow.decisionAreas,
    needsClarification: false,
    reason: classification.reason,
  };
}

module.exports = { routeWorkflow };
