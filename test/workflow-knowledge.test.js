'use strict';

// Phase 15C — tests for `lib/governance/workflow-knowledge.js`: the module
// that resolves a real, declared workflow (roles/skills/governance level)
// for a given intent by reading `.juntia/governance/workflows/*.md` — the
// Knowledge Layer Phase 15B shipped — never duplicating that content in
// JavaScript. Verifies the parser against the real template files directly
// (no fixture stands in for them) and every "cannot resolve honestly" path.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { init } = require('../bin/juntia.js');
const {
  INTENT_WORKFLOW_FILE, parseWorkflowMarkdown, resolveWorkflowForIntent,
} = require('../lib/governance/workflow-knowledge.js');

const TEMPLATES_WORKFLOWS = path.join(__dirname, '..', 'templates', 'governance', 'workflows');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-workflow-knowledge-test-'));
}

test('INTENT_WORKFLOW_FILE maps every one of Phase 15C\'s four intents to a real, existing template file', () => {
  for (const [intent, filename] of Object.entries(INTENT_WORKFLOW_FILE)) {
    assert.ok(['feature', 'bug', 'investigation', 'refactor'].includes(intent));
    assert.ok(fs.existsSync(path.join(TEMPLATES_WORKFLOWS, filename)), `${filename} must exist for intent "${intent}"`);
  }
});

// --- Parsing the real, unmodified Phase 15B template files ---

test('parses feature-development.md into its real roles/skills/governance level, exactly as declared', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'feature-development.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'feature-development');
  assert.deepEqual(parsed.roles, ['product', 'architect', 'engineer', 'qa']);
  assert.deepEqual(parsed.skills, ['feature-planning', 'architecture-review', 'governance-review', 'implementation', 'testing-strategy']);
  assert.equal(parsed.governanceLevel, 'standard');
  assert.deepEqual(parsed.decisionTypes, ['product', 'architecture']);
});

test('parses feature-development.md\'s real, named decision areas per type (Phase 15G)', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'feature-development.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'feature-development');
  assert.deepEqual(parsed.decisionAreas, {
    product: ['behavior', 'user_experience', 'scope', 'balancing'],
    architecture: ['data_model', 'module_boundary', 'dependency_choice'],
  });
});

test('parses bug-fix.md into its real roles/skills/governance level (LIGHT by default)', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'bug-fix.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'bug-fix');
  assert.deepEqual(parsed.roles, ['qa', 'engineer', 'architect']);
  assert.deepEqual(parsed.skills, ['implementation', 'testing-strategy']);
  assert.equal(parsed.governanceLevel, 'light');
});

// Phase 15G: bug-fix.md now names both decision types explicitly (architecture
// first, since it's the more common one; product is real but rare) — a
// refinement over Phase 15F's own decisionTypes: ['architecture'] alone.
test('parses bug-fix.md\'s decision types and areas — architecture (common) and product (rare, but real)', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'bug-fix.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'bug-fix');
  assert.deepEqual([...parsed.decisionTypes].sort(), ['architecture', 'product']);
  assert.deepEqual(parsed.decisionAreas, {
    architecture: ['regression_source', 'compatibility'],
    product: ['expected_behavior'],
  });
});

test('parses investigation.md, ignoring its non-bolded "whichever role matches" caveat line', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'investigation.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'investigation');
  assert.deepEqual(parsed.roles, ['product', 'architect']);
  assert.deepEqual(parsed.skills, ['architecture-review']);
  assert.equal(parsed.governanceLevel, 'light');
});

// Phase 15G refinement: investigation.md now names an architecture decision
// area (`technical_direction`) it commonly surfaces as a byproduct of
// answering a question, even though it never writes a decision request
// itself — see phases/15g-decision-discovery.md for why this is a real
// refinement over Phase 15F's "None, by design," not a contradiction of it.
test('investigation.md now names the one real decision area it commonly surfaces (technical_direction), while still never writing a decision itself', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'investigation.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'investigation');
  assert.deepEqual(parsed.decisionTypes, ['architecture']);
  assert.deepEqual(parsed.decisionAreas, { architecture: ['technical_direction'] });
});

test('parses refactor.md into its real roles/skills/governance level (STANDARD by default)', () => {
  const markdown = fs.readFileSync(path.join(TEMPLATES_WORKFLOWS, 'refactor.md'), 'utf8');
  const parsed = parseWorkflowMarkdown(markdown, 'refactor');
  assert.deepEqual(parsed.roles, ['engineer', 'architect']);
  assert.deepEqual(parsed.skills, ['implementation', 'testing-strategy']);
  assert.equal(parsed.governanceLevel, 'standard');
  assert.deepEqual(parsed.decisionTypes, ['architecture']);
  assert.deepEqual(parsed.decisionAreas, { architecture: ['module_boundary', 'data_model'] });
});

