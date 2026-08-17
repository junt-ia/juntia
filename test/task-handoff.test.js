'use strict';

// Phase 15C — tests for `lib/governance/task-handoff.js`: the Task Handoff,
// a real extension of the Agent Handoff model (Phase 13D) that now also
// hands an external agent the task type, workflow, governance level, and
// recommended roles/skills for a specific request — per this phase's own
// brief's exact example shape.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  TASK_HANDOFF_FILE, buildTaskHandoff, writeTaskHandoff, refreshTaskHandoffDecisions,
} = require('../lib/governance/task-handoff.js');
const { buildAgentContext } = require('../lib/governance/agent-context.js');

const REAL_ROUTE = {
  intent: 'feature',
  confidence: 0.9,
  workflow: 'feature-development',
  governanceLevel: 'standard',
  roles: ['product', 'architect', 'engineer', 'qa'],
  skills: ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy'],
  decisionTypes: ['product', 'architecture'],
  decisionAreas: { product: ['behavior', 'balancing'], architecture: ['data_model'] },
  needsClarification: false,
  reason: 'feature <- creation/capability language',
};

test('buildTaskHandoff names the task type, workflow, governance level, and every suggested role/skill from the brief\'s own example shape', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP en el restaurante.', REAL_ROUTE);
  assert.match(markdown, /Task type: Feature/);
  assert.match(markdown, /Workflow: feature-development/);
  assert.match(markdown, /Governance: STANDARD/);
  assert.match(markdown, /Suggested roles: Product, Architect, Engineer, QA/);
  assert.match(markdown, /Suggested skills: feature-planning, architecture-review, implementation, testing-strategy/);
});

test('buildTaskHandoff quotes the original request and points at project context files, never copying their content', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP en el restaurante.', REAL_ROUTE);
  assert.match(markdown, /Implementa clientes VIP en el restaurante\./);
  assert.match(markdown, /\.juntia\/context\.md/);
  assert.match(markdown, /\.juntia\/DECISIONS\.md/);
  assert.match(markdown, /\.juntia\/governance\/rules\/agent-rules\.md/);
});

test('buildTaskHandoff points at each real workflow/role/skill file by path', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  assert.match(markdown, /\.juntia\/governance\/workflows\/feature-development\.md/);
  assert.match(markdown, /\.juntia\/governance\/roles\/architect\.md/);
  assert.match(markdown, /\.juntia\/governance\/skills\/implementation\/SKILL\.md/);
});

// --- Phase 15D: the embedded Agent Context block ---

test('buildTaskHandoff embeds the real Agent Context as a fenced, parseable JSON block matching lib/governance/agent-context.js exactly', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP en el restaurante.', REAL_ROUTE);
  const match = markdown.match(/## Agent Context\n\n[^\n]*\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match, 'must contain a fenced JSON block under "## Agent Context"');

  const embedded = JSON.parse(match[1]);
  assert.deepEqual(embedded, buildAgentContext(REAL_ROUTE));
});

test('the embedded Agent Context never contains a solution — only navigation (real names and paths)', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  const match = markdown.match(/```json\n([\s\S]*?)\n```/);
  const embedded = JSON.parse(match[1]);
  assert.deepEqual(Object.keys(embedded).sort(), ['contextSources', 'roles', 'skills', 'task', 'workflow']);
});

test('buildTaskHandoff returns null when no workflow was resolved — never a handoff pointing at an invented process', () => {
  const ambiguousRoute = {
    intent: 'unknown', confidence: 0.2, workflow: null, governanceLevel: null, roles: [], skills: [], needsClarification: true, reason: 'no signal',
  };
  assert.equal(buildTaskHandoff('Hola', ambiguousRoute), null);
});

// --- Phase 15F/15G: the "Potential decisions" section — real mechanism,
// real named areas, only when relevant ---

