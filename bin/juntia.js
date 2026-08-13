#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');
const {
  factsFromScanResult, loadFacts, saveFacts, compareFacts,
} = require('../lib/project-intelligence/facts-store.js');

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
// the scanner already found.
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

  lines.push('This is a mechanical inventory only: no AI was used, and no project type was guessed.');
  return lines.join('\n');
}

// Formats a compareFacts() diff as a plain, fact-level change report — never
// an interpretation of what a change means (Phase 12H/12I's own boundary:
// "dependency phaser removed" is reportable, "the project stopped being a
// game" is not, and this function has no way to produce the latter since it
// only ever prints category/name/value fields compareFacts() itself
// computed).
function formatChanges({ added, removed, changed }) {
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return 'No changes detected since the last analyze.';
  }
  const lines = ['Changes detected:', ''];
  if (added.length > 0) {
    lines.push('Added:');
    for (const fact of added) lines.push(`  + ${fact.category}: ${fact.name}`);
    lines.push('');
  }
  if (removed.length > 0) {
    lines.push('Removed:');
    for (const fact of removed) lines.push(`  - ${fact.category}: ${fact.name}`);
    lines.push('');
  }
  if (changed.length > 0) {
    lines.push('Changed:');
    for (const c of changed) lines.push(`  ~ ${c.category}: ${c.name} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Prints a runtime interpretation (Phase 12J) to the console only — never
// written to a file. This is Option A of the two output surfaces the phase
// evaluated (the other, `.juntia/pending.json`, was deliberately not built
// this phase; see phases/12j-context-synthesis-runtime-evaluation.md). An
// interpretation is never mistaken for a fact: every line here is
// explicitly labeled and clearly separated from `formatAnalysis()`'s own
// output above it.
function formatInterpretation(synthesis) {
  if (!synthesis.ok) {
    return [
      'AI interpretation: not available.',
      `Reason: ${synthesis.reason}`,
      'No file was written and no interpretation was recorded — nothing here is a fact or a decision.',
    ].join('\n');
  }
  const { interpretation, confidence, basedOn, unknowns } = synthesis.result;
  const lines = [
    'AI interpretation (not a fact, not saved, not a decision — for you to confirm or discard):',
    '',
    `  ${interpretation}`,
    `  confidence: ${confidence}`,
    `  based on: ${basedOn.join(', ')}`,
  ];
  if (unknowns.length > 0) {
    lines.push('  unknowns:');
    for (const u of unknowns) lines.push(`    - ${u.topic}: ${u.reason}`);
  }
  return lines.join('\n');
}

// scan -> facts -> persist -> compare -> report, per this phase's own design.
// First run: no previous baseline, creates one. Later runs: compares against
// the previous baseline, reports the diff, then updates the baseline for
// next time. A corrupt or schema-incompatible facts.json is reported as
// UNKNOWN and treated as a fresh baseline — never guessed at, never crashes.
// The only file this writes is .juntia/facts.json (and, once, .juntia/.gitignore)
// — verified by test (test/facts-store.test.js, test/cli-analyze.test.js).
// `--explain` (Phase 12J) never adds a file write: it only decides whether
// an extra, clearly-labeled console section is printed after the same
// facts this command already computed. Without it, behavior is byte-for-
// byte identical to before Phase 12J — a real runtime call/cost only ever
// happens when explicitly requested.
// Returns the runtime synthesis result when `explain` was requested
// (undefined otherwise) — mainly so tests can await completion and inspect
// what happened, without needing to spy on console.log.
async function runAnalyze(projectRoot = process.cwd(), { explain = false, adapter = null, adapterOptions } = {}) {
  const result = scanProject(projectRoot);
  console.log(formatAnalysis(result));
  console.log('');

  const facts = factsFromScanResult(result);
  const previous = loadFacts(projectRoot);

  let diff = { added: [], removed: [], changed: [] };
  if (!previous.exists) {
    saveFacts(projectRoot, facts);
    console.log(`Created a factual baseline at .juntia/facts.json (${facts.length} facts). Run analyze again later to see what changed.`);
  } else if (previous.unknown) {
    console.log(`Previous .juntia/facts.json could not be used (${previous.reason}) — treating this as a fresh baseline.`);
    saveFacts(projectRoot, facts);
  } else {
    diff = compareFacts(previous.document.facts, facts);
    console.log(formatChanges(diff));
    saveFacts(projectRoot, facts);
  }

  if (!explain) return undefined;

  console.log('');
  const runtimeAdapter = adapter || require('../lib/runtime/claude-cli-adapter.js');
  const { synthesizeContext } = require('../lib/project-intelligence/context-synthesis-bridge.js');
  const synthesis = await synthesizeContext(facts, diff, { adapter: runtimeAdapter, adapterOptions });
  console.log(formatInterpretation(synthesis));
  return synthesis;
}

module.exports = {
  init, runInit, runAnalyze, formatAnalysis, formatChanges, formatInterpretation, pkgVersion, SCAFFOLD_FILES,
};

// Guarded so this file can be `require()`d by tests without triggering a
// command as a side effect (same convention as claude-toolkit's own bin/claude-toolkit.js).
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'init') runInit();
  else if (command === 'analyze') {
    runAnalyze(process.cwd(), { explain: process.argv.includes('--explain') })
      .catch((err) => { console.error(`analyze failed: ${err.message}`); process.exit(1); });
  } else if (command === '--version' || command === '-v') console.log(pkgVersion());
  else {
    console.error('Usage: juntia <init|analyze> [--explain]');
    process.exit(1);
  }
}
