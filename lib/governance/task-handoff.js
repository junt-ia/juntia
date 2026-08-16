'use strict';

// Task Handoff — Phase 15C of the Juntia migration.
//
// Extends the Agent Handoff model Phase 13D built (`agent-handoff.js`,
// `.juntia/agent-instructions.md` — how to interpret a project's facts) with
// a second, distinct handoff for a specific request: what kind of work this
// is, which workflow to follow, what governance level applies, and which
// roles/skills are recommended. Deliberately a separate file
// (`.juntia/task-handoff.md`), not folded into `agent-instructions.md` —
// that file answers "what is this project," this one answers "what should I
// do with this specific request," a genuinely different question with a
// genuinely different lifecycle (refreshed per request, not per scan).
//
// Same "pointer, not a copy" discipline `agent-integration.js`/
// `agent-handoff.js` already established: every file named below is
// referenced by path, never inlined.
//
// Phase 15D: the markdown below now also embeds the real Agent Context
// object (`lib/governance/agent-context.js`) as a fenced JSON block — the
// brief's own exact structured-navigation contract — so an agent that wants
// to parse this file programmatically doesn't have to re-derive it from
// prose. The prose sections are unchanged in meaning from Phase 15C; the
// JSON block is additive, not a replacement.

const fs = require('fs');
const path = require('path');

const { buildAgentContext } = require('./agent-context.js');

const TASK_HANDOFF_FILE = path.join('.juntia', 'task-handoff.md');

function titleCase(word) {
  if (word.toLowerCase() === 'qa') return 'QA';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Phase 15F/15G: names which decision type(s) — and, since 15G, which
// specific named area(s) within each — this workflow may require a human to
// settle. Real, evidenced need, per the restaurant-game dogfooding finding
// both phases are grounded in (see decision-model.js's/decision-triggers.js's
// own headers): an agent following a workflow, mid-task, needs to know the
// actual mechanism for escalating a real product/architecture unknown, not
// just that Juntia "has a concept" for it somewhere — and needs it framed as
// something to check BEFORE implementing, the real gap Phase 15G closes.
// Returns `[]` (no lines, section omitted entirely) when the workflow names
// no decision type at all — the same "absence is real, not padded"
// discipline every other optional section in this codebase follows.
function buildDecisionsSection(route, agentContext) {
  if (!route.decisionTypes || route.decisionTypes.length === 0) return [];
  const areas = route.decisionAreas || {};
  const guidance = agentContext.workflow ? agentContext.workflow.decisionGuidance : null;

  const lines = ['## Potential decisions', ''];
  for (const type of route.decisionTypes) {
    const typeAreas = areas[type] || [];
    lines.push(`${titleCase(type)}:`);
    if (typeAreas.length > 0) {
      for (const area of typeAreas) lines.push(`- ${area}`);
    } else {
      lines.push('- (see this workflow\'s own "Decisions this workflow may require" section for what to watch for)');
    }
    lines.push('');
  }

  lines.push(`Governance: ${route.governanceLevel ? route.governanceLevel.toUpperCase() : 'unknown'}${guidance ? ` — ${guidance}` : ''}`);
  lines.push('');
  lines.push(
    'These are potential decision areas this workflow commonly touches — not a checklist to fill out',
    'mechanically, and not something Juntia has already decided applies here. Review each against the real',
    'request before implementing (see `.juntia/governance/skills/governance-review/SKILL.md`); most requests',
    'resolve most areas from their own stated content or an existing decision. For any that are genuinely',
    'open, write a decision request to `.juntia/pending.json`: `{ "type": "product"|"architecture",',
    '"question": "...", "context": "...", "options": [...] }` — a question, never a proposed answer. A human',
    'answers it via `juntia confirm`; only that answer becomes a real decision.',
    '',
  );
  return lines;
}

// Governance Level Dynamic — printed only when at least one declared signal
// was actually recognized (`route.detectedSignals` non-empty); the ordinary,
// no-signal case keeps the single `Governance: LEVEL` line above unchanged.
// Matches the brief's own worked example almost verbatim: Workflow / Base
// governance / Detected signals / Final governance / Required review.
function buildGovernanceSignalsSection(route) {
  const detected = route.detectedSignals || [];
  if (detected.length === 0) return [];

  const lines = [
    `Base governance: ${route.baseGovernanceLevel ? route.baseGovernanceLevel.toUpperCase() : 'unknown'}`,
    'Detected signals:',
    ...detected.map((s) => `- ${s.signal}`),
    `Final governance: ${route.governanceLevel ? route.governanceLevel.toUpperCase() : 'unknown'}`,
  ];
  const requiredReview = route.requiredReview || [];
  if (requiredReview.length > 0) {
    lines.push(`Required review: ${requiredReview.map((t) => `${t} decision`).join(', ')}`);
  }
  lines.push('');
  return lines;
}

// buildTaskHandoff(text, route) -> markdown string, or null when `route` has
// no resolved workflow. Per this phase's own explicit "una petición
// ambigua nunca debe producir un workflow falso": this function refuses to
// produce a handoff pointing at an invented process — the caller is
// expected to surface `route.reason` and ask for clarification instead.
function buildTaskHandoff(text, route) {
  if (!route || !route.workflow) return null;

  const agentContext = buildAgentContext(route);

  const lines = [
    '<!-- juntia:generated -->',
    '# Task Handoff',
    '',
    'Juntia classified this request and resolved the process to follow. Juntia does not decide HOW to build',
    'this — that reasoning, planning, and implementation stay entirely yours.',
    '',
    '## Request',
    '',
    `> ${text}`,
    '',
    `Task type: ${titleCase(route.intent)}`,
    `Confidence: ${route.confidence}`,
    '',
    `Workflow: ${route.workflow}`,
    `Governance: ${route.governanceLevel ? route.governanceLevel.toUpperCase() : 'unknown'}`,
    '',
    ...buildGovernanceSignalsSection(route),
    `Suggested roles: ${route.roles.length ? route.roles.map(titleCase).join(', ') : 'none'}`,
    `Suggested skills: ${route.skills.length ? route.skills.join(', ') : 'none'}`,
    '',
    ...buildDecisionsSection(route, agentContext),
    '## Agent Context',
    '',
    'The same information above, structured for programmatic use — navigation, never a solution:',
    '',
    '```json',
    JSON.stringify(agentContext, null, 2),
    '```',
    '',
    '## Where to find each of these',
    '',
    `- \`.juntia/governance/workflows/${route.workflow}.md\` — the full process this workflow recommends.`,
    ...route.roles.map((r) => `- \`.juntia/governance/roles/${r}.md\` — the ${titleCase(r)} perspective.`),
    ...route.skills.map((s) => `- \`.juntia/governance/skills/${s}/SKILL.md\` — the ${s} procedure.`),
    '',
    '## Project context',
    '',
    '- `.juntia/context.md` — what this project is: confirmed facts, technologies, structure.',
    '- `.juntia/DECISIONS.md` — what has already been decided, and why.',
    '- `.juntia/governance/rules/agent-rules.md` — how to behave in this project.',
    '',
    'Juntia does not control what you do — it defines the environment you work in. You reason within it.',
    '',
  ];
  return lines.join('\n');
}

function writeTaskHandoff(projectRoot, markdown) {
  const targetPath = path.join(projectRoot, TASK_HANDOFF_FILE);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, markdown);
  return targetPath;
}

module.exports = { TASK_HANDOFF_FILE, buildTaskHandoff, writeTaskHandoff };
