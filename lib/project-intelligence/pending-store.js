'use strict';

// Pending Interpretations Store — Phase 12K of the Juntia migration.
//
// Persists a runtime interpretation (Phase 12J's `synthesizeContext()`
// output) as a real, addressable item a human can later confirm or reject
// — the exact persistence Phase 12J evaluated and deliberately did not
// build, because no lifecycle policy existed yet. This module IS that
// policy: `pending` is the only status ever written to disk; `confirm`/
// `reject` are terminal state transitions that remove the item from this
// store (Phase 12K's own brief: "rechazo elimina pendiente" — confirmation
// is symmetric, its data moving into `decisions-store.js` instead of living
// in two places at once).
//
// Modeled directly on `facts-store.js` (schema-versioned document, `load`/
// `save` pair, UNKNOWN-not-crash on a corrupt file) rather than inventing a
// new persistence shape — reused, not redesigned.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's boundary).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensureIgnored } = require('./facts-store.js');

const SCHEMA_VERSION = 1;
const PENDING_DIR = '.juntia';
const PENDING_FILE = 'pending.json';

// A stable id derived from the exact set of facts an interpretation cites —
// not from the interpretation's own free text, which can vary slightly
// between two live calls that are really answering the same question. Two
// interpretations grounded in the identical fact set are treated as the
// same pending question; a re-run just refreshes it (see upsertPending)
// rather than creating a duplicate. Deterministic, zero new dependency
// (`crypto` is core) — no AI-generated id, matching this migration's
// deterministic-first bias.
function interpretationId(basedOn) {
  const sorted = [...basedOn].sort().join('|');
  return crypto.createHash('sha1').update(sorted).digest('hex').slice(0, 10);
}

function pendingPath(projectRoot) {
  return path.join(projectRoot, PENDING_DIR, PENDING_FILE);
}

// Same never-crash-on-corruption contract as facts-store.js's loadFacts().
function loadPending(projectRoot) {
  const filePath = pendingPath(projectRoot);
  if (!fs.existsSync(filePath)) return { exists: false, items: [] };

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { exists: true, unknown: true, reason: 'pending.json exists but is not valid JSON', items: [] };
  }
  if (!document || typeof document !== 'object' || !Array.isArray(document.items)) {
    return { exists: true, unknown: true, reason: 'pending.json exists but is not a recognized pending document', items: [] };
  }
  if (document.schemaVersion !== SCHEMA_VERSION) {
    return {
      exists: true, unknown: true,
      reason: `pending.json has schemaVersion ${JSON.stringify(document.schemaVersion)}, this version of Juntia only reads ${SCHEMA_VERSION}`,
      items: [],
    };
  }
  return { exists: true, unknown: false, items: document.items };
}

function savePending(projectRoot, items) {
  ensureIgnored(projectRoot, PENDING_FILE);
  const document = { schemaVersion: SCHEMA_VERSION, items };
  fs.writeFileSync(pendingPath(projectRoot), `${JSON.stringify(document, null, 2)}\n`);
  return document;
}

// Adds a new pending item for a validated interpretation, or refreshes an
// existing one that cites the exact same facts (same id) — never
// duplicates a question already waiting on an answer. Returns the id.
function upsertPending(projectRoot, interpretation) {
  const { items } = loadPending(projectRoot);
  const id = interpretationId(interpretation.basedOn);
  const item = {
    id,
    interpretation: interpretation.interpretation,
    confidence: interpretation.confidence,
    basedOn: interpretation.basedOn,
    unknowns: interpretation.unknowns,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  const next = [...items.filter((i) => i.id !== id), item];
  savePending(projectRoot, next);
  return id;
}

// Removes an item regardless of the answer given — a rejection has nothing
// left to keep (this phase's own brief: "rechazo elimina pendiente"); a
// confirmation's data has already been copied into decisions-store.js by
// the caller before this runs, so keeping a second, now-redundant copy
// here would just be two sources of truth for the same fact.
function removePending(projectRoot, id) {
  const { items } = loadPending(projectRoot);
  savePending(projectRoot, items.filter((i) => i.id !== id));
}

module.exports = {
  SCHEMA_VERSION, interpretationId, loadPending, savePending, upsertPending, removePending,
};
