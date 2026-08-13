'use strict';

// Phase 12K — tests for lib/project-intelligence/context-generator.js:
// deterministic assembly of .juntia/context.md from confirmed facts and
// confirmed decisions only. The brief's own required check —
// "contexto generado solo contiene información permitida" — is the
// through-line of every test below.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateContext, writeContext } = require('../lib/project-intelligence/context-generator.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-context-test-'));
}

const FACTS = [
  { category: 'manifest', name: 'package.json' },
  { category: 'language', name: 'TypeScript', value: 43 },
  { category: 'technology', name: 'react' },
  { category: 'dependency', name: 'phaser', value: '^3.60.0' },
];

const ACTIVE_DECISION = {
  id: 'main-engine',
  text: 'Phaser is the main engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser'],
  confirmedAt: '2026-08-13T10:00:00.000Z',
  status: 'active',
};

test('an empty project (no facts, no decisions) produces an honest, non-fabricated context — never invented content', () => {
  const md = generateContext([], []);
  assert.match(md, /No facts recorded yet/);
  assert.match(md, /No decisions confirmed yet/);
  assert.doesNotMatch(md, /phaser/i);
});

test('facts are summarized by category, using only real fact names/values', () => {
  const md = generateContext(FACTS, []);
  assert.match(md, /Languages: TypeScript/);
  assert.match(md, /Technologies: react/);
  assert.match(md, /Dependencies: phaser@\^3\.60\.0/);
  assert.match(md, /Manifests: package\.json/);
});

test('a confirmed decision appears with its real evidence citation and confirmation date', () => {
  const md = generateContext(FACTS, [ACTIVE_DECISION]);
  assert.match(md, /Phaser is the main engine\./);
  assert.match(md, /confirmed 2026-08-13/);
  assert.match(md, /based on: dependency:phaser/);
});

test('confidence is never printed next to a decision as if it still needed hedging — a decision is a decision, not a repeated interpretation', () => {
  const md = generateContext(FACTS, [ACTIVE_DECISION]);
  assert.doesNotMatch(md, /confidence: medium/);
});

test('a conflicted decision is flagged inline AND gets its own "Conflicts needing review" section — never silently dropped from Confirmed decisions', () => {
  const conflicted = { ...ACTIVE_DECISION, status: 'conflicted' };
  const md = generateContext([], [conflicted]);
  assert.match(md, /Phaser is the main engine\.\s*\[CONFLICTED/);
  assert.match(md, /## Conflicts needing review/);
  assert.doesNotMatch(md, /was based on evidence[\s\S]*was based on evidence/, 'must not duplicate the same conflict twice');
});

test('no conflicts -> no "Conflicts needing review" section at all (not an empty one)', () => {
  const md = generateContext(FACTS, [ACTIVE_DECISION]);
  assert.doesNotMatch(md, /Conflicts needing review/);
});

test('context.md never contains a pending/unconfirmed interpretation — the generator is never even given one to leak', () => {
  // generateContext's own signature has no `pending` parameter at all —
  // structurally, not just by convention, it cannot include one.
  assert.equal(generateContext.length, 2);
});

test('writeContext writes exactly .juntia/context.md, nothing else', () => {
  const root = tempProject();
  writeContext(root, generateContext(FACTS, [ACTIVE_DECISION]));

  const contents = fs.readdirSync(path.join(root, '.juntia'));
  assert.deepEqual(contents, ['context.md']);
});

test('context.md is NOT git-ignored — no .gitignore entry is created for it', () => {
  const root = tempProject();
  writeContext(root, generateContext(FACTS, []));
  assert.equal(fs.existsSync(path.join(root, '.juntia', '.gitignore')), false);
});
