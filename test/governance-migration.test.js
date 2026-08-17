'use strict';

// Single Governance Source of Truth phase — tests for
// lib/project-intelligence/governance-migration.js (the real conflict
// resolution rule `docs/CLI.md#why-update-isnt-built-yet` named as missing)
// and bin/juntia.js's `runUpdate` (the CLI command that finally uses it).
//
// Central properties under test: nothing destructive ever happens (a legacy
// file is never deleted or edited); human content at either location always
// survives; a project ends up with exactly one governance source of truth,
// never two live ones.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runUpdate, runIntegrate, runAnalyze, runContext,
} = require('../bin/juntia.js');
const {
  detectLegacyGovernance, migrateGovernance, LEGACY_AGENT_RULES, LEGACY_WORKFLOWS,
} = require('../lib/project-intelligence/governance-migration.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-migration-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = originalLog; });
  }
  console.log = originalLog;
  return result;
}

function writeLegacyProject(root, { customRules = true, customRole = true } = {}) {
  writeFile(root, LEGACY_AGENT_RULES, customRules
    ? '<!-- juntia:generated -->\n# Agent Rules\n\n- Our own rule: never touch payments without asking.\n'
    : '<!-- juntia:generated -->\n# Agent Rules\n');
  writeFile(root, LEGACY_WORKFLOWS, '<!-- juntia:generated -->\n# Workflows (old, flat)\n');
  writeFile(root, '.juntia/roles/product.md', customRole
    ? '# Role: Product\n\nWe require a linked Jira ticket for every request.\n'
    : '# Role: Product\n');
}

// --- Detection -----------------------------------------------------------

test('detectLegacyGovernance reports nothing on a project with no legacy files at all', () => {
  const root = tempProject();
  const detected = detectLegacyGovernance(root);
  assert.equal(detected.any, false);
  assert.equal(detected.hasAgentRules, false);
  assert.equal(detected.hasWorkflows, false);
  assert.deepEqual(detected.legacyRoleFiles, []);
});

test('detectLegacyGovernance finds a real legacy installation', () => {
  const root = tempProject();
  writeLegacyProject(root);
  const detected = detectLegacyGovernance(root);
  assert.equal(detected.any, true);
  assert.equal(detected.hasAgentRules, true);
  assert.equal(detected.hasWorkflows, true);
  assert.deepEqual(detected.legacyRoleFiles, ['product.md']);
});

// --- Migration: a project with ONLY legacy governance ---------------------

test('a project with legacy governance and no new governance yet: agent-rules.md and roles migrate, workflows.md is reported not-portable, nothing destroyed', () => {
  const root = tempProject();
  writeLegacyProject(root);

  const { init } = require('../bin/juntia.js');
  init(root);
  const report = migrateGovernance(root);

  assert.equal(report.any, true);
  assert.equal(report.migrated.length, 2); // agent-rules.md + product.md
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.notPortable.length, 1);
  assert.equal(report.notPortable[0].from, LEGACY_WORKFLOWS);

  const newRules = fs.readFileSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md'), 'utf8');
  assert.match(newRules, /Our own rule: never touch payments without asking/);
  const newRole = fs.readFileSync(path.join(root, '.juntia', 'governance', 'roles', 'product.md'), 'utf8');
  assert.match(newRole, /We require a linked Jira ticket/);

  // The legacy files are never deleted or modified.
  assert.equal(fs.existsSync(path.join(root, LEGACY_AGENT_RULES)), true);
  assert.equal(fs.existsSync(path.join(root, LEGACY_WORKFLOWS)), true);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'roles', 'product.md')), true);
});

// --- Migration: a project already fully on the new scheme ----------------

test('a project with only new governance (no legacy at all) reports nothing to migrate', () => {
  const root = tempProject();
  const { init } = require('../bin/juntia.js');
  init(root);

  const report = migrateGovernance(root);
  assert.equal(report.any, false);
  assert.deepEqual(report.migrated, []);
});

// --- Migration: a mixed project — legacy AND new, new already customized -

test('a mixed project where the new-scheme file is already customized differently is never silently overwritten — a conflict is reported, both originals survive untouched', () => {
  const root = tempProject();
  writeLegacyProject(root);
  const { init } = require('../bin/juntia.js');
  init(root);
  // Simulate a human who already started customizing the NEW file, before ever running `update`.
  writeFile(root, '.juntia/governance/rules/agent-rules.md', '# Our brand-new-scheme rules, written directly\n');

  const report = migrateGovernance(root);

  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].from, LEGACY_AGENT_RULES);
  assert.match(report.conflicts[0].reason, /already has content different/);

  // Neither file was touched.
  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md'), 'utf8'), '# Our brand-new-scheme rules, written directly\n');
  assert.match(fs.readFileSync(path.join(root, LEGACY_AGENT_RULES), 'utf8'), /Our own rule: never touch payments/);
});

