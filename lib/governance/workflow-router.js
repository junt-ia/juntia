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

function emptyRoute({ intent, confidence, needsClarification, reason }) {
  return {
    intent,
    confidence,
    workflow: null,
    governanceLevel: null,
    roles: [],
    skills: [],
    needsClarification,
    reason,
  };
}

// routeWorkflow(text, projectRoot) -> {
//   intent, confidence, workflow, governanceLevel, roles, skills,
//   needsClarification, reason
// }
function routeWorkflow(text, projectRoot = process.cwd()) {
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

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    workflow: resolution.workflow.name,
    governanceLevel: resolution.workflow.governanceLevel,
    roles: resolution.workflow.roles,
    skills: resolution.workflow.skills,
    needsClarification: false,
    reason: classification.reason,
  };
}

module.exports = { routeWorkflow };
