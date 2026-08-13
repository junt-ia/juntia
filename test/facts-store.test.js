'use strict';

// Phase 12I — tests for lib/project-intelligence/facts-store.js against
// real, on-disk fixture projects and real scanProject() output — not
// mocked. Covers the brief's own required cases: first run creates a
// baseline, an unchanged second run reports no diff, adding/removing/
// changing a dependency is detected, every persisted fact carries
// evidence, and a corrupt/incompatible facts.json is treated as UNKNOWN
// rather than crashing or silently misreporting.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');
const {
  SCHEMA_VERSION, factsFromScanResult, loadFacts, saveFacts, compareFacts,
} = require('../lib/project-intelligence/facts-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-facts-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('loadFacts on a project with no baseline yet returns exists:false', () => {
  const root = tempProject();
  assert.deepEqual(loadFacts(root), { exists: false });
});

test('saveFacts then loadFacts round-trips real facts, tagged with the current schema version', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0' } }));
  const facts = factsFromScanResult(scanProject(root));

  saveFacts(root, facts);
  const loaded = loadFacts(root);

  assert.equal(loaded.exists, true);
  assert.equal(loaded.unknown, false);
  assert.equal(loaded.document.schemaVersion, SCHEMA_VERSION);
  assert.ok(loaded.document.scannedAt);
  assert.deepEqual(loaded.document.facts, facts);
});

test('saveFacts creates .juntia/.gitignore excluding facts.json, and never overwrites an existing one', () => {
  const root = tempProject();
  saveFacts(root, []);
  const gitignorePath = path.join(root, '.juntia', '.gitignore');
  assert.equal(fs.readFileSync(gitignorePath, 'utf8'), 'facts.json\n');

  fs.writeFileSync(gitignorePath, 'facts.json\nsomething-else\n');
  saveFacts(root, []); // second save must not clobber a customized .gitignore
  assert.equal(fs.readFileSync(gitignorePath, 'utf8'), 'facts.json\nsomething-else\n');
});

test('every persisted fact carries real, non-empty evidence', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { react: '^18.0.0' }, devDependencies: { vite: '^5.0.0' } }));
  writeFile(root, 'src/App.jsx', 'export default function App() {}');
  writeFile(root, 'vite.config.js', 'export default {};');

  const facts = factsFromScanResult(scanProject(root));
  assert.ok(facts.length > 0);
  for (const fact of facts) {
    assert.ok(fact.evidence && typeof fact.evidence === 'object', `${fact.category}:${fact.name} must carry an evidence object`);
    assert.ok(fact.evidence.source, `${fact.category}:${fact.name} must cite a source`);
  }
});

test('compareFacts on two identical fact lists reports no changes', () => {
  const facts = [{ category: 'dependency', name: 'phaser', value: '^3.0.0', evidence: { source: 'package.json' } }];
  const diff = compareFacts(facts, facts.map((f) => ({ ...f })));
  assert.deepEqual(diff, { added: [], removed: [], changed: [] });
});

test('compareFacts detects ADDED when a new fact appears', () => {
  const oldFacts = [{ category: 'dependency', name: 'phaser', value: '^3.0.0', evidence: {} }];
  const newFacts = [...oldFacts, { category: 'dependency', name: 'vite-plugin-x', value: '^1.0.0', evidence: {} }];
  const diff = compareFacts(oldFacts, newFacts);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].name, 'vite-plugin-x');
  assert.deepEqual(diff.removed, []);
  assert.deepEqual(diff.changed, []);
});

test('compareFacts detects REMOVED when a fact disappears', () => {
  const oldFacts = [
    { category: 'dependency', name: 'phaser', value: '^3.0.0', evidence: {} },
    { category: 'dependency', name: 'package-y', value: '^1.0.0', evidence: {} },
  ];
  const newFacts = [oldFacts[0]];
  const diff = compareFacts(oldFacts, newFacts);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].name, 'package-y');
  assert.deepEqual(diff.added, []);
});

test('compareFacts detects CHANGED when a fact\'s value differs (e.g. a dependency version bump)', () => {
  const oldFacts = [{ category: 'dependency', name: 'typescript', value: '5.5.0', evidence: {} }];
  const newFacts = [{ category: 'dependency', name: 'typescript', value: '5.6.0', evidence: {} }];
  const diff = compareFacts(oldFacts, newFacts);
  assert.deepEqual(diff.changed, [{ category: 'dependency', name: 'typescript', from: '5.5.0', to: '5.6.0' }]);
});

test('compareFacts never flags a presence-only fact (manifest/technology/structure) as CHANGED — only added or removed', () => {
  const oldFacts = [{ category: 'manifest', name: 'package.json', evidence: {} }];
  const newFacts = [{ category: 'manifest', name: 'package.json', evidence: { source: 'a different evidence blob, still no value field' } }];
  const diff = compareFacts(oldFacts, newFacts);
  assert.deepEqual(diff, { added: [], removed: [], changed: [] });
});

test('a real end-to-end sequence: first analyze-equivalent run creates a baseline, then dependency add/remove/change are all detected together', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.0.0', 'package-y': '^1.0.0' }, devDependencies: { typescript: '5.5.0' } }));

  const firstScan = factsFromScanResult(scanProject(root));
  saveFacts(root, firstScan);

  // Real project evolution: phaser upgraded, package-y removed, vite-plugin-x added, typescript upgraded.
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^4.0.0', 'vite-plugin-x': '^1.0.0' }, devDependencies: { typescript: '5.6.0' } }));
  const secondScan = factsFromScanResult(scanProject(root));

  const previous = loadFacts(root);
  assert.equal(previous.unknown, false);
  const diff = compareFacts(previous.document.facts, secondScan);

  assert.ok(diff.added.some((f) => f.name === 'vite-plugin-x'));
  assert.ok(diff.removed.some((f) => f.name === 'package-y'));
  assert.ok(diff.changed.some((c) => c.name === 'phaser' && c.from === '^3.0.0' && c.to === '^4.0.0'));
  assert.ok(diff.changed.some((c) => c.name === 'typescript' && c.from === '5.5.0' && c.to === '5.6.0'));
});

test('loadFacts reports UNKNOWN (not a crash, not a false "no baseline") for a corrupt facts.json', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'facts.json'), '{ not valid json');

  const result = loadFacts(root);
  assert.equal(result.exists, true);
  assert.equal(result.unknown, true);
  assert.ok(result.reason);
});

test('loadFacts reports UNKNOWN for a facts.json with an incompatible schema version', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'facts.json'), JSON.stringify({ schemaVersion: 999, facts: [] }));

  const result = loadFacts(root);
  assert.equal(result.unknown, true);
  assert.match(result.reason, /schemaVersion/);
});

test('loadFacts reports UNKNOWN for a facts.json that is valid JSON but not a recognized facts document', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'facts.json'), JSON.stringify({ hello: 'world' }));

  const result = loadFacts(root);
  assert.equal(result.unknown, true);
});