test('a mixed project where the new-scheme file is still exactly the stock template (freshly scaffolded by init, never hand-edited) safely migrates the legacy content over it', () => {
  const root = tempProject();
  writeLegacyProject(root);
  const { init } = require('../bin/juntia.js');
  init(root); // scaffolds the stock template at the new location — not yet customized by anyone

  const report = migrateGovernance(root);

  assert.equal(report.migrated.length, 2);
  const newRules = fs.readFileSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md'), 'utf8');
  assert.match(newRules, /Our own rule: never touch payments without asking/);
});

// --- Preservation of human content, exactly, byte for byte ----------------

test('human-customized legacy content survives migration verbatim — not reworded, not summarized, not merged with the new default', () => {
  const root = tempProject();
  const customRules = '<!-- juntia:generated -->\n# Agent Rules\n\n- Weird formatting.\n\n\n- Extra blank lines kept.\n';
  writeFile(root, LEGACY_AGENT_RULES, customRules);
  const { init } = require('../bin/juntia.js');
  init(root);

  migrateGovernance(root);

  const migrated = fs.readFileSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md'), 'utf8');
  assert.equal(migrated, customRules, 'the migrated content must be byte-identical to the original legacy content');
});

// --- Idempotency: running migration/update twice never re-flags success as a conflict --

test('migrateGovernance run a second time recognizes its own prior migration and reports it separately from a real conflict', () => {
  const root = tempProject();
  writeLegacyProject(root);
  const { init } = require('../bin/juntia.js');
  init(root);

  migrateGovernance(root); // first run: real migration
  const second = migrateGovernance(root); // second run: idempotent

  assert.equal(second.migrated.length, 0);
  assert.equal(second.conflicts.length, 0);
  assert.equal(second.alreadyMigrated.length, 2);
});

// --- runUpdate: the real, wired CLI command --------------------------------

test('runUpdate on a legacy project migrates content and refreshes BOOTSTRAP.md to point only at the new governance', () => {
  const root = tempProject();
  writeLegacyProject(root);

  const report = silently(() => runUpdate(root));

  assert.equal(report.migrated.length, 2);
  const bootstrap = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
  assert.match(bootstrap, /\.juntia\/governance\//);
  assert.doesNotMatch(bootstrap, /\.juntia\/agent-rules\.md/);
  assert.doesNotMatch(bootstrap, /\.juntia\/workflows\.md/);
});

test('runUpdate refreshes an already-integrated CLAUDE.md too, so it keeps pointing only at the new governance after a migration', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runAnalyze(root));
  silently(() => runContext(root));
  silently(() => runIntegrate('claude-code', root));
  writeLegacyProject(root);

  silently(() => runUpdate(root));

  const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(claudeMd, /\.juntia\/BOOTSTRAP\.md/);
  assert.doesNotMatch(claudeMd, /governance\/(roles|workflows|skills|rules)\//);
});

test('runUpdate on a project with no legacy governance at all is a safe no-op that still refreshes BOOTSTRAP.md', () => {
  const root = tempProject();
  const report = silently(() => runUpdate(root));
  assert.equal(report.any, false);
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'BOOTSTRAP.md')));
});

test('runUpdate never deletes or edits a legacy file, even after a successful migration', () => {
  const root = tempProject();
  writeLegacyProject(root);
  const before = fs.readFileSync(path.join(root, LEGACY_AGENT_RULES), 'utf8');

  silently(() => runUpdate(root));

  assert.equal(fs.readFileSync(path.join(root, LEGACY_AGENT_RULES), 'utf8'), before);
});

// --- No duplication of sources of truth -----------------------------------

test('after migration, the new-scheme agent-rules.md is the one and only file BOOTSTRAP.md points an agent at — never both', () => {
  const root = tempProject();
  writeLegacyProject(root);
  silently(() => runUpdate(root));

  const bootstrap = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
  const mentions = (bootstrap.match(/agent-rules\.md/g) || []).length;
  assert.equal(mentions, 1, 'BOOTSTRAP.md must reference exactly one agent-rules.md — the new-scheme one');
  assert.match(bootstrap, /governance\/rules\/agent-rules\.md/);
});

test('a project with new governance already in place and no legacy files never gets legacy files invented', () => {
  const root = tempProject();
  const { init } = require('../bin/juntia.js');
  init(root);
  silently(() => runUpdate(root));

  assert.equal(fs.existsSync(path.join(root, LEGACY_AGENT_RULES)), false);
  assert.equal(fs.existsSync(path.join(root, LEGACY_WORKFLOWS)), false);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'roles')), false);
});
