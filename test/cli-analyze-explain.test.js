'use strict';

// Phase 12J — tests for bin/juntia.js's `analyze --explain` wiring. Uses a
// mock adapter injected via runAnalyze's options (same pattern
// test/intent-runtime-bridge.test.js uses) — no live CLI call in this file,
// consistent with the rest of this suite's determinism/CI-safety.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, formatInterpretation } = require('../bin/juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-explain-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

function mockAdapter(response) {
  return { interpret: async () => response };
}

test('without --explain, runAnalyze never touches the runtime adapter and returns undefined', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  const adapter = { interpret: async () => { throw new Error('must not be called without --explain'); } };

  const result = await silently(() => runAnalyze(root, { adapter }));
  assert.equal(result, undefined);
});

test('with explain: true, a valid runtime interpretation is returned and printed, still writing only .juntia/facts.json + .gitignore', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  const adapter = mockAdapter({
    ok: true,
    raw: JSON.stringify({
      interpretation: 'This project appears to use Phaser.',
      confidence: 'medium',
      basedOn: ['dependency:phaser'],
      unknowns: [],
    }),
    durationMs: 300,
  });

  const synthesis = await silently(() => runAnalyze(root, { explain: true, adapter }));

  assert.equal(synthesis.ok, true);
  assert.equal(synthesis.result.confidence, 'medium');

  const juntiaContents = fs.readdirSync(path.join(root, '.juntia')).sort();
  assert.deepEqual(juntiaContents, ['.gitignore', 'facts.json'], '--explain must never write a pending.json or any other file');
});

test('with explain: true and a runtime/validation failure, analyze still completes normally (facts still persisted) and reports the failure, never crashes', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  const adapter = mockAdapter({ ok: false, error: 'timeout', message: 'killed', durationMs: 30000 });

  const synthesis = await silently(() => runAnalyze(root, { explain: true, adapter }));

  assert.equal(synthesis.ok, false);
  assert.match(synthesis.reason, /runtime failure/);
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'facts.json')), 'facts persistence must not be affected by an --explain failure');
});

test('formatInterpretation clearly labels a failed synthesis as unavailable, never as a fact', () => {
  const output = formatInterpretation({ ok: false, reason: 'runtime failure: timeout — killed' });
  assert.match(output, /not available/);
  assert.match(output, /No file was written/);
});

test('formatInterpretation clearly labels a successful synthesis as non-authoritative (not a fact, not saved, not a decision)', () => {
  const output = formatInterpretation({
    ok: true,
    result: {
      interpretation: 'This is a Phaser game.',
      confidence: 'high',
      basedOn: ['dependency:phaser'],
      unknowns: [],
    },
  });
  assert.match(output, /not a fact, not saved, not a decision/);
  assert.match(output, /confidence: high/);
  assert.match(output, /based on: dependency:phaser/);
});
