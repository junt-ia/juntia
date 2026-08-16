'use strict';

// Phase 12B — tests for bin/juntia.js's `init` command: the first, deliberately
// narrow entrypoint (scaffold .juntia/ locally; no analysis, no AI call, no
// network access). Verifies exactly the safety/reversibility properties this
// phase's brief required, against real filesystem operations in a real temp
// directory — not mocked.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { init, SCAFFOLD_FILES } = require('../bin/juntia.js');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-cli-test-'));
}

test('init() on an empty project creates every scaffold file, skips none', () => {
  const projectRoot = makeTempProject();
  const result = init(projectRoot);

  assert.equal(result.created.length, SCAFFOLD_FILES.length);
  assert.equal(result.skipped.length, 0);
  for (const relativePath of SCAFFOLD_FILES) {
    const dest = path.join(projectRoot, '.juntia', relativePath);
    assert.equal(fs.existsSync(dest), true, `expected ${relativePath} to exist`);
  }
});

test('init() copies real template content, not empty placeholders', () => {
  const projectRoot = makeTempProject();
  init(projectRoot);

  const configContent = fs.readFileSync(path.join(projectRoot, '.juntia', 'config.yml'), 'utf8');
  assert.match(configContent, /schema_version: 1/);

  const roleContent = fs.readFileSync(path.join(projectRoot, '.juntia', 'governance', 'roles', 'product.md'), 'utf8');
  assert.match(roleContent, /Not an autonomous agent/);
});

test('init() run a second time is a pure no-op: zero files created, all reported skipped', () => {
  const projectRoot = makeTempProject();
  init(projectRoot);
  const second = init(projectRoot);

  assert.equal(second.created.length, 0);
  assert.equal(second.skipped.length, SCAFFOLD_FILES.length);
});

test('init() never overwrites a file a user or project already created at that path', () => {
  const projectRoot = makeTempProject();
  fs.mkdirSync(path.join(projectRoot, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.juntia', 'config.yml'), 'project:\n  name: my-real-project\n');

  const result = init(projectRoot);

  const configContent = fs.readFileSync(path.join(projectRoot, '.juntia', 'config.yml'), 'utf8');
  assert.equal(configContent, 'project:\n  name: my-real-project\n');
  assert.ok(result.skipped.includes('config.yml'));
  // every other scaffold file (not pre-existing) is still created normally
  assert.ok(result.created.includes('PROJECT_STATE.md'));
});

test('init() touches nothing outside <projectRoot>/.juntia/', () => {
  const projectRoot = makeTempProject();
  const before = fs.readdirSync(projectRoot);
  init(projectRoot);
  const after = fs.readdirSync(projectRoot);

  assert.deepEqual(before, []);
  assert.deepEqual(after, ['.juntia']);
});
