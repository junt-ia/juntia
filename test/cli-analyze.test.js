'use strict';

// Phase 12E — tests for bin/juntia.js's `analyze` command: a thin,
// inventory-only wrapper over the real scanner (test/project-intelligence-
// scanner.test.js covers the scanner itself). Verifies the CLI layer adds
// no interpretation of its own.
//
// Phase 12I revised one guarantee this file originally asserted: `analyze`
// no longer touches zero files — it now persists a factual baseline to
// `.juntia/facts.json` by design (see test/facts-store.test.js for the
// persistence/diff logic itself). What's still guaranteed, and tested below,
// is the narrower claim: analyze writes *only* inside `.juntia/`, never
// touches a project's own real files, and the diff report never contains an
// interpretation, only category/name/value facts.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { formatAnalysis, formatChanges, runAnalyze } = require('../bin/juntia.js');
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
});

test('formatAnalysis reports UNKNOWN plainly for an empty project, without inventing content', () => {
  const root = tempProject();

  const output = formatAnalysis(scanProject(root));

  assert.match(output, /UNKNOWN/);
  assert.doesNotMatch(output, /Languages:/);
  assert.doesNotMatch(output, /Dependencies:/);
});

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

test('runAnalyze writes only inside .juntia/ — never touches a real project file', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { react: '^18.0.0' } }));
  const packageJsonBefore = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const topLevelBefore = fs.readdirSync(root).sort();

  silently(() => runAnalyze(root));

  const packageJsonAfter = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  assert.equal(packageJsonAfter, packageJsonBefore, 'analyze must never modify a real project file');

  const topLevelAfter = fs.readdirSync(root).sort();
  assert.deepEqual(topLevelAfter, [...topLevelBefore, '.juntia'].sort(), 'analyze must only ever add .juntia/ at the top level');

  const juntiaContents = fs.readdirSync(path.join(root, '.juntia')).sort();
  assert.deepEqual(juntiaContents, ['.gitignore', 'facts.json']);
});

function captureLog(fn) {
  let captured = '';
  const originalLog = console.log;
  console.log = (line) => { captured += `${line}\n`; };
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return captured;
}

test('formatChanges reports "no changes" for an empty diff, and plain +/-/~ lines otherwise — never prose interpretation', () => {
  assert.equal(formatChanges({ added: [], removed: [], changed: [] }), 'No changes detected since the last analyze.');

  const output = formatChanges({
    added: [{ category: 'dependency', name: 'express' }],
    removed: [{ category: 'technology', name: 'vite' }],
    changed: [{ category: 'dependency', name: 'phaser', from: '^3.0.0', to: '^4.0.0' }],
  });
  assert.match(output, /Added:\n\s+\+ dependency: express/);
  assert.match(output, /Removed:\n\s+- technology: vite/);
  assert.match(output, /Changed:\n\s+~ dependency: phaser "\^3\.0\.0" -> "\^4\.0\.0"/);
});

test('runAnalyze creates a baseline on first run, and reports "no changes" on an identical second run', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  silently(() => runAnalyze(root));
  const captured = captureLog(() => runAnalyze(root));

  assert.match(captured, /No changes detected since the last analyze\./);
});

test('runAnalyze reports ADDED, REMOVED, and CHANGED as plain facts, never as interpretation', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0', vite: '^4.0.0' } }));
  silently(() => runAnalyze(root));

  // simulate real project evolution: phaser upgraded, vite removed, express added
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^4.0.0', express: '^4.18.0' } }));

  const captured = captureLog(() => runAnalyze(root));

  assert.match(captured, /Added:\n\s+\+ (technology|dependency): express/);
  assert.match(captured, /Removed:\n\s+- (technology|dependency): vite/);
  assert.match(captured, /Changed:\n\s+~ dependency: phaser "\^3\.0\.0" -> "\^4\.0\.0"/);
  // never an interpretive claim
  assert.doesNotMatch(captured.toLowerCase(), /architecture|videojuego|\bgame\b/);
});
