'use strict';

// Phase 12J — tests for bin/juntia.js's `analyze --explain` wiring.
// Redefined by Phase 13D: Juntia no longer executes an AI runtime itself
// (no adapter, no subprocess, no live/mocked call in this file at all) —
// `--explain` refreshes `.juntia/agent-instructions.md` (the AI Handoff,
// see lib/project-intelligence/agent-handoff.js) and reports how many
// interpretations are already pending, deterministically, from the same
// facts/diff `analyze` already computed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, formatHandoffStatus } = require('../bin/juntia.js');
const { upsertPending } = require('../lib/project-intelligence/pending-store.js');

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
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = originalLog; });
  }
  console.log = originalLog;
  return result;
}

test('without --explain, runAnalyze never writes agent-instructions.md and returns undefined', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  const result = await silently(() => runAnalyze(root));
  assert.equal(result, undefined);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'agent-instructions.md')), false);
});

test('with explain: true, .juntia/agent-instructions.md is generated with real facts, and nothing else is written outside .juntia/', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  const markdown = await silently(() => runAnalyze(root, { explain: true }));

  assert.match(markdown, /dependency:phaser/);
  const juntiaContents = fs.readdirSync(path.join(root, '.juntia')).sort();
  assert.deepEqual(juntiaContents, ['.gitignore', 'agent-instructions.md', 'facts.json'], '--explain must write only .juntia/agent-instructions.md beyond what analyze already writes');
});

test('--explain never invokes any subprocess or AI runtime — no adapter is required, no live call is possible', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  // No CLAUDE_CODE_EXECPATH, no PATH, nothing — if `runAnalyze` still tried
  // to spawn anything, this environment gives it no way to succeed. It must
  // still complete normally.
  const originalExecPath = process.env.CLAUDE_CODE_EXECPATH;
  const originalPath = process.env.PATH;
  delete process.env.CLAUDE_CODE_EXECPATH;
  process.env.PATH = '';
  try {
    const markdown = await silently(() => runAnalyze(root, { explain: true }));
    assert.ok(markdown);
  } finally {
    if (originalExecPath !== undefined) process.env.CLAUDE_CODE_EXECPATH = originalExecPath;
    process.env.PATH = originalPath;
  }
});

test('formatHandoffStatus reports zero pending items plainly, pointing at the handoff file', () => {
  const output = formatHandoffStatus(0);
  assert.match(output, /agent-instructions\.md/);
  assert.match(output, /pending\.json/);
});

test('formatHandoffStatus reports a nonzero pending count and points at `juntia confirm`', () => {
  const output = formatHandoffStatus(2);
  assert.match(output, /2 pending interpretation\(s\)/);
  assert.match(output, /juntia confirm/);
});

test('--explain reports existing pending items already waiting, without touching them', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  await silently(() => runAnalyze(root));
  upsertPending(root, {
    interpretation: 'This project appears to use Phaser.',
    confidence: 'medium',
    basedOn: ['dependency:phaser'],
    unknowns: [],
  });

  let captured = '';
  const originalLog = console.log;
  console.log = (line = '') => { captured += `${line}\n`; };
  try {
    await runAnalyze(root, { explain: true });
  } finally {
    console.log = originalLog;
  }

  assert.match(captured, /1 pending interpretation\(s\) already waiting/);
});
