'use strict';

// Phase 12E — tests for bin/juntia.js's `analyze` command: a thin,
// inventory-only wrapper over the real scanner (test/project-intelligence-
// scanner.test.js covers the scanner itself). Verifies the CLI layer adds
// no interpretation of its own and never writes to the filesystem.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { formatAnalysis, runAnalyze } = require('../bin/juntia.js');
const { scanProject } = require('../lib/project-intelligence/scanner.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-analyze-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('formatAnalysis lists real detected facts, in the documented shape', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  writeFile(root, 'src/main.js', 'console.log(1);');

  const output = formatAnalysis(scanProject(root));

  assert.match(output, /^Analyzing project\.\.\./);
  assert.match(output, /Languages:\n\s+✓ JavaScript/);
  assert.match(output, /Dependencies:\n\s+✓ phaser/);
  assert.match(output, /Structure:\n\s+✓ src\//);
  assert.match(output, /no AI was used/);
  assert.match(output, /nothing was written to \.juntia\//);
});

test('formatAnalysis reports UNKNOWN plainly for an empty project, without inventing content', () => {
  const root = tempProject();

  const output = formatAnalysis(scanProject(root));

  assert.match(output, /UNKNOWN/);
  assert.doesNotMatch(output, /Languages:/);
  assert.doesNotMatch(output, /Dependencies:/);
});

test('runAnalyze never writes any file — pure read-only inventory', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { react: '^18.0.0' } }));
  const before = fs.readdirSync(root).sort();

  const originalLog = console.log;
  console.log = () => {}; // silence output for this assertion-only run
  try {
    runAnalyze(root);
  } finally {
    console.log = originalLog;
  }

  const after = fs.readdirSync(root).sort();
  assert.deepEqual(before, after);
  assert.ok(!fs.existsSync(path.join(root, '.juntia')), 'analyze must not create .juntia/');
});
