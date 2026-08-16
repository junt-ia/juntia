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

// buildTaskHandoff(text, route) -> markdown string, or null when `route` has
// no resolved workflow. Per this phase's own explicit "una petición
// ambigua nunca debe producir un workflow falso": this function refuses to
// produce a handoff pointing at an invented process — the caller is
// expected to surface `route.reason` and ask for clarification instead.
function buildTaskHandoff(text, route) {
  if (!route || !route.workflow) return null;

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
    `Suggested roles: ${route.roles.length ? route.roles.map(titleCase).join(', ') : 'none'}`,
    `Suggested skills: ${route.skills.length ? route.skills.join(', ') : 'none'}`,
    '',
    '## Agent Context',
    '',
    'The same information above, structured for programmatic use — navigation, never a solution:',
    '',
    '```json',
    JSON.stringify(buildAgentContext(route), null, 2),
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
