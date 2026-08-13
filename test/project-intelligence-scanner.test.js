'use strict';

// Phase 12E — tests for lib/project-intelligence/scanner.js against real,
// on-disk fixture projects (a real package.json/tsconfig.json/pyproject.toml
// written to a real temp directory, not mocked file reads) — matching this
// migration's standing preference for real, executed evidence over
// simulated input.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-scan-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

test('Node/TypeScript project: detects package.json, TypeScript files, and declared dependencies', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({
    name: 'demo', dependencies: { express: '^4.0.0' }, devDependencies: { typescript: '^5.0.0' },
  }));
  writeFile(root, 'tsconfig.json', '{}');
  writeFile(root, 'src/index.ts', 'export const x = 1;');

  const result = scanProject(root);

  assert.ok(result.manifests.includes('package.json'));
  assert.ok(result.identity.languages.some((l) => l.name === 'TypeScript' && l.fileCount === 1));
  assert.ok(result.dependencies.some((d) => d.name === 'express' && d.source === 'package.json'));
  assert.ok(result.dependencies.some((d) => d.name === 'typescript'));
  assert.ok(result.structure.directories.includes('src'));
  // every dependency and language fact carries its own evidence
  const expressDep = result.dependencies.find((d) => d.name === 'express');
  assert.ok(expressDep.evidence.length > 0);
});

test('Phaser project: detects the phaser dependency and structure as raw facts, never as an interpretation', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ name: 'game', dependencies: { phaser: '^3.0.0' } }));
  writeFile(root, 'src/main.js', 'console.log("start");');
  writeFile(root, 'assets/sprite.png', 'binary-placeholder');

  const result = scanProject(root);

  assert.ok(result.dependencies.some((d) => d.name === 'phaser'));
  assert.ok(result.identity.technologies.some((t) => t.name === 'phaser'));
  assert.ok(result.identity.languages.some((l) => l.name === 'JavaScript'));
  assert.ok(result.structure.directories.includes('assets'));
  assert.ok(result.structure.directories.includes('src'));

  // The scanner must never interpret "phaser present" as "this is a video
  // game" — no such string should appear anywhere in its real JSON output.
  const serialized = JSON.stringify(result).toLowerCase();
  assert.ok(!serialized.includes('game'), 'scanner output must not contain an interpretive "game" label');
  assert.ok(!serialized.includes('videojuego'));
});

test('Python project: detects pyproject.toml and Python files', () => {
  const root = tempProject();
  writeFile(root, 'pyproject.toml', '[project]\nname = "demo"\n');
  writeFile(root, 'src/main.py', 'print("hi")\n');
  writeFile(root, 'src/utils.py', 'def f(): pass\n');

  const result = scanProject(root);

  assert.ok(result.manifests.includes('pyproject.toml'));
  const python = result.identity.languages.find((l) => l.name === 'Python');
  assert.ok(python);
  assert.equal(python.fileCount, 2);
});

test('Unknown/empty project: every fact stays empty, nothing is invented', () => {
  const root = tempProject();

  const result = scanProject(root);

  assert.deepEqual(result.manifests, []);
  assert.deepEqual(result.identity.languages, []);
  assert.deepEqual(result.identity.technologies, []);
  assert.deepEqual(result.dependencies, []);
  assert.deepEqual(result.structure.directories, []);
  assert.deepEqual(result.structure.files, []);
  assert.deepEqual(result.evidence, []);
});

test('scanner skips node_modules and .git when detecting languages and structure', () => {
  const root = tempProject();
  writeFile(root, 'node_modules/some-pkg/index.js', 'module.exports = {};');
  writeFile(root, '.git/HEAD', 'ref: refs/heads/main');
  writeFile(root, 'index.js', 'console.log(1);');

  const result = scanProject(root);

  const js = result.identity.languages.find((l) => l.name === 'JavaScript');
  assert.equal(js.fileCount, 1); // only the real, top-level index.js
  assert.ok(!result.structure.directories.includes('node_modules'));
  assert.ok(!result.structure.directories.includes('.git'));
});

test('a config file naming the same tool as a declared dependency is not reported twice (vite + vite.config.js)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ devDependencies: { vite: '^5.0.0' } }));
  writeFile(root, 'vite.config.js', 'export default {};');

  const result = scanProject(root);

  const viteEntries = result.identity.technologies.filter((t) => t.name.toLowerCase().startsWith('vite'));
  assert.equal(viteEntries.length, 1);
  assert.equal(viteEntries[0].name, 'vite');
});

test('a config file with no matching dependency is still reported (tsconfig.json alone)', () => {
  const root = tempProject();
  writeFile(root, 'tsconfig.json', '{}');

  const result = scanProject(root);

  assert.ok(result.identity.technologies.some((t) => t.name === 'tsconfig.json'));
});

test('every dependency and language fact is traceable to real evidence, not a bare claim', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { react: '^18.0.0' } }));
  writeFile(root, 'src/App.jsx', 'export default function App() {}');

  const result = scanProject(root);

  for (const dep of result.dependencies) {
    assert.ok(Array.isArray(dep.evidence) && dep.evidence.length > 0, `${dep.name} must carry evidence`);
  }
  for (const lang of result.identity.languages) {
    assert.ok(Array.isArray(lang.evidence) && lang.evidence.length > 0, `${lang.name} must carry evidence`);
  }
});
