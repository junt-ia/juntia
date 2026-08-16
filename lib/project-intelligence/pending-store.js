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

// A stable id derived from the decision request's own question — a product/
// architecture decision has no fact set to derive identity from the way
// `interpretationId` does; the question text is the closest real, stable
// identity it has. Two requests asking the exact same question are treated
// as the same pending item (a re-proposal refreshes it) rather than
// duplicating — the same dedup discipline `interpretationId` already
// established for a structurally different domain (Phase 15F).
function decisionRequestId(question) {
  return crypto.createHash('sha1').update(question).digest('hex').slice(0, 10);
}

// Adds a new pending decision request (type "product"/"architecture") — the
// question an agent is proposing needs a real human answer, never the
// answer itself (see `lib/governance/decision-model.js`'s own forbidden-key
// validation, enforced by the caller before this is reached). Mirrors
// `upsertPending` exactly, for the decision-request shape instead of the
// interpretation shape.
function upsertDecisionRequest(projectRoot, request) {
  const { items } = loadPending(projectRoot);
  const id = decisionRequestId(request.question);
  const item = {
    id,
    type: request.type,
    question: request.question,
    context: request.context || null,
    options: request.options || [],
    evidence: request.evidence || [],
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  const next = [...items.filter((i) => i.id !== id), item];
  savePending(projectRoot, next);
  return id;
}

// normalizePendingItems(projectRoot) -> same shape as loadPending()
//
// Phase 13D: pending.json can now be written directly by an external AI
// agent following `.juntia/agent-instructions.md`, not only by Juntia's own
// (retired) internal runtime call — so an item's `id`/`status`/`createdAt`
// can no longer be assumed present or trustworthy the way `upsertPending`
// always guaranteed. This assigns a stable id (same derivation as
// `upsertPending` — sha1 of the sorted `basedOn` set, or, for a Phase 15F
// decision request, the same derivation `upsertDecisionRequest` uses — sha1
// of the question text — so a hand-written request gets the identical id an
// agent would have gotten calling that function directly) to any item
// missing one or colliding with another item already normalized, and
// backfills `status`/`createdAt` if absent. Never touches `interpretation`/
// `confidence`/`basedOn`/`unknowns`/`question`/`context`/`options`/
// `evidence` — those are exactly what the caller (bin/juntia.js's
// `runConfirm`) still validates before trusting them. Persists the
// normalization immediately so every later `removePending(id)` call in the
// same run can address the exact right item.
function normalizePendingItems(projectRoot) {
  const loaded = loadPending(projectRoot);
  if (!loaded.exists || loaded.unknown) return loaded;

  let changed = false;
  const used = new Set();
  const items = loaded.items.map((item) => {
    const seed = typeof item.question === 'string'
      ? item.question
      : (Array.isArray(item.basedOn) ? item.basedOn : [JSON.stringify(item)]);
    const deriveId = () => (typeof item.question === 'string' ? decisionRequestId(seed) : interpretationId(seed));
    let id = typeof item.id === 'string' && item.id !== '' ? item.id : null;
    if (!id || used.has(id)) {
      id = deriveId();
      let suffix = 1;
      while (used.has(id)) { id = `${deriveId()}-${suffix}`; suffix += 1; }
      changed = true;
    }
    used.add(id);
    const normalized = { ...item, id };
    if (!normalized.status) { normalized.status = 'pending'; changed = true; }
    if (!normalized.createdAt) { normalized.createdAt = new Date().toISOString(); changed = true; }
    return normalized;
  });

  if (changed) savePending(projectRoot, items);
  return { ...loaded, items };
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
  SCHEMA_VERSION,
  interpretationId,
  decisionRequestId,
  loadPending,
  savePending,
  upsertPending,
  upsertDecisionRequest,
  removePending,
  normalizePendingItems,
};
