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
//
// Decision Continuity phase: closes the real gap a live Snake dogfooding
// session found — `juntia confirm` already regenerated `.juntia/context.md`
// (Phase 12K), but never this file, the one an agent is actually mid-task
// against. Two of four confirmed decisions never reached the game's code
// because nothing told the agent a decision had changed since it started
// working. `buildTaskHandoff` now also embeds a `## Confirmed decisions`
// section, split into what was already confirmed when this task started
// (baseline) and what got confirmed since (flagged — may contradict a
// provisional value already chosen). `refreshTaskHandoffDecisions` lets
// `juntia confirm` regenerate just that section, in place, without
// re-classifying the request: the task's own workflow/roles/skills never
// change just because a decision was confirmed, so the SAME `buildTaskHandoff`
// is called again with the same `text`/`route` and the current decisions —
// recovered from the file itself via a small, machine-only comment
// (`<!-- juntia:task-meta ... -->` for `text`/`generatedAt`; `route` is
// re-derived from the already-embedded Agent Context JSON block rather than
// duplicated a second time, keeping this file's own real "stay small,
// pointer-shaped" budget — see test/agent-consumption-model.test.js).

const fs = require('fs');
const path = require('path');

const { buildAgentContext } = require('./agent-context.js');
const { computeTaskStatus } = require('./task-status.js');

const TASK_HANDOFF_FILE = path.join('.juntia', 'task-handoff.md');
const TASK_META_PATTERN = /<!-- juntia:task-meta (.*?) -->/;
const AGENT_CONTEXT_BLOCK_PATTERN = /## Agent Context\n\n[^\n]*\n\n```json\n([\s\S]*?)\n```/;

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
// just that Juntia "has a concept" for it somewhere. Just-In-Time Governance
// phase: the closing prose below no longer frames this as a single review
// pass done once "before implementing" (Phase 15G's own original framing) —
// a second real dogfooding session (Phase 16B) found that framing taught
// agents to check once, early, and never again, which is exactly how a
// decision that only became concrete mid-implementation slipped through
// unconfirmed. These areas are named up front so an agent knows what CAN
// come up, never as a checklist to resolve before starting. Returns `[]`
// (no lines, section omitted entirely) when the workflow names no decision
// type at all — the same "absence is real, not padded" discipline every
// other optional section in this codebase follows.
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
    'These are potential decision areas this workflow commonly touches — not a checklist to resolve before you',
    'start, and not something Juntia has already decided applies here. The moment one becomes concretely',
    'relevant to the specific piece of work in front of you — during any step, not only up front — escalate it',
    'via `.juntia/governance/skills/governance-review/SKILL.md`; most requests resolve most areas from their',
    'own stated content or an existing decision without ever needing to. For a genuinely open one, write a',
    'decision request to `.juntia/pending.json` (see `.juntia/governance/rules/agent-rules.md` for the exact',
    'document contract) — a question, never a proposed answer. A human answers it via `juntia confirm`; only',
    'that answer becomes a real decision, and this can happen more than once across the same task as different',
    'areas become concrete at different points.',
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

// One line per confirmed decision — the question (for product/architecture)
// or the interpreted text (for a fact interpretation) alongside the real,
// human-confirmed answer, so an agent can compare it against whatever it
// already assumed without needing to remember a prior conversation turn.
// `status: 'conflicted'` (Phase 12K's own evidence-conflict mechanism) is
// flagged, never hidden — a decision Juntia can no longer ground in current
// facts is still a real decision until a human reviews it.
function formatConfirmedDecision(d) {
  const flag = d.status === 'conflicted' ? ' [CONFLICTED — evidence changed, see .juntia/context.md]' : '';
  const date = d.confirmedAt.slice(0, 10);
  if (d.type === 'product' || d.type === 'architecture') {
    const lines = [`- Q: "${d.question}" -> CONFIRMED: ${d.text}${flag} (${d.type} decision, ${date})`];
    if (Array.isArray(d.options) && d.options.length > 0) {
      lines.push(`  (options on the table when asked: ${d.options.join(', ')})`);
    }
    return lines.join('\n');
  }
  return `- ${d.text}${flag} (confirmed ${date}, based on: ${d.basedOn.join(', ')})`;
}

