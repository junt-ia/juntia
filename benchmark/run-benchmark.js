#!/usr/bin/env node
'use strict';

// Phase 12G — runs the real scanner (lib/project-intelligence/scanner.js)
// against real, local checkouts of the repos named in repos.json, three
// times each (stability check: byte-identical JSON across runs, including
// array order), and writes the result of the first run to results/<name>.json.
//
// Takes repo paths from environment variables (JUNTIA_BENCH_<NAME>_PATH,
// name uppercased with `-` -> `_`) rather than hardcoding this machine's
// absolute paths, so the script itself stays portable even though the real
// repos it points at (three of them personal, one private) aren't bundled
// with this package. See benchmark/README.md for exact reproduction steps.

const fs = require('fs');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');

const REPOS = require('./repos.json');
const RESULTS_DIR = path.join(__dirname, 'results');

function envVarFor(name) {
  return `JUNTIA_BENCH_${name.toUpperCase().replace(/-/g, '_')}_PATH`;
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

function runOnce(repoPath) {
  return scanProject(repoPath);
}

function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const summary = [];

  for (const name of Object.keys(REPOS)) {
    const envVar = envVarFor(name);
    const repoPath = process.env[envVar];
    if (!repoPath) {
      console.log(`SKIP ${name}: set ${envVar} to a local checkout path to include it.`);
      continue;
    }
    if (!fs.existsSync(repoPath)) {
      console.log(`SKIP ${name}: ${envVar}=${repoPath} does not exist.`);
      continue;
    }

    const runs = [runOnce(repoPath), runOnce(repoPath), runOnce(repoPath)];
    const serialized = runs.map(stableStringify);
    const stable = serialized.every((s) => s === serialized[0]);

    const outPath = path.join(RESULTS_DIR, `${name}.json`);
    fs.writeFileSync(outPath, `${stableStringify({
      repo: name,
      description: REPOS[name].description,
      scannedAt: new Date().toISOString(),
      stableAcrossThreeRuns: stable,
      result: runs[0],
    })}\n`);

    console.log(`OK   ${name}: stable=${stable} -> ${path.relative(process.cwd(), outPath)}`);
    summary.push({ name, stable });
  }

  if (summary.length === 0) {
    console.log('\nNo repos scanned — no JUNTIA_BENCH_*_PATH environment variables were set.');
    process.exitCode = 1;
  }
}

main();