test('buildTaskHandoff lists the real, named decision areas per type, matching the brief\'s own worked example shape', () => {
  const markdown = buildTaskHandoff('Implement customer reputation system.', REAL_ROUTE);
  assert.match(markdown, /## Potential decisions/);
  assert.match(markdown, /Product:\n- behavior\n- balancing/);
  assert.match(markdown, /Architecture:\n- data_model/);
});

test('buildTaskHandoff names the real decision-request mechanism and governance guidance, pointing at agent-rules.md for the exact document contract rather than duplicating a partial example', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  assert.match(markdown, /Governance: STANDARD — Escalate a potential decision area the moment it becomes concrete/);
  assert.match(markdown, /\.juntia\/pending\.json/);
  assert.match(markdown, /juntia confirm/);
  assert.match(markdown, /agent-rules\.md/);
  assert.match(markdown, /governance-review\/SKILL\.md/);
});

test('buildTaskHandoff frames potential decision areas as just-in-time, never a checklist to resolve before starting — the exact framing Phase 16B found broken', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  assert.match(markdown, /not a checklist to resolve before you/);
  assert.match(markdown, /can happen more than once across the same task/);
  assert.doesNotMatch(markdown, /before implementing/i);
});

test('a decision type with no named areas falls back to pointing at the workflow file\'s own section, never an empty list', () => {
  const routeWithNoAreas = { ...REAL_ROUTE, decisionAreas: {} };
  const markdown = buildTaskHandoff('Implementa clientes VIP.', routeWithNoAreas);
  assert.match(markdown, /Decisions this workflow may require/);
});

test('buildTaskHandoff omits the Potential decisions section entirely when the workflow declares no decision types — never an empty or padded section', () => {
  const routeWithNoDecisions = { ...REAL_ROUTE, decisionTypes: [] };
  const markdown = buildTaskHandoff('Analiza el sistema.', routeWithNoDecisions);
  assert.doesNotMatch(markdown, /## Potential decisions\n/);
});

test('buildTaskHandoff omits the Potential decisions section when decisionTypes is absent entirely (backward compatibility with a pre-15F route shape)', () => {
  const { decisionTypes, decisionAreas, ...routeWithoutField } = REAL_ROUTE;
  const markdown = buildTaskHandoff('Implementa clientes VIP.', routeWithoutField);
  assert.doesNotMatch(markdown, /## Potential decisions\n/);
});

// --- Governance Level Dynamic: the Base/Detected/Final/Required-review block ---

test('buildTaskHandoff prints only the plain "Governance: LEVEL" line when no signal was detected — unchanged from before this addition', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  assert.match(markdown, /Governance: STANDARD/);
  assert.doesNotMatch(markdown, /Detected signals:/);
  assert.doesNotMatch(markdown, /Required review:/);
});

test('buildTaskHandoff prints the full Base/Detected/Final/Required-review block, matching the brief\'s own worked example, when a signal escalated the route', () => {
  const escalatedRoute = {
    ...REAL_ROUTE,
    governanceLevel: 'strict',
    baseGovernanceLevel: 'standard',
    detectedSignals: [{ signal: 'architecture_change', level: 'strict', reason: 'x', decisionType: 'architecture' }],
    requiredReview: ['architecture'],
  };
  const markdown = buildTaskHandoff('Implementa clientes VIP en el restaurante.', escalatedRoute);
  assert.match(markdown, /Base governance: STANDARD/);
  assert.match(markdown, /Detected signals:\n- architecture_change/);
  assert.match(markdown, /Final governance: STRICT/);
  assert.match(markdown, /Required review: architecture decision/);
});

test('writeTaskHandoff writes to .juntia/task-handoff.md and returns the real path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-task-handoff-test-'));
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  const written = writeTaskHandoff(root, markdown);

  assert.equal(written, path.join(root, TASK_HANDOFF_FILE));
  assert.equal(fs.readFileSync(written, 'utf8'), markdown);
});

// --- Decision Continuity phase: the "## Confirmed decisions" section ---
//
// Real, evidenced gap: a live Snake dogfooding session confirmed a decision
// (via `juntia confirm`) that contradicted a provisional value the agent had
// already proposed, and the agent's own task-handoff.md never reflected it —
// two of four confirmed decisions never reached the game's code. These tests
// verify the fix at the module level; test/decision-continuity.test.js
// verifies the same failure mode end-to-end through the real CLI.