// buildConfirmedDecisionsSection(route, decisions, generatedAt) -> lines[]
//
// The real mechanism this phase adds: distinguishes a decision the agent
// already knew about when this task started (baseline — filtered to this
// workflow's own declared decisionTypes, the same "relevant, not the whole
// DECISIONS.md" discipline `buildDecisionsSection` already established) from
// one confirmed AFTER — never filtered by type, because a decision that
// emerged mid-task is relevant to the task by construction. "New" is scoped
// to THIS task's own lifetime: a fresh `juntia route` call resets
// `generatedAt`, so a later task never keeps re-flagging something an
// earlier task already had the chance to act on — the smallest state
// machine that distinguishes "already known" from "needs your attention"
// without Juntia ever asserting a decision WAS applied to code, something it
// has no way to verify (it never patches source itself).
function buildConfirmedDecisionsSection(route, decisions, generatedAt) {
  const sinceTaskStarted = decisions.filter((d) => d.confirmedAt >= generatedAt);
  const relevantTypes = route.decisionTypes || [];
  const alreadyKnown = decisions.filter((d) => d.confirmedAt < generatedAt && relevantTypes.includes(d.type));

  const lines = ['## Confirmed decisions', ''];

  lines.push(
    'Confirmed since this task started — re-check before finishing, even if it contradicts what you already',
    'proposed or implemented:',
    '',
  );
  lines.push(...(sinceTaskStarted.length === 0 ? ['None yet.'] : sinceTaskStarted.map(formatConfirmedDecision)));
  lines.push('');

  lines.push('Already known when this task started:', '');
  if (alreadyKnown.length === 0) {
    lines.push(relevantTypes.length > 0
      ? "None of this workflow's own decision type(s) had a confirmed decision yet."
      : 'This workflow declares no product/architecture decision type — see `.juntia/DECISIONS.md` for the full history.');
  } else {
    lines.push(...alreadyKnown.map(formatConfirmedDecision));
  }
  lines.push('');

  return lines;
}

// One pending, blocking decision request, rendered exactly as the brief's
// own worked example shapes it: the question, the affected area (the
// agent's own `context` field — already exactly this purpose), which
// workflow it's blocking (the CURRENT task's own — never stored per-item,
// always the real, current one), and why it needs confirmation (the
// agent's own optional `reason`, verbatim — never invented when absent).
function formatPendingDecision(item, route) {
  const lines = [`- "${item.question}" (${item.type} decision, workflow: ${route.workflow})`];
  if (item.context) lines.push(`  Affected area: ${item.context}`);
  lines.push(`  Reason requiring confirmation: ${item.reason || 'escalated by the agent as requiring human confirmation before continuing'}`);
  return lines.join('\n');
}

// buildTaskStatusSection(taskStatus, blockingPending, route) -> lines[]
//
// Governance In-Flow phase: the real, deterministic signal this phase adds
// — printed first, right after the request itself, so an agent (or a human
// skimming the file) sees it before anything else. `taskStatus` is never
// computed here — it's the same value `agent-context.js#computeTaskStatus`
// already produced, passed straight through, so the prose and the embedded
// JSON block below can never disagree about it.
function buildTaskStatusSection(taskStatus, blockingPending, route) {
  const lines = ['## Task Status', '', taskStatus, ''];

  if (taskStatus === 'WAITING_HUMAN_CONFIRMATION') {
    lines.push(
      'The agent must not continue affected implementation until the pending decision is confirmed.',
      '',
      'Pending decisions:',
      '',
      ...blockingPending.map((item) => formatPendingDecision(item, route)),
      '',
    );
  } else if (taskStatus === 'READY_TO_CONTINUE') {
    lines.push(
      'A decision that was blocking part of this task has just been confirmed — see "Confirmed decisions"',
      'below for the real answer, then continue the work that was waiting on it.',
      '',
    );
  }

  return lines;
}

