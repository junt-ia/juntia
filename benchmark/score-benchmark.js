#!/usr/bin/env node
'use strict';

// Phase 12G — compares each benchmark/results/<name>.json (real scanner
// output) against the hand-verified benchmark/expected/<name>.json (ground
// truth) and computes coverage, false positives, evidence quality, and
// stability. Reads only committed JSON files — this script itself never
// re-scans a repo (that's run-benchmark.js's job), so scoring is
// reproducible from the committed results alone.
//
// Config ground truth is checked against `result.evidence` (the raw,
// pre-dedup detection log), not `result.identity.technologies` — a config
// file whose tool name matches an already-found dependency (e.g.
// vite.config.ts when `vite` is already a dependency) is intentionally
// deduplicated out of the user-facing `technologies` list (Phase 12E's own
// fix), but it was still genuinely detected, and scoring against the
// deduped list would wrongly count it as a miss.

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, 'results');
const EXPECTED_DIR = path.join(__dirname, 'expected');

function loadJson(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
}

function setDiff(actual, expected) {
  const a = new Set(actual);
  const e = new Set(expected);
  return {
    missing: [...e].filter((x) => !a.has(x)),
    extra: [...a].filter((x) => !e.has(x)),
  };
}

function scoreRepo(name) {
  const { result, stableAcrossThreeRuns } = loadJson(RESULTS_DIR, name);
  const expected = loadJson(EXPECTED_DIR, name);

  const findings = { repo: name, checks: [], falsePositives: [], missing: [] };
  let expectedTrue = 0;
  let detectedTrue = 0;
  let totalChecks = 0;
  let falsePositiveCount = 0;

  // Languages: presence check (fileCount > 0), independent of exact count.
  for (const [lang, expectedCount] of Object.entries(expected.languages)) {
    totalChecks += 1;
    const detected = result.identity.languages.find((l) => l.name === lang);
    const detectedPresent = !!detected;
    const expectedPresent = expectedCount > 0;
    if (expectedPresent) expectedTrue += 1;
    if (expectedPresent && detectedPresent) detectedTrue += 1;
    if (!expectedPresent && detectedPresent) { falsePositiveCount += 1; findings.falsePositives.push(`language:${lang}`); }
    if (expectedPresent && !detectedPresent) findings.missing.push(`language:${lang}`);
    if (expectedPresent && detectedPresent && detected.fileCount !== expectedCount) {
      findings.checks.push(`language:${lang} count mismatch (expected ${expectedCount}, got ${detected.fileCount})`);
    }
  }

  // Technologies: known-vocabulary presence check via the (deduped) technologies list —
  // safe here because dedup never removes every entry for a shared tool name.
  for (const [tech, expectedPresent] of Object.entries(expected.technologies)) {
    totalChecks += 1;
    const detectedPresent = result.identity.technologies.some((t) => t.name.toLowerCase() === tech);
    if (expectedPresent) expectedTrue += 1;
    if (expectedPresent && detectedPresent) detectedTrue += 1;
    if (!expectedPresent && detectedPresent) { falsePositiveCount += 1; findings.falsePositives.push(`technology:${tech}`); }
    if (expectedPresent && !detectedPresent) findings.missing.push(`technology:${tech}`);
  }

  // Configs: checked against the RAW evidence log (pre-dedup) — see file header.
  const detectedConfigFiles = new Set(result.evidence.filter((e) => e.type === 'config').map((e) => e.detail));
  for (const [config, expectedPresent] of Object.entries(expected.configs)) {
    totalChecks += 1;
    const detectedPresent = detectedConfigFiles.has(config);
    if (expectedPresent) expectedTrue += 1;
    if (expectedPresent && detectedPresent) detectedTrue += 1;
    if (!expectedPresent && detectedPresent) { falsePositiveCount += 1; findings.falsePositives.push(`config:${config}`); }
    if (expectedPresent && !detectedPresent) findings.missing.push(`config:${config}`);
  }

  // Manifests: direct list check.
  for (const [manifest, expectedPresent] of Object.entries(expected.manifests)) {
    totalChecks += 1;
    const detectedPresent = result.manifests.includes(manifest);
    if (expectedPresent) expectedTrue += 1;
    if (expectedPresent && detectedPresent) detectedTrue += 1;
    if (!expectedPresent && detectedPresent) { falsePositiveCount += 1; findings.falsePositives.push(`manifest:${manifest}`); }
    if (expectedPresent && !detectedPresent) findings.missing.push(`manifest:${manifest}`);
  }

  // Dependencies: exact set comparison (every real dependency, not a sample).
  const depDiff = setDiff(result.dependencies.map((d) => d.name), expected.dependencies);
  expectedTrue += expected.dependencies.length;
  detectedTrue += expected.dependencies.length - depDiff.missing.length;
  totalChecks += expected.dependencies.length;
  falsePositiveCount += depDiff.extra.length;
  for (const m of depDiff.missing) findings.missing.push(`dependency:${m}`);
  for (const e of depDiff.extra) findings.falsePositives.push(`dependency:${e}`);

  // Structure: exact set comparison, directories and files separately.
  for (const kind of ['directories', 'files']) {
    const diff = setDiff(result.structure[kind], expected.structure[kind]);
    expectedTrue += expected.structure[kind].length;
    detectedTrue += expected.structure[kind].length - diff.missing.length;
    totalChecks += expected.structure[kind].length;
    falsePositiveCount += diff.extra.length;
    for (const m of diff.missing) findings.missing.push(`structure.${kind}:${m}`);
    for (const e of diff.extra) findings.falsePositives.push(`structure.${kind}:${e}`);
  }

  // Evidence quality: every language/technology/dependency fact must carry non-empty evidence.
  const factsWithEvidence = [
    ...result.identity.languages,
    ...result.identity.technologies,
    ...result.dependencies,
  ];
  const evidenceOk = factsWithEvidence.filter((f) => Array.isArray(f.evidence) && f.evidence.length > 0).length;

  return {
    repo: name,
    coverage: expectedTrue === 0 ? null : detectedTrue / expectedTrue,
    expectedTrueCount: expectedTrue,
    detectedTrueCount: detectedTrue,
    totalChecks,
    falsePositiveCount,
    falsePositives: findings.falsePositives,
    missing: findings.missing,
    countMismatches: findings.checks,
    evidenceQuality: factsWithEvidence.length === 0 ? null : evidenceOk / factsWithEvidence.length,
    evidenceFactCount: factsWithEvidence.length,
    stableAcrossThreeRuns,
  };
}