test('a markdown file with none of the expected sections parses to null — never a guessed default', () => {
  const parsed = parseWorkflowMarkdown('# Just a title\n\nSome unrelated prose.\n', 'mystery');
  assert.equal(parsed, null);
});

// --- decisionAreas: a real, deliberate edge case (Phase 15G) ---

test('a decision-type bullet with no indented sub-bullets contributes no entry for that type — "no areas named" is distinct from "named as an empty list"', () => {
  const markdown = [
    '## Goal',
    '',
    'x',
    '',
    '## Roles involved',
    '',
    '- **Engineer** — always.',
    '',
    '## Skills recommended',
    '',
    '- `implementation`',
    '',
    '## Decisions this workflow may require',
    '',
    '- **Product decision** — a real type, but this file names no specific areas for it.',
    '',
    '## Recommended governance level',
    '',
    '**LIGHT**.',
  ].join('\n');
  const parsed = parseWorkflowMarkdown(markdown, 'edge-case');
  assert.deepEqual(parsed.decisionTypes, ['product']);
  assert.deepEqual(parsed.decisionAreas, {}, 'no sub-bullets were declared, so no key should exist for "product" at all');
});

// --- Compatibility: a pre-15G workflow file (no Decisions section at all) ---

test('a workflow file with no "Decisions this workflow may require" section at all (pre-15F/15G) still resolves fine — decisionTypes/decisionAreas just come back empty', () => {
  const root = tempProject();
  init(root);
  const preDecisionsWorkflow = [
    '# Workflow: Feature development',
    '',
    '## Goal',
    '',
    'x',
    '',
    '## When to use',
    '',
    'x',
    '',
    '## Roles involved',
    '',
    '- **Engineer** — always.',
    '',
    '## Skills recommended',
    '',
    '- `implementation`',
    '',
    '## Expected outputs',
    '',
    '- x',
    '',
    '## Recommended governance level',
    '',
    '**STANDARD**.',
  ].join('\n');
  fs.writeFileSync(path.join(root, '.juntia', 'governance', 'workflows', 'feature-development.md'), preDecisionsWorkflow);

  const result = resolveWorkflowForIntent(root, 'feature');
  assert.equal(result.ok, true);
  assert.deepEqual(result.workflow.decisionTypes, []);
  assert.deepEqual(result.workflow.decisionAreas, {});
});

// --- Resolution against a real, scaffolded project ---

test('resolveWorkflowForIntent reads the real Knowledge Layer of a project scaffolded by init()', () => {
  const root = tempProject();
  init(root);

  const result = resolveWorkflowForIntent(root, 'feature');
  assert.equal(result.ok, true);
  assert.equal(result.workflow.name, 'feature-development');
  assert.deepEqual(result.workflow.roles, ['product', 'architect', 'engineer', 'qa']);
});

test('every one of the four real intents resolves against a freshly-scaffolded project', () => {
  const root = tempProject();
  init(root);
  for (const intent of Object.keys(INTENT_WORKFLOW_FILE)) {
    const result = resolveWorkflowForIntent(root, intent);
    assert.equal(result.ok, true, `intent "${intent}" should resolve`);
    assert.ok(result.workflow.governanceLevel);
  }
});

test('an unmapped intent (e.g. "unknown") never resolves — no workflow is guessed', () => {
  const root = tempProject();
  init(root);
  const result = resolveWorkflowForIntent(root, 'unknown');
  assert.equal(result.ok, false);
  assert.match(result.reason, /no workflow is mapped/);
});

test('a project that never ran `juntia init` fails honestly, naming the fix — compatibility with pre-15C/pre-15B projects', () => {
  const root = tempProject();
  const result = resolveWorkflowForIntent(root, 'feature');
  assert.equal(result.ok, false);
  assert.match(result.reason, /juntia init/);
});

test('a hand-edited workflow file with an unrecognized shape fails honestly rather than guessing partial content', () => {
  const root = tempProject();
  init(root);
  fs.writeFileSync(
    path.join(root, '.juntia', 'governance', 'workflows', 'feature-development.md'),
    '# Feature development\n\nWe do it our own way now.\n',
  );
  const result = resolveWorkflowForIntent(root, 'feature');
  assert.equal(result.ok, false);
  assert.match(result.reason, /could not be read/);
});
