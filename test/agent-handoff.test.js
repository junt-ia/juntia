'use strict';

// Phase 13D — tests for lib/project-intelligence/agent-handoff.js: the AI
// Handoff this phase implements. Pure/deterministic throughout — no
// adapter, no subprocess, no network — since generating the instructions an
// external AI agent will read is itself never an AI call.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  HANDOFF_FILE, buildHandoffInstructions, writeHandoffInstructions,
} = require('../lib/project-intelligence/agent-handoff.js');
const { validateProjectInterpretation } = require('../lib/runtime/project-interpretation-validator.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-handoff-test-'));
}

const FACTS = [
  { category: 'dependency', name: 'phaser', value: '^3.60.0', evidence: { source: 'package.json' } },
];
const EMPTY_DIFF = { added: [], removed: [], changed: [] };

test('buildHandoffInstructions is pure and deterministic: same inputs, same output', () => {
  const a = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  const b = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.equal(a, b);
});

test('buildHandoffInstructions includes the real facts, never a placeholder or invented one', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.match(markdown, /id:\[dependency:phaser\]/);
  assert.doesNotMatch(markdown, /id:\[dependency:express\]/);
});

test('buildHandoffInstructions explains the expected response format, including confidence/basedOn/unknowns', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.match(markdown, /"interpretation"/);
  assert.match(markdown, /"confidence"/);
  assert.match(markdown, /"basedOn"/);
  assert.match(markdown, /"unknowns"/);
});

test('buildHandoffInstructions names every forbidden governance field, in sync with the real validator', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.match(markdown, /`action`/);
  assert.match(markdown, /`decision`/);
  assert.match(markdown, /`confirmed`/);
});

test('buildHandoffInstructions tells the agent exactly where to write its result', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.match(markdown, /pending\.json/);
  assert.match(markdown, /schemaVersion/);
  assert.match(markdown, /juntia confirm/);
});

test('buildHandoffInstructions never claims to be a fact/decision itself — it only prepares a proposal', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  assert.match(markdown, /never write directly to a decision/);
});

test('the example item embedded in the instructions is itself a real, valid interpretation (passes the real validator)', () => {
  const markdown = buildHandoffInstructions(FACTS, EMPTY_DIFF, []);
  const jsonBlocks = markdown.match(/```json\n([\s\S]*?)\n```/g);
  assert.ok(jsonBlocks && jsonBlocks.length >= 1);
  const firstExample = JSON.parse(jsonBlocks[0].replace(/```json\n/, '').replace(/\n```/, ''));
  const validation = validateProjectInterpretation(firstExample, FACTS);
  assert.equal(validation.valid, true, validation.errors.join('; '));
});

test('writeHandoffInstructions writes to exactly .juntia/agent-instructions.md', () => {
  const root = tempProject();
  writeHandoffInstructions(root, buildHandoffInstructions(FACTS, EMPTY_DIFF, []));

  const targetPath = path.join(root, HANDOFF_FILE);
  assert.ok(fs.existsSync(targetPath));
  assert.equal(HANDOFF_FILE, path.join('.juntia', 'agent-instructions.md'));
});

test('writeHandoffInstructions is safe to call repeatedly, always regenerating the same deterministic content', () => {
  const root = tempProject();
  writeHandoffInstructions(root, buildHandoffInstructions(FACTS, EMPTY_DIFF, []));
  const first = fs.readFileSync(path.join(root, HANDOFF_FILE), 'utf8');

  writeHandoffInstructions(root, buildHandoffInstructions(FACTS, EMPTY_DIFF, []));
  const second = fs.readFileSync(path.join(root, HANDOFF_FILE), 'utf8');

  assert.equal(first, second);
});

test('an empty-facts project still produces valid, honest instructions — no invented fact to point at', () => {
  const markdown = buildHandoffInstructions([], EMPTY_DIFF, []);
  assert.match(markdown, /nothing was detected in this project/);
});
