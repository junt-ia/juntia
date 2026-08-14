'use strict';

// Phase 13B — tests for bin/juntia.js's runtime-resolution behavior: after
// this phase, `analyze --explain` (and `setup`'s own explain step) never
// silently default to the Claude CLI adapter. They read
// `.juntia/config.yml`'s real `runtime.provider`, resolve it via
// lib/runtime/provider-registry.js, and report plainly when nothing
// resolves — never a guess, never a raw process error.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAnalyze, runSetup, resolveConfiguredAdapter, formatUnresolvedRuntime,
} = require('../bin/juntia.js');
const { withRuntimeProvider } = require('../lib/project-intelligence/agent-integration.js');
const { loadPending } = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-runtime-resolution-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

async function captureLog(fn) {
  let captured = '';
  const originalLog = console.log;
  console.log = (line = '') => { captured += `${line}\n`; };
  try {
    await fn();
  } finally {
    console.log = originalLog;
  }
  return { output: captured };
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

function writeConfiguredProvider(root, provider) {
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  const existing = fs.existsSync(path.join(root, '.juntia', 'config.yml'))
    ? fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8')
    : 'schema_version: 1\n';
  fs.writeFileSync(path.join(root, '.juntia', 'config.yml'), withRuntimeProvider(existing, provider));
}

function mockAdapter(interpretation) {
  return { interpret: async () => ({ ok: true, raw: JSON.stringify(interpretation), durationMs: 50 }) };
}

const PHASER_INTERPRETATION = {
  interpretation: 'This project appears to use Phaser.',
  confidence: 'medium',
  basedOn: ['dependency:phaser'],
  unknowns: [],
};

// --- resolveConfiguredAdapter (pure, no I/O beyond reading config.yml) ------

test('resolveConfiguredAdapter with no config.yml at all reports "not configured", not an error', () => {
  const root = tempProject();
  const result = resolveConfiguredAdapter(root);
  assert.equal(result.ok, false);
  assert.equal(result.provider, null);
});

test('resolveConfiguredAdapter with runtime.provider: claude-code resolves the real adapter', () => {
  const root = tempProject();
  writeConfiguredProvider(root, 'claude-code');
  const result = resolveConfiguredAdapter(root);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'claude-code');
  assert.equal(typeof result.adapter.interpret, 'function');
});

test('resolveConfiguredAdapter with an unsupported provider name reports it precisely, distinct from "unconfigured"', () => {
  const root = tempProject();
  writeConfiguredProvider(root, 'openai');
  const result = resolveConfiguredAdapter(root);
  assert.equal(result.ok, false);
  assert.equal(result.provider, 'openai', 'a real, if unusable, configured value must still be reported back');
  assert.match(result.reason, /doesn't have a runtime adapter/);
});

test('formatUnresolvedRuntime distinguishes "nothing configured" from "configured but unusable"', () => {
  assert.match(formatUnresolvedRuntime({ provider: null }), /No AI assistant configured yet/);
  assert.match(
    formatUnresolvedRuntime({ provider: 'openai', reason: 'Juntia doesn\'t have a runtime adapter for "openai" yet' }),
    /"openai" is configured/,
  );
});

// --- analyze --explain: real config-based resolution, no injected adapter --

test('analyze --explain with no runtime configured and no injected adapter reports plainly and does not crash', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  const { output } = await captureLog(() => runAnalyze(root, { explain: true }));

  assert.match(output, /No AI assistant configured yet/);
  assert.match(output, /juntia setup/);
});

test('analyze --explain still persists facts.json even when no runtime is configured — analysis itself must not break', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  await silently(() => runAnalyze(root, { explain: true }));

  assert.ok(fs.existsSync(path.join(root, '.juntia', 'facts.json')));
});

test('analyze --explain with an unsupported configured provider reports the specific reason, never a raw crash', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  writeConfiguredProvider(root, 'openai');

  const { output } = await captureLog(() => runAnalyze(root, { explain: true }));

  assert.match(output, /"openai" is configured/);
  assert.match(output, /doesn't have a runtime adapter/);
});

test('analyze --explain with runtime.provider: claude-code configured (and no injected adapter) resolves the real adapter — proven via a real, controlled failure, not a live call', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  writeConfiguredProvider(root, 'claude-code');

  // No live call is made in this fast/offline suite — CLAUDE_CODE_EXECPATH
  // is cleared so the real adapter's own real resolution logic fails fast
  // and safely (binary_not_found), proving the REAL adapter was reached via
  // config resolution (not a mock) without spawning a real, slow process.
  const originalExecPath = process.env.CLAUDE_CODE_EXECPATH;
  const originalPath = process.env.PATH;
  delete process.env.CLAUDE_CODE_EXECPATH;
  process.env.PATH = '';
  let output;
  try {
    ({ output } = await captureLog(() => runAnalyze(root, { explain: true })));
  } finally {
    if (originalExecPath !== undefined) process.env.CLAUDE_CODE_EXECPATH = originalExecPath;
    process.env.PATH = originalPath;
  }

  assert.match(output, /Claude Code is configured but unavailable/);
  assert.doesNotMatch(output, /No AI assistant configured yet/);
});

test('an explicitly injected adapter always wins over config resolution (existing tests/programmatic callers unaffected)', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  writeConfiguredProvider(root, 'openai'); // unsupported — would fail resolution on its own

  const synthesis = await silently(() => runAnalyze(root, { explain: true, adapter: mockAdapter(PHASER_INTERPRETATION) }));

  assert.equal(synthesis.ok, true, 'the injected adapter must be used regardless of what config.yml says');
});

// --- setup: consistent with analyze --explain, same resolution path --------

test('setup\'s own explain step uses the same resolution as analyze --explain — an unsupported configured provider is reported, not silently skipped without explanation', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));

  await silently(() => runSetup(root, { prompt: async () => '0' })); // init/analyze/context only, skip assistant
  writeConfiguredProvider(root, 'openai'); // simulate a hand-edited or future-provider config

  const { output } = await captureLog(() => runSetup(root, { prompt: async () => '0', adapter: undefined }));

  assert.match(output, /"openai" is configured, but/);
  assert.deepEqual(loadPending(root).items, [], 'no pending item should be created when the runtime never resolved');
});
