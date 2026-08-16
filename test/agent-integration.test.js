'use strict';

// Phase 12L — tests for lib/project-intelligence/agent-integration.js: the
// pointer-file generator and config.yml `integrations:` bookkeeping. Real
// fs.mkdtempSync fixtures throughout, same discipline as
// test/facts-store.test.js and test/decisions-store.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  RUNTIME_PROFILES, isJuntiaGenerated, buildPointerContent,
  parseIntegrationsBlock, withIntegration, integrateRuntime,
  readRuntimeProvider, withRuntimeProvider,
} = require('../lib/project-intelligence/agent-integration.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-integration-test-'));
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

// --- parseIntegrationsBlock / withIntegration (pure text editing) -----------

test('parseIntegrationsBlock reads an empty flow-style list', () => {
  assert.deepEqual(parseIntegrationsBlock('integrations: []\n'), []);
});

test('parseIntegrationsBlock reads a flow-style list with entries', () => {
  assert.deepEqual(parseIntegrationsBlock('integrations: [claude-code, codex]\n'), ['claude-code', 'codex']);
});

test('parseIntegrationsBlock reads a block-style list', () => {
  assert.deepEqual(parseIntegrationsBlock('integrations:\n  - claude-code\n  - codex\n'), ['claude-code', 'codex']);
});

test('parseIntegrationsBlock returns empty for a config with no integrations key at all', () => {
  assert.deepEqual(parseIntegrationsBlock('schema_version: 1\n'), []);
});

test('withIntegration adds a first entry, converting empty flow style to block style', () => {
  const result = withIntegration('project:\n  name: null\n\nintegrations: []\n', 'claude-code');
  assert.match(result, /integrations:\n {2}- claude-code\n/);
  assert.doesNotMatch(result, /integrations: \[\]/);
});

test('withIntegration is idempotent — adding the same runtime twice changes nothing', () => {
  const once = withIntegration('integrations: []\n', 'claude-code');
  const twice = withIntegration(once, 'claude-code');
  assert.equal(once, twice);
});

test('withIntegration appends a second entry without disturbing the first', () => {
  const once = withIntegration('integrations: []\n', 'claude-code');
  const twice = withIntegration(once, 'codex');
  assert.deepEqual(parseIntegrationsBlock(twice), ['claude-code', 'codex']);
});

test('withIntegration preserves the rest of the file untouched', () => {
  const configText = 'schema_version: 1\n\nproject:\n  name: my-app\n\nintegrations: []\n';
  const result = withIntegration(configText, 'claude-code');
  assert.match(result, /schema_version: 1/);
  assert.match(result, /name: my-app/);
});

// --- generated-file marker ---------------------------------------------------

test('a freshly generated pointer file is recognized as Juntia-generated', () => {
  const content = buildPointerContent(RUNTIME_PROFILES['claude-code'], 'claude-code');
  assert.equal(isJuntiaGenerated(content), true);
});

test('a real, human-authored file (no marker) is never mistaken for Juntia-generated', () => {
  assert.equal(isJuntiaGenerated('# My real CLAUDE.md\n\nOur team conventions...\n'), false);
});

// --- buildPointerContent as a governance index (Phase 14A) -------------------

// Phase 15D: `buildPointerContent` shrank from a full governance INDEX
// (every file named individually) to a real entry point — it must state
// that the project uses Juntia Governance and point at
// `.juntia/BOOTSTRAP.md`, but must NOT enumerate `context.md`/
// `DECISIONS.md`/`governance/rules|workflows|roles|skills`/
// `agent-instructions.md` individually anymore; that index now lives one
// level deeper, in `lib/governance/bootstrap.js` (see test/bootstrap.test.js).
test('buildPointerContent is a real entry point — states Juntia Governance is active and points at BOOTSTRAP.md, never an index of individual files', () => {
  const content = buildPointerContent(RUNTIME_PROFILES['claude-code'], 'claude-code');
  assert.match(content, /Juntia Governance/);
  assert.match(content, /\.juntia\/BOOTSTRAP\.md/);
  for (const individualFile of [
    '.juntia/context.md', '.juntia/DECISIONS.md', '.juntia/RULES.md',
    'rules/agent-rules.md', '.juntia/agent-instructions.md',
  ]) {
    assert.doesNotMatch(content, new RegExp(individualFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `CLAUDE.md must not name ${individualFile} directly anymore — that's BOOTSTRAP.md's job`);
  }
});

// Phase 15D: buildPointerContent no longer takes a third `{ hasProjectRules }`
// options argument at all — RULES.md-awareness moved entirely to
// `lib/governance/bootstrap.js` (see test/bootstrap.test.js). Calling it
// with an extra argument is simply ignored, proving the content no longer
// varies by project state — CLAUDE.md is now the same for every project.
test('buildPointerContent produces identical output regardless of project state — it no longer varies by what exists on disk', () => {
  const withoutExtra = buildPointerContent(RUNTIME_PROFILES['claude-code'], 'claude-code');
  const withIgnoredExtra = buildPointerContent(RUNTIME_PROFILES['claude-code'], 'claude-code', { hasProjectRules: true });
  assert.equal(withoutExtra, withIgnoredExtra);
});

test('buildPointerContent never copies content from any of the files it indexes — only names them', () => {
  const content = buildPointerContent(RUNTIME_PROFILES['claude-code'], 'claude-code');
  assert.doesNotMatch(content, /Analyze before modifying/, 'must not duplicate agent-rules.md content');
  assert.doesNotMatch(content, /## New feature/, 'must not duplicate workflows.md content');
});

// --- integrateRuntime: the full, real function ------------------------------

test('an unsupported runtime is refused with a clear, actionable reason — nothing is written', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  const result = integrateRuntime(root, 'not-a-real-runtime');
  assert.equal(result.ok, false);
  assert.match(result.reason, /unsupported runtime/);
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
});

test('integrating before any real context exists is refused, not silently scaffolded', () => {
  const root = tempProject();
  const result = integrateRuntime(root, 'claude-code');
  assert.equal(result.ok, false);
  assert.match(result.reason, /no \.juntia\/context\.md yet/);
});

test('a successful integration creates CLAUDE.md at the project ROOT, not inside .juntia/', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  const result = integrateRuntime(root, 'claude-code');
  assert.equal(result.ok, true);
  assert.equal(result.file, 'CLAUDE.md');
  assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')));
});

