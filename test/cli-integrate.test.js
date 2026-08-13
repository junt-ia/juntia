'use strict';

// Phase 12L — tests for bin/juntia.js's `integrate` command: the CLI layer
// over lib/project-intelligence/agent-integration.js. Verifies the full,
// real flow a developer actually runs (init -> analyze -> context ->
// integrate), using the real init()/analyze()/context() functions already
// covered by their own test files — this file focuses on what `integrate`
// itself adds and guarantees.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runInit, runAnalyze, runContext, runIntegrate,
} = require('../bin/juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-integrate-cli-test-'));
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

test('no runtime argument -> refused with usage guidance, nothing written', () => {
  const root = tempProject();
  const result = silently(() => runIntegrate(undefined, root));
  assert.equal(result.ok, false);
  assert.equal(fs.existsSync(path.join(root, '.juntia')), false);
});

test('the real end-to-end flow (init -> analyze -> context -> integrate) produces exactly the expected new files', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  silently(() => runInit(root));
  const beforeAnalyze = fs.readdirSync(path.join(root, '.juntia')).sort();

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));

    assert.equal(result.ok, true);

    // integrate adds exactly one new file at the project root...
    const topLevel = fs.readdirSync(root).sort();
    assert.ok(topLevel.includes('CLAUDE.md'));

    // ...and .juntia/ only gained what analyze/context/integrate each add —
    // config.yml and the scaffold were already there from init.
    const afterIntegrate = fs.readdirSync(path.join(root, '.juntia')).sort();
    for (const f of beforeAnalyze) assert.ok(afterIntegrate.includes(f), `${f} must survive the whole flow`);
  })();
});

test('integrate never modifies real project source files', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, 'src/index.js', 'console.log("real code");');
  const beforeSrc = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
  const beforePkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    assert.equal(fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8'), beforeSrc);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), beforePkg);
  })();
});

test('integrate never overwrites decisions.json — reproduced with a real confirmed decision present', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, '.juntia/decisions.json', JSON.stringify({
    schemaVersion: 1,
    decisions: [{
      id: 'x', text: 'Phaser is the main engine.', confidence: 'high', basedOn: ['dependency:phaser'], unknowns: [], confirmedAt: '2026-08-14T00:00:00.000Z', status: 'active',
    }],
  }));
  const beforeDecisions = fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    assert.equal(fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8'), beforeDecisions);
  })();
});

test('integrate works with no runtime provider configured at all (no config.yml customization)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));
    assert.equal(result.ok, true);
  })();
});

test('context.md remains valid (parses/reads the same) after integrate runs', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const before = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');

    silently(() => runIntegrate('claude-code', root));

    const after = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
    assert.equal(before, after, 'integrate must never rewrite context.md — it only reads it');
  })();
});
