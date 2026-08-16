'use strict';

// Phase 15B — tests for the Knowledge Layer contract: `.juntia/governance/`
// (rules/workflows/roles/skills/conventions). Per this phase's own explicit
// "No crear tests de comportamiento IA" restriction, these verify only what
// code can actually guarantee: correct scaffolding, idempotent regeneration,
// never overwriting a human edit, valid structure, and that a pre-15B
// project (old paths) is not destructively migrated.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { init, runIntegrate, SCAFFOLD_FILES } = require('../bin/juntia.js');

const TEMPLATES_ROOT = path.join(__dirname, '..', 'templates', 'governance');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-knowledge-layer-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function withRealJuntiaDir(root) {
  writeFile(root, '.juntia/context.md', '# Project Context\n\nNo decisions confirmed yet.\n');
  writeFile(root, '.juntia/config.yml', 'schema_version: 1\n\nruntime:\n  provider: null\n  model: null\n\nintegrations: []\n');
}

// --- Structure: the full governance/ contract exists, in the right shape ---

test('SCAFFOLD_FILES includes every governance/ subdirectory the brief names: rules, workflows, roles, skills, conventions', () => {
  const dirs = ['rules', 'workflows', 'roles', 'skills', 'conventions'];
  for (const dir of dirs) {
    const hasEntry = SCAFFOLD_FILES.some((f) => f.startsWith(path.join('governance', dir)));
    assert.ok(hasEntry, `SCAFFOLD_FILES must include at least one file under governance/${dir}`);
  }
});

test('init() scaffolds the real governance/ tree, matching what templates/governance/ actually contains', () => {
  const root = tempProject();
  init(root);
  const governanceRoot = path.join(root, '.juntia', 'governance');

  assert.ok(fs.existsSync(path.join(governanceRoot, 'roles', 'product.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'roles', 'architect.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'roles', 'engineer.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'roles', 'qa.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'rules', 'agent-rules.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'rules', 'decision-triggers.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'rules', 'governance-signals.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'workflows', 'feature-development.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'workflows', 'bug-fix.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'workflows', 'investigation.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'workflows', 'refactor.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'skills', 'README.md')));
  assert.ok(fs.existsSync(path.join(governanceRoot, 'conventions', 'README.md')));
  for (const skill of ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy', 'product-decision-making', 'architecture-decision-record', 'governance-review']) {
    assert.ok(fs.existsSync(path.join(governanceRoot, 'skills', skill, 'SKILL.md')), `${skill}/SKILL.md must exist`);
  }
});

// --- Regeneration is idempotent (reuses init()'s own, already-tested guarantee) ---

test('running init() twice never changes an already-scaffolded governance file', () => {
  const root = tempProject();
  init(root);
  const rulesPath = path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md');
  const before = fs.readFileSync(rulesPath, 'utf8');

  init(root);

  assert.equal(fs.readFileSync(rulesPath, 'utf8'), before);
});

// --- Never overwrite a human edit ---

test('a hand-edited governance file survives init() being run again', () => {
  const root = tempProject();
  init(root);
  const rulesPath = path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md');
  fs.writeFileSync(rulesPath, '# Our own, hand-edited rules\n\nWe added a project-specific one.\n');

  init(root);

  assert.equal(fs.readFileSync(rulesPath, 'utf8'), '# Our own, hand-edited rules\n\nWe added a project-specific one.\n');
});

test('a hand-edited agent-rules.md survives `integrate` being run again — a real behavior change from Phase 14A, where this file was always force-regenerated', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  runIntegrate('claude-code', root, { silent: true });
  const rulesPath = path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md');
  fs.writeFileSync(rulesPath, '# Our own, hand-edited rules\n');

  runIntegrate('claude-code', root, { silent: true });

  assert.equal(fs.readFileSync(rulesPath, 'utf8'), '# Our own, hand-edited rules\n');
});

// --- Compatibility: old (pre-15B) paths are never touched, never deleted ---

test('a project with old-scheme files (.juntia/roles/, .juntia/agent-rules.md, .juntia/workflows.md) keeps them untouched after init()', () => {
  const root = tempProject();
  writeFile(root, '.juntia/roles/product.md', '# Old-scheme role file, possibly hand-edited\n');
  writeFile(root, '.juntia/agent-rules.md', '<!-- juntia:generated -->\n# Old-scheme agent rules\n');
  writeFile(root, '.juntia/workflows.md', '<!-- juntia:generated -->\n# Old-scheme workflows\n');

  init(root);

  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'roles', 'product.md'), 'utf8'), '# Old-scheme role file, possibly hand-edited\n');
  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'agent-rules.md'), 'utf8'), '<!-- juntia:generated -->\n# Old-scheme agent rules\n');
  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'workflows.md'), 'utf8'), '<!-- juntia:generated -->\n# Old-scheme workflows\n');
  // ...and the new-scheme tree is scaffolded alongside them, not instead of them.
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'roles', 'product.md')));
});