test('CLAUDE.md points to .juntia/BOOTSTRAP.md and never duplicates any project content', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  integrateRuntime(root, 'claude-code');
  const content = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /\.juntia\/BOOTSTRAP\.md/);
  assert.doesNotMatch(content, /No decisions confirmed yet/, 'must not copy context.md\'s own content');
});

test('a pre-existing, real (non-generated) CLAUDE.md is never overwritten', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  writeFile(root, 'CLAUDE.md', '# Our real team conventions\n\nDo not touch.\n');

  const result = integrateRuntime(root, 'claude-code');

  assert.equal(result.ok, false);
  assert.match(result.reason, /already exists and wasn't generated by Juntia/);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '# Our real team conventions\n\nDo not touch.\n');
});

test('re-running integrate safely regenerates a Juntia-generated CLAUDE.md', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  integrateRuntime(root, 'claude-code');
  const firstRun = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

  const result = integrateRuntime(root, 'claude-code');

  assert.equal(result.ok, true);
  const secondRun = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.equal(firstRun, secondRun);
});

test('a successful integration records the runtime in .juntia/config.yml, once', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  integrateRuntime(root, 'claude-code');
  integrateRuntime(root, 'claude-code');

  const configText = fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8');
  assert.deepEqual(parseIntegrationsBlock(configText), ['claude-code']);
});

test('integrateRuntime never touches facts.json, decisions.json, pending.json, or context.md itself', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  writeFile(root, '.juntia/facts.json', '{"schemaVersion":1,"scannedAt":"x","facts":[]}');
  writeFile(root, '.juntia/decisions.json', '{"schemaVersion":1,"decisions":[]}');
  const before = {
    facts: fs.readFileSync(path.join(root, '.juntia', 'facts.json'), 'utf8'),
    decisions: fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8'),
    context: fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8'),
  };

  integrateRuntime(root, 'claude-code');

  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'facts.json'), 'utf8'), before.facts);
  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8'), before.decisions);
  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8'), before.context);
});

// Phase 15D: RULES.md-awareness moved from CLAUDE.md itself to
// `.juntia/BOOTSTRAP.md` (`lib/governance/bootstrap.js`, wired in by
// `bin/juntia.js`'s `runIntegrate`, not by this lower-level `integrateRuntime`
// — see test/bootstrap.test.js for the real, RULES.md-aware coverage).
// This test now documents the negative: CLAUDE.md's own content is
// unaffected by RULES.md existing, proving the two concerns stayed separate.
test('CLAUDE.md itself no longer varies when .juntia/RULES.md exists — that awareness lives in BOOTSTRAP.md now', () => {
  const root = tempProject();
  withRealJuntiaDir(root);
  writeFile(root, '.juntia/RULES.md', '# Rules\n\n## Technical constraints\n\n- Must run on Node 18+\n');

  integrateRuntime(root, 'claude-code');

  const content = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.doesNotMatch(content, /\.juntia\/RULES\.md/);
});

test('works with runtime.provider left at null — integrate never reads or requires it', () => {
  const root = tempProject();
  withRealJuntiaDir(root); // config.yml has runtime.provider: null
  const result = integrateRuntime(root, 'claude-code');
  assert.equal(result.ok, true);
});

// --- readRuntimeProvider / withRuntimeProvider (Phase 13A) -------------------

test('readRuntimeProvider returns null for the real init template (provider: null)', () => {
  assert.equal(readRuntimeProvider('runtime:\n  provider: null\n  model: null\n'), null);
});

test('readRuntimeProvider returns the real, set value', () => {
  assert.equal(readRuntimeProvider('runtime:\n  provider: claude-code\n  model: null\n'), 'claude-code');
});

test('readRuntimeProvider returns null when there is no runtime: block at all', () => {
  assert.equal(readRuntimeProvider('schema_version: 1\n'), null);
});

test('withRuntimeProvider sets provider while preserving the rest of the runtime: block (e.g. model)', () => {
  const result = withRuntimeProvider('runtime:\n  provider: null\n  model: null\n', 'claude-code');
  assert.match(result, /runtime:\n {2}provider: claude-code\n {2}model: null\n/);
});

test('withRuntimeProvider preserves everything outside the runtime: block untouched', () => {
  const configText = 'schema_version: 1\n\nruntime:\n  provider: null\n  model: null\n\nintegrations: []\n';
  const result = withRuntimeProvider(configText, 'claude-code');
  assert.match(result, /schema_version: 1/);
  assert.match(result, /integrations: \[\]/);
  assert.equal(readRuntimeProvider(result), 'claude-code');
});

test('withRuntimeProvider is idempotent when called twice with the same provider', () => {
  const once = withRuntimeProvider('runtime:\n  provider: null\n  model: null\n', 'claude-code');
  const twice = withRuntimeProvider(once, 'claude-code');
  assert.equal(once, twice);
});

test('withRuntimeProvider appends a runtime: block when none exists', () => {
  const result = withRuntimeProvider('schema_version: 1\n', 'claude-code');
  assert.equal(readRuntimeProvider(result), 'claude-code');
  assert.match(result, /schema_version: 1/);
});