const TASK_STARTED_AT = '2025-06-01T00:00:00.000Z';

const BASELINE_PRODUCT_DECISION = {
  id: 'd1',
  type: 'product',
  question: 'How many lives does the player start with?',
  context: 'game start',
  options: ['1', '3'],
  evidence: [],
  text: '3',
  source: 'human',
  confirmedAt: '2020-01-01T00:00:00.000Z', // before TASK_STARTED_AT
  status: 'active',
};

const NEWLY_CONFIRMED_DECISION = {
  id: 'd2',
  type: 'product',
  question: 'How many points does eating food award?',
  context: 'scoring',
  options: ['1', 'grows with each food eaten'],
  evidence: [],
  text: 'Points must grow with each food eaten, not stay fixed at 1.',
  source: 'human',
  confirmedAt: '2030-01-01T00:00:00.000Z', // after TASK_STARTED_AT
  status: 'active',
};

const BASELINE_INTERPRETATION_DECISION = {
  id: 'd3',
  type: 'interpretation',
  text: 'This project uses Phaser as its main engine.',
  confidence: 'high',
  basedOn: ['dependency:phaser'],
  unknowns: [],
  source: 'human',
  confirmedAt: '2020-01-01T00:00:00.000Z',
  status: 'active',
};

test('with no decisions, the Confirmed decisions section reports "None yet" in both groups, never omitted', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, { generatedAt: TASK_STARTED_AT });
  assert.match(markdown, /## Confirmed decisions/);
  assert.match(markdown, /None yet\./);
  assert.match(markdown, /None of this workflow's own decision type\(s\) had a confirmed decision yet\./);
});

test('a decision confirmed before this task started is listed under "already known", never under "confirmed since"', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [BASELINE_PRODUCT_DECISION],
    generatedAt: TASK_STARTED_AT,
  });

  const known = markdown.split('Already known when this task started:')[1];
  assert.match(known, /How many lives does the player start with/);

  const since = markdown.split('Confirmed since this task started')[1].split('Already known')[0];
  assert.doesNotMatch(since, /How many lives does the player start with/);
});

test('a decision confirmed after this task started is flagged under "confirmed since" — this is the exact Snake bug: a decision that contradicts a provisional value must be visible, distinctly, to the agent', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [NEWLY_CONFIRMED_DECISION],
    generatedAt: TASK_STARTED_AT,
  });

  const since = markdown.split('Confirmed since this task started')[1].split('Already known')[0];
  assert.match(since, /How many points does eating food award/);
  assert.match(since, /Points must grow with each food eaten, not stay fixed at 1\./);
  // The original options considered are shown too — so the agent can compare
  // what it may have already assumed against what was actually confirmed.
  assert.match(since, /grows with each food eaten/);

  const known = markdown.split('Already known when this task started:')[1];
  assert.doesNotMatch(known, /How many points does eating food award/);
});

test('an interpretation-type decision confirmed before this task started is excluded from "already known" — only this workflow\'s own declared decision types are baseline-relevant', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [BASELINE_INTERPRETATION_DECISION],
    generatedAt: TASK_STARTED_AT,
  });
  const known = markdown.split('Already known when this task started:')[1];
  assert.doesNotMatch(known, /Phaser/);
});

test('an interpretation-type decision confirmed since this task started is still surfaced — a fresh decision is relevant regardless of type', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [{ ...BASELINE_INTERPRETATION_DECISION, confirmedAt: '2030-01-01T00:00:00.000Z' }],
    generatedAt: TASK_STARTED_AT,
  });
  const since = markdown.split('Confirmed since this task started')[1].split('Already known')[0];
  assert.match(since, /Phaser/);
});

test('a conflicted decision is still shown, flagged, never silently hidden', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [{ ...BASELINE_PRODUCT_DECISION, status: 'conflicted' }],
    generatedAt: TASK_STARTED_AT,
  });
  assert.match(markdown, /How many lives does the player start with.*\[CONFLICTED/);
});

