'use strict';

// Facts Store — Phase 12I of the Juntia migration.
//
// Persists scanProject()'s real, deterministic output as a stable, diffable
// list of facts (one entry per observable thing: a language, a technology, a
// dependency, a manifest, a config file, a structure entry), each carrying
// its own evidence, and compares two such snapshots to report ADDED/REMOVED/
// CHANGED — never an interpretation of what a change means. This module
// works exclusively with FACT-tier data (Phase 12H's own tiering model);
// it has no concept of confidence, architecture, or decisions.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's Public API
// boundary) — bin/juntia.js's `analyze` command is the sanctioned entrypoint.

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const FACTS_DIR = '.juntia';
const FACTS_FILE = 'facts.json';
const GITIGNORE_FILE = '.gitignore';

// Converts scanProject()'s real output into a flat, diffable fact list.
// `technology` uses the already-deduplicated identity.technologies list
// (Phase 12E's dedup is a fact-quality decision, not just a display one — a
// tool used via two signals is still one real fact: "this project uses X").
// `config` uses the raw, pre-dedup evidence log instead (same reasoning
// Phase 12G's scoring script already established: dedup hides which
// specific config file was found, which this store needs to track as its
// own fact regardless of whether it also matched a dependency name).
function factsFromScanResult(scanResult) {
  const facts = [];

  for (const manifest of scanResult.manifests) {
    facts.push({ category: 'manifest', name: manifest, evidence: { source: manifest } });
  }

  for (const entry of scanResult.evidence) {
    if (entry.type !== 'config') continue;
    facts.push({ category: 'config', name: entry.detail, evidence: { source: entry.source } });
  }

  for (const lang of scanResult.identity.languages) {
    facts.push({
      category: 'language', name: lang.name, value: lang.fileCount,
      evidence: { source: 'scan', paths: lang.evidence },
    });
  }

  for (const tech of scanResult.identity.technologies) {
    facts.push({
      category: 'technology', name: tech.name,
      evidence: { source: tech.source, paths: tech.evidence },
    });
  }

  for (const dep of scanResult.dependencies) {
    facts.push({
      category: 'dependency', name: dep.name, value: dep.version,
      evidence: { source: dep.source, paths: dep.evidence },
    });
  }

  for (const dir of scanResult.structure.directories) {
    facts.push({ category: 'structure.directory', name: dir, evidence: { source: 'scan' } });
  }
  for (const file of scanResult.structure.files) {
    facts.push({ category: 'structure.file', name: file, evidence: { source: 'scan' } });
  }

  return facts;
}

function factKey(fact) {
  return `${fact.category}:${fact.name}`;
}

function factsPath(projectRoot) {
  return path.join(projectRoot, FACTS_DIR, FACTS_FILE);
}

// Ensures .juntia/facts.json is excluded from the CONSUMING project's own
// git tracking by default — a real, machine-regenerated snapshot, not
// human-authored narrative like PROJECT_STATE.md/DECISIONS.md (Phase 12H's
// own tier distinction). A scoped .juntia/.gitignore (not touching the
// project's own root .gitignore) is additive and reversible: a team that
// deliberately wants to version facts.json can delete this one line.
// Idempotent — never overwrites a .gitignore a project already has.
function ensureFactsIgnored(projectRoot) {
  const gitignorePath = path.join(projectRoot, FACTS_DIR, GITIGNORE_FILE);
  if (fs.existsSync(gitignorePath)) return;
  fs.mkdirSync(path.join(projectRoot, FACTS_DIR), { recursive: true });
  fs.writeFileSync(gitignorePath, `${FACTS_FILE}\n`);
}

// Returns: { exists: false } | { exists: true, unknown: true, reason } |
// { exists: true, unknown: false, document }
// Never throws — a corrupt or future-incompatible facts.json is a real,
// legitimate UNKNOWN, not a crash.
function loadFacts(projectRoot) {
  const filePath = factsPath(projectRoot);
  if (!fs.existsSync(filePath)) return { exists: false };

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { exists: true, unknown: true, reason: 'facts.json exists but is not valid JSON' };
  }

  if (!document || typeof document !== 'object' || !Array.isArray(document.facts)) {
    return { exists: true, unknown: true, reason: 'facts.json exists but is not a recognized facts document' };
  }
  if (document.schemaVersion !== SCHEMA_VERSION) {
    return {
      exists: true, unknown: true,
      reason: `facts.json has schemaVersion ${JSON.stringify(document.schemaVersion)}, this version of Juntia only reads ${SCHEMA_VERSION}`,
    };
  }

  return { exists: true, unknown: false, document };
}

function saveFacts(projectRoot, facts) {
  ensureFactsIgnored(projectRoot);
  const document = { schemaVersion: SCHEMA_VERSION, scannedAt: new Date().toISOString(), facts };
  fs.writeFileSync(factsPath(projectRoot), `${JSON.stringify(document, null, 2)}\n`);
  return document;
}

// Pure comparison — never invents a reason for a change, only reports that
// one occurred. `changed` only fires for facts with a comparable `value`
// (dependency version, language file count) whose value actually differs;
// presence-only categories (manifest/config/technology/structure) can only
// be added or removed, never "changed", since they have no value beyond
// existing.
function compareFacts(oldFacts, newFacts) {
  const oldMap = new Map(oldFacts.map((f) => [factKey(f), f]));
  const newMap = new Map(newFacts.map((f) => [factKey(f), f]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, fact] of newMap) {
    if (!oldMap.has(key)) added.push(fact);
  }
  for (const [key, fact] of oldMap) {
    if (!newMap.has(key)) removed.push(fact);
  }
  for (const [key, newFact] of newMap) {
    const oldFact = oldMap.get(key);
    if (!oldFact) continue;
    if (oldFact.value !== undefined && newFact.value !== undefined && oldFact.value !== newFact.value) {
      changed.push({ category: newFact.category, name: newFact.name, from: oldFact.value, to: newFact.value });
    }
  }

  return { added, removed, changed };
}

module.exports = {
  SCHEMA_VERSION,
  factsFromScanResult,
  factKey,
  loadFacts,
  saveFacts,
  compareFacts,
  ensureFactsIgnored,
};