// buildTaskHandoff(text, route, { decisions, generatedAt, blockingPending }) ->
// markdown string, or null when `route` has no resolved workflow. Per this
// phase's own explicit "una petición ambigua nunca debe producir un workflow
// falso": this function refuses to produce a handoff pointing at an
// invented process — the caller is expected to surface `route.reason` and
// ask for clarification instead.
//
// `decisions` (Decision Continuity phase) — the project's current confirmed
// decisions (`decisions-store.js`'s own shape), defaulted to `[]` so every
// pre-existing caller (including every test written before this phase)
// keeps working unchanged. `generatedAt` anchors this specific task's own
// "when did I start" baseline for `buildConfirmedDecisionsSection` above;
// defaults to now, matching a fresh `juntia route` call, and is the one
// value `refreshTaskHandoffDecisions` below deliberately preserves across a
// later regeneration instead of resetting it. `blockingPending` (Governance
// In-Flow phase) — the project's currently pending, valid product/
// architecture decision requests; defaulted to `[]`, same backward-
// compatibility discipline.
function buildTaskHandoff(text, route, options = {}) {
  if (!route || !route.workflow) return null;
  const {
    decisions = [], generatedAt = new Date().toISOString(), blockingPending = [],
  } = options;

  const agentContext = buildAgentContext(route, { blockingPending, decisions, generatedAt });

  const lines = [
    '<!-- juntia:generated -->',
    `<!-- juntia:task-meta ${JSON.stringify({ text, generatedAt })} -->`,
    '# Task Handoff',
    '',
    'Juntia classified this request and resolved the process to follow. Juntia does not decide HOW to build',
    'this — that reasoning, planning, and implementation stay entirely yours.',
    '',
    '## Request',
    '',
    `> ${text}`,
    '',
    ...buildTaskStatusSection(agentContext.taskStatus, blockingPending, route),
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
    ...buildConfirmedDecisionsSection(route, decisions, generatedAt),
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

// The inverse of `buildAgentContext` (`agent-context.js`) — recovers a
// flat `route`-shaped object from the exact JSON this file already embeds
// under `## Agent Context`, so `refreshTaskHandoffDecisions` never needs a
// second, redundant copy of it (see this file's own header for why that
// matters for the real, tested size budget). Every field it reads back was
// written by `buildAgentContext` with no lossy transform in between.
function routeFromAgentContext(ctx) {
  return {
    intent: ctx.task.intent,
    confidence: ctx.task.confidence,
    needsClarification: ctx.task.needsClarification,
    reason: ctx.task.reason,
    workflow: ctx.workflow.name,
    governanceLevel: ctx.workflow.governanceLevel,
    baseGovernanceLevel: ctx.workflow.baseGovernanceLevel,
    detectedSignals: ctx.workflow.detectedSignals,
    requiredReview: ctx.workflow.requiredReview,
    decisionTypes: ctx.workflow.decisionTypes,
    decisionAreas: ctx.workflow.decisionAreas,
    roles: ctx.roles,
    skills: ctx.skills,
  };
}

// Reads back exactly what `buildTaskHandoff` embedded: `text`/`generatedAt`
// from the small `<!-- juntia:task-meta ... -->` comment, and `route` from
// the already-present Agent Context JSON block. Returns `null` for anything
// that doesn't match — malformed JSON in either spot, or a task-handoff.md
// written before this phase existed (no `task-meta` comment at all) — never
// throws, same never-crash-on-unrecognized-content discipline every store
// in this codebase already follows (`facts-store.js`, `pending-store.js`,
// `decisions-store.js`).
function parseTaskState(markdown) {
  const metaMatch = markdown.match(TASK_META_PATTERN);
  const contextMatch = markdown.match(AGENT_CONTEXT_BLOCK_PATTERN);
  if (!metaMatch || !contextMatch) return null;

  let meta;
  let agentContext;
  try {
    meta = JSON.parse(metaMatch[1]);
    agentContext = JSON.parse(contextMatch[1]);
  } catch {
    return null;
  }
  if (typeof meta.text !== 'string' || typeof meta.generatedAt !== 'string') return null;
  if (!agentContext.task || !agentContext.workflow) return null;

  return { text: meta.text, generatedAt: meta.generatedAt, route: routeFromAgentContext(agentContext) };
}

// refreshTaskHandoffDecisions(projectRoot, decisions, blockingPending) ->
// path | null
//
// The real mechanism `juntia confirm` calls after recording a decision: if
// `.juntia/task-handoff.md` currently exists AND was written by this (or a
// later) version of Juntia, regenerate it — same `text`/`route`/
// `generatedAt` as before (no re-classification: confirming a decision never
// changes which workflow/roles/skills apply), fresh `decisions` and
// `blockingPending` (Governance In-Flow phase — whatever pending decisions
// are still outstanding after this confirm run, so a still-unanswered item
// keeps showing WAITING_HUMAN_CONFIRMATION rather than silently vanishing).
// This is the one piece of state that makes a confirmed decision an
// "instruction for unfinished work," not just history: the agent's own
// active task file now carries it, flagged as new, without needing to have
// been present when `confirm` ran or to remember a prior conversation turn.
// Never touches source code — this only ever rewrites Juntia's own
// generated navigation file, the same class of operation
// `writeContext`/`writeBootstrap` already are. A pre-phase task-handoff.md
// (no recoverable state) or none at all is left exactly as-is — not a
// regression, just nothing new to refresh yet.
function refreshTaskHandoffDecisions(projectRoot, decisions, blockingPending = []) {
  const targetPath = path.join(projectRoot, TASK_HANDOFF_FILE);
  if (!fs.existsSync(targetPath)) return null;

  const state = parseTaskState(fs.readFileSync(targetPath, 'utf8'));
  if (!state) return null;

  const markdown = buildTaskHandoff(state.text, state.route, {
    decisions, generatedAt: state.generatedAt, blockingPending,
  });
  if (!markdown) return null;

  writeTaskHandoff(projectRoot, markdown);
  return targetPath;
}

module.exports = {
  TASK_HANDOFF_FILE, buildTaskHandoff, writeTaskHandoff, refreshTaskHandoffDecisions,
};
