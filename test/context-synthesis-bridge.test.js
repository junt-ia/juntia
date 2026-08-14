'use strict';

// Phase 12J — deterministic unit tests for
// lib/project-intelligence/context-synthesis-bridge.js.
//
// Narrowed by Phase 13D: `synthesizeContext` (the part that invoked an
// injected AI adapter) was removed once that internal-execution
// architecture was retired in favor of the AI Handoff — see
// phases/13d-ai-handoff-implementation.md and
// lib/project-intelligence/agent-handoff.js, which is now the real consumer
// of `buildRequestText`. What remains here is exactly what remains in the
// module: the pure, deterministic FACTS/CHANGES/EXISTING CONTEXT renderer.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRequestText } = require('../lib/project-intelligence/context-synthesis-bridge.js');

const FACTS = [
  { category: 'dependency', name: 'phaser', value: '^3.60.0', evidence: { source: 'package.json' } },
  { category: 'structure.directory', name: 'src/scenes', evidence: { source: 'scan' } },
];
const EMPTY_DIFF = { added: [], removed: [], changed: [] };

test('buildRequestText renders every fact by its exact factKey identifier and includes the diff', () => {
  const diff = { added: [{ category: 'dependency', name: 'phaser' }], removed: [], changed: [] };
  const text = buildRequestText(FACTS, diff);
  assert.match(text, /FACTS:/);
  assert.match(text, /- id:\[dependency:phaser\] value:"\^3\.60\.0" evidence:package\.json/);
  assert.match(text, /- id:\[structure\.directory:src\/scenes\] evidence:scan/);
  assert.match(text, /CHANGES:/);
  assert.match(text, /\+ added: dependency:phaser/);
  assert.match(text, /EXISTING CONTEXT:/);
});

test('buildRequestText reports no changes plainly when the diff is empty', () => {
  const text = buildRequestText(FACTS, EMPTY_DIFF);
  assert.match(text, /No changes since the previous scan/);
});

test('buildRequestText reports no changes plainly when the diff is omitted entirely', () => {
  const text = buildRequestText(FACTS, undefined);
  assert.match(text, /No changes since the previous scan/);
});

// Phase 12K: EXISTING CONTEXT reflects real confirmed decisions, closing a
// real gap Phase 12J left (its own text always claimed "none persisted
// yet", which became false the moment decisions.json became real).
test('buildRequestText with no decisions still says none exist (unchanged default)', () => {
  const text = buildRequestText(FACTS, EMPTY_DIFF);
  assert.match(text, /none persisted yet/);
});

test('buildRequestText with a real confirmed decision includes it as EXISTING CONTEXT', () => {
  const decisions = [{ id: 'x', text: 'Phaser is the main engine.', status: 'active' }];
  const text = buildRequestText(FACTS, EMPTY_DIFF, decisions);
  assert.match(text, /EXISTING CONTEXT:\n- Phaser is the main engine\./);
});

test('a conflicted decision is still included in EXISTING CONTEXT, but visibly flagged', () => {
  const decisions = [{ id: 'x', text: 'Phaser is the main engine.', status: 'conflicted' }];
  const text = buildRequestText(FACTS, EMPTY_DIFF, decisions);
  assert.match(text, /Phaser is the main engine\. \[flagged: based on evidence that may no longer be current\]/);
});

test('an empty-facts project renders plainly, never fabricating a fact', () => {
  const text = buildRequestText([], EMPTY_DIFF);
  assert.match(text, /\(no facts — nothing was detected in this project\)/);
});
