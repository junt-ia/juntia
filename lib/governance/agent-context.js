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

const { describeGovernanceLevel } = require('./governance-levels.js');

const CONTEXT_FILE = path.join('.juntia', 'context.md');

function workflowFilePath(workflowName) {
  return path.join('.juntia', 'governance', 'workflows', `${workflowName}.md`);
}

// buildAgentContext(route) -> {
//   task: { intent, confidence, needsClarification, reason },
//   workflow: { name, governanceLevel, baseGovernanceLevel, detectedSignals,
//     requiredReview, decisionTypes, decisionAreas, decisionGuidance } | null,
//   roles: string[],
//   skills: string[],
//   contextSources: string[],
// }
//
// `workflow.decisionTypes` (Phase 15F) — which decision type(s)
// ("product"/"architecture") this workflow itself names as something it may
// require a human to settle, read straight from `route.decisionTypes`.
// `workflow.decisionAreas` (Phase 15G) — the specific named areas within
// each type (e.g. `{ product: ["behavior", "balancing"] }`), same source.
// `workflow.decisionGuidance` (Phase 15G) — a short, fixed instruction for
// how seriously to treat those areas at this governance level (from
// `governance-levels.js`'s own registry, never computed from the request).
// `workflow.baseGovernanceLevel`/`workflow.detectedSignals`/
// `workflow.requiredReview` (Governance Level Dynamic) — `governanceLevel`
// is now the FINAL level after any declared signals were applied;
// `baseGovernanceLevel` is the workflow's own static default, unaffected by
// signals, so an agent can see whether (and why) the two differ. Additive
// fields only, defensively defaulted (`route.detectedSignals || []`) so a
// route object built before this addition still produces a valid context.
// Navigation, same as every other field here: it tells the agent WHICH KIND
// of question to expect and how urgently to treat it, never what the answer
// should be — this object never contains a decision, only the shape of one
// that might be needed.
function buildAgentContext(route) {
  const contextSources = [CONTEXT_FILE];
  if (route.workflow) contextSources.push(workflowFilePath(route.workflow));

  const levelInfo = route.governanceLevel ? describeGovernanceLevel(route.governanceLevel) : null;

  return {
    task: {
      intent: route.intent,
      confidence: route.confidence,
      needsClarification: route.needsClarification,
      reason: route.reason,
    },
    workflow: route.workflow
      ? {
        name: route.workflow,
        governanceLevel: route.governanceLevel,
        baseGovernanceLevel: route.baseGovernanceLevel || route.governanceLevel,
        detectedSignals: route.detectedSignals || [],
        requiredReview: route.requiredReview || [],
        decisionTypes: route.decisionTypes || [],
        decisionAreas: route.decisionAreas || {},
        decisionGuidance: levelInfo ? levelInfo.decisionGuidance : null,
      }
      : null,
    roles: route.roles,
    skills: route.skills,
    contextSources,
  };
}

module.exports = { buildAgentContext };
