'use strict';

// Phase 15D — tests for `lib/governance/bootstrap.js`: the real navigation
// entry point `.juntia/BOOTSTRAP.md`, which now carries the governance
// index Phase 14A/15B used to bake directly into `CLAUDE.md`. Verifies the
// content itself (never an index of individual files inside CLAUDE.md
// anymore — see test/agent-integration.test.js for that side), the
// RULES.md-awareness that moved here from `agent-integration.js`, and the
// "reflects real, current filesystem state" property (task-handoff
// awareness) — never invented, never guessed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { BOOTSTRAP_FILE, buildBootstrap, writeBootstrap } = require('../lib/governance/bootstrap.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-bootstrap-test-'));
}

test('buildBootstrap explains what Juntia is, without deciding a solution', () => {
  const root = tempProject();
  const content = buildBootstrap(root);
  assert.match(content, /governed by Juntia/);
  assert.match(content, /reasons for you/);
  assert.match(content, /never implements/);
});

test('buildBootstrap names the first-session orientation files', () => {
  const root = tempProject();
  const content = buildBootstrap(root);
  assert.match(content, /\.juntia\/context\.md/);
  assert.match(content, /\.juntia\/PROJECT_STATE\.md/);
  assert.match(content, /\.juntia\/DECISIONS\.md/);
});

test('buildBootstrap explains task-specific navigation via `juntia route`, never says to read everything', () => {
  const root = tempProject();
  const content = buildBootstrap(root);
  assert.match(content, /juntia route/);
  assert.match(content, /task-handoff\.md/);
  assert.doesNotMatch(content, /read (all|every) (of )?these files/i);
});

test('buildBootstrap tells the agent a decision can surface at any point and names the real just-in-time escalation path — Just-In-Time Governance phase', () => {
  const root = tempProject();
  const content = buildBootstrap(root);
  assert.match(content, /can surface at any point — not only before you start/);
  assert.match(content, /governance-review\/SKILL\.md/);
  assert.match(content, /pause\s+only the specific piece of work/);
});

test('buildBootstrap names every real Knowledge Layer subdirectory without copying its content', () => {
  const root = tempProject();
  const content = buildBootstrap(root);
  assert.match(content, /governance\/rules\/agent-rules\.md/);
  assert.match(content, /governance\/workflows\//);
  assert.match(content, /governance\/roles\//);
  assert.match(content, /governance\/skills\//);
  assert.match(content, /governance\/conventions\//);
  assert.match(content, /agent-instructions\.md/);
  assert.doesNotMatch(content, /Analyze before modifying/, 'must not copy agent-rules.md content');
});

// --- Real, current filesystem state — never invented ---

test('buildBootstrap mentions .juntia/RULES.md only when it actually exists', () => {
  const root = tempProject();
  const without = buildBootstrap(root);
  assert.doesNotMatch(without, /\.juntia\/RULES\.md/);

  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'RULES.md'), '# Rules\n\n- Must run on Node 18+\n');
  const withRules = buildBootstrap(root);
  assert.match(withRules, /\.juntia\/RULES\.md/);
});

test('buildBootstrap mentions an already-existing task handoff only when one is actually on disk', () => {
  const root = tempProject();
  const before = buildBootstrap(root);
  assert.doesNotMatch(before, /A task handoff already exists/);

  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'task-handoff.md'), '<!-- juntia:generated -->\n# Task Handoff\n');
  const after = buildBootstrap(root);
  assert.match(after, /A task handoff already exists/);
});

test('writeBootstrap writes to .juntia/BOOTSTRAP.md and returns the real path', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  const written = writeBootstrap(root);
  assert.equal(written, path.join(root, BOOTSTRAP_FILE));
  assert.equal(fs.readFileSync(written, 'utf8'), buildBootstrap(root));
});

test('writeBootstrap is always regenerated, never a scaffold-once artifact — a hand edit does not survive a re-write', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  writeBootstrap(root);
  fs.writeFileSync(path.join(root, BOOTSTRAP_FILE), 'hand-edited content');

  writeBootstrap(root);

  assert.notEqual(fs.readFileSync(path.join(root, BOOTSTRAP_FILE), 'utf8'), 'hand-edited content');
});
