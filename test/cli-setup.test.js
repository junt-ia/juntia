'use strict';

// Phase 13A — tests for bin/juntia.js's `setup` command: the Setup
// Orchestrator. Every real operation it coordinates (init/analyze/facts/
// explain/confirm/context/integrate) is already covered by its own test
// file — this file focuses on what the orchestrator itself adds:
// sequencing, idempotency, the assistant-selection prompt, and
// user-facing error messages. A mock adapter and a scripted prompt stand
// in for the AI runtime and a real human, same discipline as
// test/cli-confirm-context.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runSetup, runInit, formatSetupDetected, formatRuntimeFailure,
} = require('../bin/juntia.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending } = require('../lib/project-intelligence/pending-store.js');
const { readRuntimeProvider, parseIntegrationsBlock } = require('../lib/project-intelligence/agent-integration.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-setup-test-'));
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

function mockAdapter(interpretation) {
  return {
    interpret: async () => ({ ok: true, raw: JSON.stringify(interpretation), durationMs: 100 }),
  };
}

function failingAdapter(error, message) {
  return { interpret: async () => ({ ok: false, error, message, durationMs: 5 }) };
}

function scriptedPrompt(answers) {
  let i = 0;
  return async () => answers[i++];
}

const PHASER_INTERPRETATION = {
  interpretation: 'This project appears to use Phaser as its main engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser'],
  unknowns: [],
};

// --- setup on an empty project -----------------------------------------------

test('setup on a completely empty project completes without crashing, and creates .juntia', async () => {
  const root = tempProject();
  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  assert.match(output, /Welcome to Juntia/);
  assert.match(output, /Juntia is ready/);
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'config.yml')));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'facts.json')));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'context.md')));
});

test('setup formatSetupDetected reports honestly when nothing is recognized', () => {
  const emptyResult = { identity: { languages: [], technologies: [] } };
  assert.match(formatSetupDetected(emptyResult), /Nothing recognized/);
});

// --- setup on a real, non-empty project -------------------------------------

test('setup on a real Phaser-shaped project detects real facts and reports them plainly', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  assert.match(output, /Detected:/);
  assert.match(output, /✓ phaser/);
  assert.match(output, /✓ Facts generated/);
});

test('setup never modifies real project source files', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, 'src/index.ts', 'export const real = true;');
  const before = fs.readFileSync(path.join(root, 'src', 'index.ts'), 'utf8');

  await silently(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  assert.equal(fs.readFileSync(path.join(root, 'src', 'index.ts'), 'utf8'), before);
});

// --- runtime selection --------------------------------------------------------

test('choosing "1" (Claude Code) records runtime.provider and creates a real, working CLAUDE.md', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  const result = await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  assert.equal(result.provider, 'claude-code');
  assert.equal(result.integrateResult.ok, true);
  const configText = fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8');
  assert.equal(readRuntimeProvider(configText), 'claude-code');
  assert.deepEqual(parseIntegrationsBlock(configText), ['claude-code']);
  assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')));
});

test('choosing "0" (skip) leaves runtime.provider unset and creates no integration file', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  const result = await silently(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  assert.equal(result.provider, null);
  assert.equal(result.integrateResult, null);
  assert.equal(fs.existsSync(path.join(root, 'CLAUDE.md')), false);
});

test('an empty answer at the assistant prompt is treated the same as "skip"', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  const result = await silently(() => runSetup(root, { prompt: scriptedPrompt(['']) }));
  assert.equal(result.provider, null);
});

test('the assistant prompt lists planned providers as visibly unavailable, never selectable', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));
  assert.match(output, /OpenAI Codex \(coming soon\)/);
  assert.match(output, /Gemini CLI \(coming soon\)/);
  assert.match(output, /Cursor \(coming soon\)/);
});

// --- protecting existing files ------------------------------------------------

