'use strict';

// Phase 13A — tests for bin/juntia.js's `setup` command: the Setup
// Orchestrator. Every real operation it coordinates (init/analyze/facts/
// confirm/context/integrate) is already covered by its own test file — this
// file focuses on what the orchestrator itself adds: sequencing,
// idempotency, the assistant-selection prompt, and user-facing messages.
//
// Redefined by Phase 13D: `setup` no longer calls an AI runtime itself (no
// adapter parameter exists anymore) — its own role in the AI Handoff is to
// review whatever proposals are already sitting in `.juntia/pending.json`
// (seeded directly via `upsertPending`, standing in for what an external AI
// agent would have written) and to point the user at their configured
// assistant once one is set up. A scripted `prompt` function stands in for
// a real human, same discipline as before.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runSetup, runInit, formatSetupDetected,
} = require('../bin/juntia.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending, upsertPending } = require('../lib/project-intelligence/pending-store.js');
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

test('choosing "1" (Claude Code) records runtime.provider and creates a real, working CLAUDE.md and agent-instructions.md', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  const result = await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  assert.equal(result.provider, 'claude-code');
  assert.equal(result.integrateResult.ok, true);
  const configText = fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8');
  assert.equal(readRuntimeProvider(configText), 'claude-code');
  assert.deepEqual(parseIntegrationsBlock(configText), ['claude-code']);
  assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'agent-instructions.md')));
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

test('once an assistant is configured, setup tells the user to open it and follow the handoff instructions', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));
  assert.match(output, /Open Claude Code and ask it to follow \.juntia\/agent-instructions\.md/);
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

// --- reviewing what an AI agent already proposed -------------------------------

test('setup never calls any AI runtime itself — no adapter option exists, and it completes with no network/subprocess access at all', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  const originalExecPath = process.env.CLAUDE_CODE_EXECPATH;
  const originalPath = process.env.PATH;
  delete process.env.CLAUDE_CODE_EXECPATH;
  process.env.PATH = '';
  try {
    const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));
    assert.match(output, /Juntia is ready/);
  } finally {
    if (originalExecPath !== undefined) process.env.CLAUDE_CODE_EXECPATH = originalExecPath;
    process.env.PATH = originalPath;
  }
});

test('a pending proposal already sitting in pending.json (from a prior AI Handoff) is reviewed during setup, without setup generating it itself', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) })); // configure only

  upsertPending(root, PHASER_INTERPRETATION); // stands in for an external agent's write

  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt(['y']) }));

  assert.match(output, /pending interpretation\(s\) from your AI assistant found/);
  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, PHASER_INTERPRETATION.interpretation);
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

  const { output } = await captureLog(() => runSetup(root, { prompt: scriptedPrompt([]) }));

  assert.match(output, /AI assistant already configured: claude-code/);
  assert.doesNotMatch(output, /Which AI assistant do you use\?/);
  assert.match(output, /CLAUDE\.md already configured/);
});

test('running setup twice never duplicates the integrations list or the CLAUDE.md file content', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));
  const firstClaude = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

  await silently(() => runSetup(root, { prompt: scriptedPrompt(['0']) }));

  const configText = fs.readFileSync(path.join(root, '.juntia', 'config.yml'), 'utf8');
  assert.deepEqual(parseIntegrationsBlock(configText), ['claude-code']);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), firstClaude);
});

test('running setup twice with the same proposal seeded each time never creates a second, duplicate decision', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) })); // configure only, no proposal yet

  upsertPending(root, PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']) })); // reviews + confirms

  upsertPending(root, PHASER_INTERPRETATION); // same interpretation proposed again
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']) }));

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1, 'an identical interpretation (same basedOn) must not create a second decision');
});

test('setup never leaves a stray pending item behind once a decision is confirmed', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  upsertPending(root, PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']) }));

  assert.deepEqual(loadPending(root).items, []);
});

// --- context is not duplicated / stays valid ----------------------------------

test('context.md is refreshed, not duplicated, and always reflects only confirmed decisions', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['1']) }));

  upsertPending(root, PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['y']) }));

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

  upsertPending(root, PHASER_INTERPRETATION);
  await silently(() => runSetup(root, { prompt: scriptedPrompt(['n']) }));

  assert.deepEqual(loadDecisions(root).decisions, []);
});

// --- runInit still works standalone, unaffected by setup's existence ----------

test('the standalone `juntia init` command is untouched by this phase', () => {
  const root = tempProject();
  silently(() => runInit(root));
  assert.ok(fs.existsSync(path.join(root, '.juntia', 'config.yml')));
});
