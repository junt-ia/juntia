'use strict';

// Dependency Detector — Phase 12E of the Juntia migration.
//
// Reads package.json's declared dependencies verbatim — never adds a
// dependency that isn't literally listed there. `technologies` is a small,
// explicit cross-reference against declared dependency names (not file
// contents, not behavior) — a framework name appearing in `dependencies`
// is evidence the project depends on it, nothing more (e.g. this never
// concludes "this is a game" from `phaser` being present — that
// interpretation belongs to a future AI-assisted layer, per
// phases/12d-project-intelligence-model.md).

const fs = require('fs');
const path = require('path');

const KNOWN_TECHNOLOGIES = new Set([
  'phaser', 'react', 'vue', 'svelte', 'angular', 'vite', 'webpack', 'express', 'next',
]);

function detectDependencies(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return { dependencies: [], technologies: [] };

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { dependencies: [], technologies: [] };
  }

  const dependencies = [];
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, version] of Object.entries(deps)) {
      dependencies.push({ name, version, source: 'package.json', evidence: [`package.json:${field}.${name}`] });
    }
  }

  const technologies = dependencies
    .filter((dep) => KNOWN_TECHNOLOGIES.has(dep.name.toLowerCase()))
    .map((dep) => ({ name: dep.name, source: 'package.json', evidence: dep.evidence }));

  return { dependencies, technologies };
}

module.exports = { detectDependencies, KNOWN_TECHNOLOGIES };