test('a pre-existing, real (non-generated) CLAUDE.md is never overwritten by setup', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  writeFile(root, 'CLAUDE.md', '# Our real team conventions\n\nDo not touch.\n');

  const result = await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  assert.equal(result.integrateResult.ok, false);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '# Our real team conventions\n\nDo not touch.\n');
});

// --- absence / failure of the runtime -----------------------------------------

test('formatRuntimeFailure turns a raw binary_not_found error into a plain, actionable sentence', () => {
  const msg = formatRuntimeFailure({ reason: 'runtime failure: binary_not_found — spawn claude ENOENT' });
  assert.equal(msg, 'Claude Code is configured but unavailable. Install Claude Code or choose another assistant.');
  assert.doesNotMatch(msg, /ENOENT|spawn/);
});

test('formatRuntimeFailure handles a timeout without leaking raw process detail', () => {
  const msg = formatRuntimeFailure({ reason: 'runtime failure: timeout — killed after 30000ms' });
  assert.doesNotMatch(msg, /30000ms|killed/);
  assert.match(msg, /took too long/);
});

test('a real runtime failure (binary not found) during the second run\'s explain step is reported in plain language, and setup still finishes', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) })); // configures claude-code

  const adapter = failingAdapter('binary_not_found', 'spawn claude ENOENT');
  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt([]), adapter }));

  assert.match(output, /Claude Code is configured but unavailable/);
  assert.doesNotMatch(output, /ENOENT/);
  assert.match(output, /Juntia is ready/);
});

// --- idempotent second run ----------------------------------------------------

test('a second run reports "Already initialized" and never re-scaffolds', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));
  assert.match(output, /✓ Already initialized/);
  assert.doesNotMatch(output, /Initializing project\.\.\./);
});

test('a second run with an already-configured assistant never asks again, and reports it as already configured', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  const adapter = mockAdapter(PHASER_INTERPRETATION);
  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['y']), adapter }));

  assert.match(output, /AI assistant already configured: claude-code/);
  assert.doesNotMatch(output, /Which AI assistant do you use\?/);
  assert.match(output, /CLAUDE\.md already configured/);
});

test('running setup twice never duplicates the integrations list or the CLAUDE.md file content', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));
  const firstClaude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

  // claude-code is already configured from the first run, so this second
  // call's own explain step will fire — a mock adapter is required here to
  // keep this suite fast/offline (no live call), same as every other test
  // in this file that runs setup a second time.
  const adapter = mockAdapter(PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['0']), adapter }));

  const configText = fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8');
  assert.deepEqual(parseIntegrationsBlock(configText), ['claude-code']);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), firstClaude);
});

test('running setup twice with an identical mock interpretation never creates a second, duplicate decision', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) })); // configure only, no explain yet

  const adapter = mockAdapter(PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']), adapter })); // explain + confirm
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']), adapter })); // same interpretation again

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1, 'an identical interpretation (same basedOn) must not create a second decision');
});

test('setup never leaves a stray pending item behind once a decision is confirmed', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  const adapter = mockAdapter(PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']), adapter }));

  assert.deepEqual(loadPending(root).items, []);
});

// --- context is not duplicated / stays valid ----------------------------------

test('context.md is refreshed, not duplicated, and always reflects only confirmed decisions', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  const adapter = mockAdapter(PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']), adapter }));

  const contextFiles = fs.readdirSync(path.join(root, '.juntia')).filter((f) => f.startsWith('context'));
  assert.deepEqual(contextFiles, ['context.md']);
  const content = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
  assert.match(content, /This project appears to use Phaser as its main engine\./);
});

// --- rejecting an interpretation during setup ---------------------------------

test('answering "n" during setup\'s own confirm step rejects the interpretation and creates no decision', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  const adapter = mockAdapter(PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['n']), adapter }));

  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- runInit still works standalone, unaffected by setup's existence ----------

test('the standalone `juntia init` command is untouched by this phase', () => {
  const root = tempProject();
  silently(() => runInit(root));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'config.yml')));
});