function main() {
  const names = fs.readdirSync(EXPECTED_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  const scores = [];
  for (const name of names) {
    if (!fs.existsSync(path.join(RESULTS_DIR, `${name}.json`))) {
      console.log(`SKIP ${name}: no results/${name}.json — run run-benchmark.js first.`);
      continue;
    }
    scores.push(scoreRepo(name));
  }

  for (const s of scores) {
    console.log(`\n=== ${s.repo} ===`);
    console.log(`  coverage: ${(s.coverage * 100).toFixed(1)}% (${s.detectedTrueCount}/${s.expectedTrueCount})`);
    console.log(`  false positives: ${s.falsePositiveCount}${s.falsePositives.length ? ' -> ' + s.falsePositives.join(', ') : ''}`);
    console.log(`  evidence quality: ${(s.evidenceQuality * 100).toFixed(1)}% (${s.evidenceFactCount} facts checked)`);
    console.log(`  stable across 3 runs: ${s.stableAcrossThreeRuns}`);
    if (s.missing.length) console.log(`  missing: ${s.missing.join(', ')}`);
    if (s.countMismatches.length) console.log(`  count mismatches: ${s.countMismatches.join('; ')}`);
  }

  const overallCoverage = scores.reduce((sum, s) => sum + s.detectedTrueCount, 0)
    / scores.reduce((sum, s) => sum + s.expectedTrueCount, 0);
  const overallFP = scores.reduce((sum, s) => sum + s.falsePositiveCount, 0);
  const overallEvidence = scores.reduce((sum, s) => sum + s.evidenceFactCount * s.evidenceQuality, 0)
    / scores.reduce((sum, s) => sum + s.evidenceFactCount, 0);
  const allStable = scores.every((s) => s.stableAcrossThreeRuns);

  console.log('\n=== OVERALL ===');
  console.log(`  coverage: ${(overallCoverage * 100).toFixed(1)}%`);
  console.log(`  total false positives: ${overallFP}`);
  console.log(`  evidence quality: ${(overallEvidence * 100).toFixed(1)}%`);
  console.log(`  stable across all repos: ${allStable}`);

  fs.writeFileSync(
    path.join(__dirname, 'scores.json'),
    `${JSON.stringify({ perRepo: scores, overall: { coverage: overallCoverage, falsePositives: overallFP, evidenceQuality: overallEvidence, allStable } }, null, 2)}\n`,
  );
}

main();
