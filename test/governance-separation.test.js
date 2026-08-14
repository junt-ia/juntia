'use strict';

// Phase 14A — cross-module tests verifying the real separation of
// responsibility the brief required between the governance files: context
// (what the project is) never contains behavioral instructions, and
// decisions (what's been decided) are never conflated with raw facts. Both
// properties were already true by construction before this phase (Phase
// 12H/12I/12K's own fact/decision-tier boundary) — these tests assert that
// explicitly rather than leaving it as an unstated assumption once a fifth,
// behavioral file (`agent-rules.md`) entered the picture.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, runConfirm, runContext } = require('../bin/juntia.js');
const { generateContext } = require('../lib/project-intelligence/context-generator.js');
const { buildAgentRules } = require('../lib/project-intelligence/agent-governance.js');
const { loadFacts } = require('../lib/project-intelligence/facts-store.js');
const { upsertPending } = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-sep-test-'));
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

function scriptedPrompt(answers) {
  let i = 0;
  return async () => answers[i++];
}

test('context.md (what this project is) never contains a behavioral instruction — that is agent-rules.md\'s job', () => {
  const markdown = generateContext(
    [{ category: 'dependency', name: 'phaser', value: '^3.60.0', evidence: { source: 'package.json' } }],
    [{
      id: 'x', text: 'Phaser is the main engine.', confidence: 'high', basedOn: ['dependency:phaser'], unknowns: [], confirmedAt: '2026-08-14T00:00:00.000Z', status: 'active',
    }],
  );
  for (const phrase of ['Analyze before modifying', 'Never introduce a dependency', 'Validate changes']) {
    assert.doesNotMatch(markdown, new RegExp(phrase));
  }
});

test('agent-rules.md (how to behave) never contains this project\'s own specific facts', () => {
  const rules = buildAgentRules();
  assert.doesNotMatch(rules, /phaser/i);
  assert.doesNotMatch(rules, /TypeScript/);
});

test('decisions.json never contains a raw, unconfirmed fact — only what a human actually confirmed', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0', express: '^4.0.0' } }));
  await silently(() => runAnalyze(root));

  // Only "phaser" is proposed and confirmed — "express" is a real fact but
  // was never proposed as part of any interpretation.
  upsertPending(root, {
    interpretation: 'This project appears to use Phaser as its main engine.',
    confidence: 'medium',
    basedOn: ['dependency:phaser'],
    unknowns: [],
  });
  const result = await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  assert.equal(result.confirmed.length, 1);
  const facts = loadFacts(root).document.facts;
  assert.ok(facts.some((f) => f.name === 'express'), 'express must still be a real, persisted fact');

  const decisionsPath = path.join(root, '.juntia', 'decisions.json');
  const decisionsText = fs.readFileSync(decisionsPath, 'utf8');
  assert.doesNotMatch(decisionsText, /express/, 'a fact never proposed/confirmed must not leak into decisions.json');
});

test('juntia context (facts + confirmed decisions) and juntia\'s own DECISIONS.md narrative stay consistent with each other, never contradicting', async () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  await silently(() => runAnalyze(root));
  upsertPending(root, {
    interpretation: 'This project appears to use Phaser as its main engine.',
    confidence: 'medium',
    basedOn: ['dependency:phaser'],
    unknowns: [],
  });
  await silently(() => runConfirm(root, { prompt: scriptedPrompt(['y']) }));

  const contextMd = silently(() => runContext(root));
  const decisionsMd = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');

  assert.match(contextMd, /This project appears to use Phaser as its main engine\./);
  assert.match(decisionsMd, /This project appears to use Phaser as its main engine\./);
});
