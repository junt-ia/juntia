'use strict';

// Phase 12K — tests for lib/project-intelligence/pending-store.js. Real
// fs.mkdtempSync fixtures throughout, same discipline as
// test/facts-store.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  interpretationId, loadPending, savePending, upsertPending, removePending, normalizePendingItems,
} = require('../lib/project-intelligence/pending-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-pending-test-'));
}

const INTERPRETATION = {
  interpretation: 'This project appears to use Phaser as its main engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser', 'config:vite.config.ts'],
  unknowns: [],
};

test('loadPending on a project with no pending.json returns an empty, non-crashing result', () => {
  const root = tempProject();
  const r = loadPending(root);
  assert.equal(r.exists, false);
  assert.deepEqual(r.items, []);
});

test('interpretationId is stable regardless of basedOn array order, and different for a different fact set', () => {
  assert.equal(
    interpretationId(['dependency:phaser', 'config:vite.config.ts']),
    interpretationId(['config:vite.config.ts', 'dependency:phaser']),
  );
  assert.notEqual(
    interpretationId(['dependency:phaser']),
    interpretationId(['dependency:phaser', 'config:vite.config.ts']),
  );
});

test('upsertPending creates a real pending.json with status "pending" and a real evidence trail', () => {
  const root = tempProject();
  const id = upsertPending(root, INTERPRETATION);

  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  assert.equal(items[0].status, 'pending');
  assert.equal(items[0].interpretation, INTERPRETATION.interpretation);
  assert.deepEqual(items[0].basedOn, INTERPRETATION.basedOn);
  assert.ok(items[0].createdAt);
});

test('upsertPending run twice with the same basedOn set refreshes the one item instead of duplicating it', () => {
  const root = tempProject();
  const firstId = upsertPending(root, INTERPRETATION);
  const secondId = upsertPending(root, { ...INTERPRETATION, interpretation: 'Refined: this project uses Phaser.' });

  assert.equal(firstId, secondId);
  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].interpretation, 'Refined: this project uses Phaser.');
});

test('upsertPending with a different basedOn set adds a second, distinct item', () => {
  const root = tempProject();
  upsertPending(root, INTERPRETATION);
  upsertPending(root, { ...INTERPRETATION, basedOn: ['language:TypeScript'] });

  const { items } = loadPending(root);
  assert.equal(items.length, 2);
});

test('removePending deletes exactly the named item, leaving the rest untouched', () => {
  const root = tempProject();
  const idA = upsertPending(root, INTERPRETATION);
  upsertPending(root, { ...INTERPRETATION, basedOn: ['language:TypeScript'] });

  removePending(root, idA);

  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.notEqual(items[0].id, idA);
});

test('pending.json is git-ignored by default, via the same scoped .juntia/.gitignore facts.json already uses', () => {
  const root = tempProject();
  upsertPending(root, INTERPRETATION);

  const gitignore = fs.readFileSync(path.join(root, '.juntia', '.gitignore'), 'utf8');
  assert.match(gitignore, /pending\.json/);
});

test('a corrupt pending.json is reported as UNKNOWN, never crashes, never silently treated as empty', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'pending.json'), '{ not json');

  const r = loadPending(root);
  assert.equal(r.unknown, true);
  assert.match(r.reason, /not valid JSON/);
});

// --- normalizePendingItems (Phase 13D) ---------------------------------------
//
// Pending.json can now be written directly by an external AI agent, not
// only by Juntia's own upsertPending — so an item's own `id` can no longer
// be assumed present or trustworthy.

test('normalizePendingItems assigns a stable id to an item written without one, matching what interpretationId would compute', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'pending.json'), JSON.stringify({
    schemaVersion: 1,
    items: [{ interpretation: 'x', confidence: 'medium', basedOn: ['dependency:phaser'], unknowns: [] }],
  }));

  const { items } = normalizePendingItems(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, interpretationId(['dependency:phaser']));
});

test('normalizePendingItems backfills status/createdAt when an externally-written item omits them', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'pending.json'), JSON.stringify({
    schemaVersion: 1,
    items: [{ interpretation: 'x', confidence: 'medium', basedOn: ['dependency:phaser'], unknowns: [] }],
  }));

  const { items } = normalizePendingItems(root);
  assert.equal(items[0].status, 'pending');
  assert.ok(items[0].createdAt);
});

test('normalizePendingItems disambiguates two distinct items that collide on a missing/blank id', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'pending.json'), JSON.stringify({
    schemaVersion: 1,
    items: [
      { id: '', interpretation: 'a', confidence: 'medium', basedOn: ['dependency:phaser'], unknowns: [] },
      { id: '', interpretation: 'b', confidence: 'low', basedOn: ['language:TypeScript'], unknowns: [] },
    ],
  }));

  const { items } = normalizePendingItems(root);
  assert.equal(items.length, 2);
  assert.notEqual(items[0].id, items[1].id);
});

test('normalizePendingItems persists the assigned ids, so a later removePending(id) call can address the exact item', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'pending.json'), JSON.stringify({
    schemaVersion: 1,
    items: [{ interpretation: 'x', confidence: 'medium', basedOn: ['dependency:phaser'], unknowns: [] }],
  }));

  const { items } = normalizePendingItems(root);
  removePending(root, items[0].id);

  assert.deepEqual(loadPending(root).items, []);
});

test('normalizePendingItems leaves an already-well-formed pending.json (from upsertPending) unchanged', () => {
  const root = tempProject();
  upsertPending(root, INTERPRETATION);
  const before = fs.readFileSync(path.join(root, '.juntia', 'pending.json'), 'utf8');

  normalizePendingItems(root);

  assert.equal(fs.readFileSync(path.join(root, '.juntia', 'pending.json'), 'utf8'), before);
});

test('normalizePendingItems on a project with no pending.json returns an empty, non-crashing result', () => {
  const root = tempProject();
  const r = normalizePendingItems(root);
  assert.equal(r.exists, false);
  assert.deepEqual(r.items, []);
});

test('savePending never touches an already-customized .gitignore beyond adding the missing line', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', '.gitignore'), 'facts.json\nsomething-else\n');

  savePending(root, []);

  const gitignore = fs.readFileSync(path.join(root, '.juntia', '.gitignore'), 'utf8');
  assert.equal(gitignore, 'facts.json\nsomething-else\npending.json\n');
});
