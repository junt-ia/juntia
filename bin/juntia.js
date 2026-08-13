#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');

const PACKAGE_ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');

function pkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

// Files `init` scaffolds into <project>/.juntia/, copied verbatim from
// templates/ — never overwritten if already present, so a second `init` run
// is always safe and never clobbers real project content.
const SCAFFOLD_FILES = [
  'config.yml',
  'PROJECT_STATE.md',
  'DECISIONS.md',
  'RULES.md',
  'ARCHITECTURE.md',
  path.join('roles', 'product.md'),
  path.join('roles', 'architect.md'),
  path.join('roles', 'engineer.md'),
  path.join('roles', 'qa.md'),
];

// Pure filesystem scaffolding: no code is read or analyzed, no network call
// is made, nothing outside <projectRoot>/.juntia/ is touched. Deliberately
// this narrow per Phase 12A.5/12B's own "first command must be safe and
// reversible" constraint.
function init(projectRoot) {
  const juntiaDir = path.join(projectRoot, '.juntia');
  const created = [];
  const skipped = [];
  for (const relativePath of SCAFFOLD_FILES) {
    const dest = path.join(juntiaDir, relativePath);
    if (fs.existsSync(dest)) {
      skipped.push(relativePath);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(TEMPLATES_DIR, relativePath), dest);
    created.push(relativePath);
  }
  return { juntiaDir, created, skipped };
}

function runInit(projectRoot = process.cwd()) {
  const { juntiaDir, created, skipped } = init(projectRoot);
  if (created.length === 0 && skipped.length > 0) {
    console.log(`.juntia/ already exists at ${juntiaDir} — nothing to do.`);
    console.log(`(${skipped.length} file(s) already present, none overwritten.)`);
    return;
  }
  console.log(`Created .juntia/ at ${juntiaDir}`);
  for (const file of created) console.log(`  + ${file}`);
  if (skipped.length > 0) {
    console.log('Already present, left unchanged:');
    for (const file of skipped) console.log(`  = ${file}`);
  }
  console.log('');
  console.log('Nothing was read, analyzed, or sent anywhere — this only scaffolds local files.');
}

// Formats scanProject()'s real output as a plain inventory listing — no
// interpretation added here either; this only decides how to print facts
// the scanner already found. Never writes a file (Phase 12E's own explicit
// restriction: analyze is inventory-only, it does not touch .juntia/ yet).
function formatAnalysis(result) {
  const lines = ['Analyzing project...', '', 'Detected:', ''];

  if (result.identity.languages.length > 0) {
    lines.push('Languages:');
    for (const lang of result.identity.languages) lines.push(`  ✓ ${lang.name}`);
    lines.push('');
  }
  if (result.identity.technologies.length > 0) {
    lines.push('Technologies:');
    for (const tech of result.identity.technologies) lines.push(`  ✓ ${tech.name}`);
    lines.push('');
  }
  if (result.dependencies.length > 0) {
    lines.push('Dependencies:');
    for (const dep of result.dependencies) lines.push(`  ✓ ${dep.name}`);
    lines.push('');
  }
  if (result.structure.directories.length > 0) {
    lines.push('Structure:');
    for (const dir of result.structure.directories) lines.push(`  ✓ ${dir}/`);
    lines.push('');
  }

  const nothingFound = result.identity.languages.length === 0
    && result.dependencies.length === 0
    && result.manifests.length === 0;
  if (nothingFound) {
    lines.push('Nothing recognized in this directory (UNKNOWN) — no manifest, language, or config file matched.');
    lines.push('');
  }

  lines.push('This is a mechanical inventory only: no AI was used, no project type was guessed, and nothing was written to .juntia/.');
  return lines.join('\n');
}

function runAnalyze(projectRoot = process.cwd()) {
  console.log(formatAnalysis(scanProject(projectRoot)));
}

module.exports = { init, runInit, runAnalyze, formatAnalysis, pkgVersion, SCAFFOLD_FILES };

// Guarded so this file can be `require()`d by tests without triggering a
// command as a side effect (same convention as claude-toolkit's own bin/claude-toolkit.js).
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'init') runInit();
  else if (command === 'analyze') runAnalyze();
  else if (command === '--version' || command === '-v') console.log(pkgVersion());
  else {
    console.error('Usage: juntia <init|analyze>');
    process.exit(1);
  }
}
