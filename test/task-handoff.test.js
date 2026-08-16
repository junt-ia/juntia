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

const { TASK_HANDOFF_FILE, buildTaskHandoff, writeTaskHandoff } = require('../lib/governance/task-handoff.js');
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

test('buildTaskHandoff names the real decision-request mechanism and governance guidance', () => {
  const markdown = buildTaskHandoff('Implementa clientes VIP.', REAL_ROUTE);
  assert.match(markdown, /Governance: STANDARD — Review the potential decision areas/);
  assert.match(markdown, /\.juntia\/pending\.json/);
  assert.match(markdown, /juntia confirm/);
  assert.match(markdown, /"type": "product"\|"architecture"/);
  assert.match(markdown, /governance-review\/SKILL\.md/);
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
