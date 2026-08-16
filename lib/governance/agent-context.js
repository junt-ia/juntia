'use strict';

// Agent Context — Phase 15D of the Juntia migration.
//
// Reshapes Phase 15C's flat `routeWorkflow()` result into the nested,
// navigation-shaped contract this phase's own brief defines exactly:
// `{ task: { intent, confidence }, workflow: { name, governanceLevel },
// roles, skills, contextSources }`. This is the real, structured object an
// external agent receives — never a solution, only navigation: which real
// files answer this request, not what to do with them.
//
// Deliberately a pure transform, no new decision logic: every field traces
// directly to `workflow-router.js`'s own already-computed result.
// `contextSources` is the one field this module adds — a short, minimal
// list of real file paths (never file *content*) grounded in what actually
// exists for this route: `.juntia/context.md` always, plus the resolved
// workflow's own Knowledge Layer file when one was resolved. Matches the
// brief's own worked example exactly (two entries for a resolved feature
// request), not an exhaustive index of every role/skill file — an agent
// already has those paths from `roles`/`skills` plus the Knowledge Layer's
// own, real, well-known directory convention (`.juntia/governance/roles/
// <role>.md`, `.juntia/governance/skills/<skill>/SKILL.md`).

const path = require('path');

const CONTEXT_FILE = path.join('.juntia', 'context.md');

function workflowFilePath(workflowName) {
  return path.join('.juntia', 'governance', 'workflows', `${workflowName}.md`);
}

// buildAgentContext(route) -> {
//   task: { intent, confidence, needsClarification, reason },
//   workflow: { name, governanceLevel } | null,
//   roles: string[],
//   skills: string[],
//   contextSources: string[],
// }
function buildAgentContext(route) {
  const contextSources = [CONTEXT_FILE];
  if (route.workflow) contextSources.push(workflowFilePath(route.workflow));

  return {
    task: {
      intent: route.intent,
      confidence: route.confidence,
      needsClarification: route.needsClarification,
      reason: route.reason,
    },
    workflow: route.workflow
      ? { name: route.workflow, governanceLevel: route.governanceLevel }
      : null,
    roles: route.roles,
    skills: route.skills,
    contextSources,
  };
}

module.exports = { buildAgentContext };