// --- Valid structure: every SKILL.md has real, parseable frontmatter with every required field ---

const REQUIRED_SKILL_FIELDS = ['name', 'description', 'role', 'when_to_use', 'inputs', 'process', 'expected_output', 'constraints'];

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'file must start with a --- frontmatter block');
  return match[1];
}

for (const skill of ['feature-planning', 'architecture-review', 'implementation', 'testing-strategy', 'product-decision-making', 'architecture-decision-record', 'governance-review']) {
  test(`skills/${skill}/SKILL.md has every required frontmatter field, per the schema in skills/README.md`, () => {
    const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(content);
    for (const field of REQUIRED_SKILL_FIELDS) {
      assert.match(frontmatter, new RegExp(`^${field}:`, 'm'), `missing required field "${field}"`);
    }
  });

  test(`skills/${skill}/SKILL.md's frontmatter name field matches its own directory name`, () => {
    const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(content);
    assert.match(frontmatter, new RegExp(`^name: ${skill}$`, 'm'));
  });
}

// --- Valid structure: every workflow file has the sections the brief requires ---

const REQUIRED_WORKFLOW_SECTIONS = [
  '## Goal', '## When to use', '## Roles involved', '## Skills recommended',
  '## Expected outputs', '## Recommended governance level',
];

for (const workflow of ['feature-development', 'bug-fix', 'investigation', 'refactor']) {
  test(`workflows/${workflow}.md defines objective, when-to-use, roles, skills, outputs, and a governance level`, () => {
    const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'workflows', `${workflow}.md`), 'utf8');
    for (const section of REQUIRED_WORKFLOW_SECTIONS) {
      assert.match(content, new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `missing section "${section}"`);
    }
    assert.match(content, /\*\*(LIGHT|STANDARD|STRICT)\*\*/, 'must name a real governance level, not leave it unstated');
  });
}

// Phase 15G: "Decisions this workflow may require" is real in all four
// current templates, but deliberately NOT added to REQUIRED_WORKFLOW_SECTIONS
// above — `workflow-knowledge.js`'s own parser treats its absence as a real,
// valid "no decision types" answer, not a parse failure (this is exactly
// what makes a pre-15F workflow file still fully compatible). This is a
// separate, current-state assertion, not a new hard requirement for every
// future or hand-edited workflow file.
for (const workflow of ['feature-development', 'bug-fix', 'investigation', 'refactor']) {
  test(`workflows/${workflow}.md currently declares a real "Decisions this workflow may require" section`, () => {
    const content = fs.readFileSync(path.join(TEMPLATES_ROOT, 'workflows', `${workflow}.md`), 'utf8');
    assert.match(content, /^## Decisions this workflow may require$/m);
  });
}

// --- Compatibility: setup/analyze/integrate still work end to end ---

test('integrate still works end to end; CLAUDE.md points at BOOTSTRAP.md, which in turn points at .juntia/governance/ (Phase 15D moved the index one level deeper)', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  const result = runIntegrate('claude-code', root, { silent: true });

  assert.equal(result.ok, true);
  const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(claudeMd, /\.juntia\/BOOTSTRAP\.md/);
  assert.doesNotMatch(claudeMd, /\.juntia\/governance\//, 'CLAUDE.md itself must not enumerate governance/ anymore — that is BOOTSTRAP.md\'s job');

  const bootstrapMd = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
  assert.match(bootstrapMd, /\.juntia\/governance\//);
});