test('multiple decisions, mixed product/architecture and mixed old/new, are all accounted for', () => {
  const archDecision = {
    id: 'd4',
    type: 'architecture',
    question: 'Should collision detection use a grid or brute force?',
    context: 'perf',
    options: ['grid', 'brute force'],
    evidence: [],
    text: 'grid',
    source: 'human',
    confirmedAt: '2030-02-01T00:00:00.000Z',
    status: 'active',
  };
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, {
    decisions: [BASELINE_PRODUCT_DECISION, NEWLY_CONFIRMED_DECISION, archDecision],
    generatedAt: TASK_STARTED_AT,
  });

  const since = markdown.split('Confirmed since this task started')[1].split('Already known')[0];
  assert.match(since, /eating food/);
  assert.match(since, /collision detection/);

  const known = markdown.split('Already known when this task started:')[1];
  assert.match(known, /How many lives does the player start with/);
});

test('buildTaskHandoff embeds a machine-only task-meta comment carrying the request text and generation timestamp, never inflating the human-facing Agent Context block', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, { generatedAt: TASK_STARTED_AT });
  assert.match(markdown, /<!-- juntia:task-meta \{.*"generatedAt":"2025-06-01T00:00:00\.000Z".*\} -->/);

  const match = markdown.match(/```json\n([\s\S]*?)\n```/);
  const embedded = JSON.parse(match[1]);
  assert.deepEqual(Object.keys(embedded).sort(), ['contextSources', 'roles', 'skills', 'task', 'workflow']);
});

// --- refreshTaskHandoffDecisions ---

test('refreshTaskHandoffDecisions returns null when no task-handoff.md exists yet', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-task-handoff-test-'));
  assert.equal(refreshTaskHandoffDecisions(root, []), null);
});

test('refreshTaskHandoffDecisions leaves a pre-phase task-handoff.md (no task-meta comment) untouched — never crashes, never a regression for existing projects', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-task-handoff-test-'));
  const legacyPath = path.join(root, '.juntia', 'task-handoff.md');
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  const legacyContent = '<!-- juntia:generated -->\n# Task Handoff\n\nsome pre-phase content\n';
  fs.writeFileSync(legacyPath, legacyContent);

  const result = refreshTaskHandoffDecisions(root, [NEWLY_CONFIRMED_DECISION]);

  assert.equal(result, null);
  assert.equal(fs.readFileSync(legacyPath, 'utf8'), legacyContent);
});

test('refreshTaskHandoffDecisions regenerates task-handoff.md in place, preserving the original request/route/generatedAt while reflecting fresh decisions — the real mechanism `juntia confirm` uses', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-task-handoff-test-'));
  const original = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, { generatedAt: TASK_STARTED_AT });
  writeTaskHandoff(root, original);

  const refreshedPath = refreshTaskHandoffDecisions(root, [NEWLY_CONFIRMED_DECISION]);
  assert.equal(refreshedPath, path.join(root, TASK_HANDOFF_FILE));

  const refreshed = fs.readFileSync(refreshedPath, 'utf8');
  // Same task, same original request text and start time — never re-classified.
  assert.match(refreshed, /Implementa clientes VIP\./);
  assert.match(refreshed, /"generatedAt":"2025-06-01T00:00:00\.000Z"/);
  // The newly confirmed decision now appears, flagged.
  const since = refreshed.split('Confirmed since this task started')[1].split('Already known')[0];
  assert.match(since, /Points must grow with each food eaten, not stay fixed at 1\./);
});

test('refreshTaskHandoffDecisions is idempotent — running it again with the same decisions produces byte-identical output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-task-handoff-test-'));
  writeTaskHandoff(root, buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE, { generatedAt: TASK_STARTED_AT }));

  refreshTaskHandoffDecisions(root, [NEWLY_CONFIRMED_DECISION]);
  const first = fs.readFileSync(path.join(root, TASK_HANDOFF_FILE), 'utf8');
  refreshTaskHandoffDecisions(root, [NEWLY_CONFIRMED_DECISION]);
  const second = fs.readFileSync(path.join(root, TASK_HANDOFF_FILE), 'utf8');

  assert.equal(first, second);
});
