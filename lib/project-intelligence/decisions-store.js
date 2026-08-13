'use strict';

// Decisions Store — Phase 12K of the Juntia migration.
//
// The DECISION tier's real, structured storage — the terminal tier Phase
// 12H named and no phase since has built: `.juntia/decisions.json`.
// Written to by exactly one caller in this codebase: `bin/juntia.js`'s
// `confirm` command, only after a real human answered "yes" to a real
// question about a real, previously-validated interpretation. No AI code
// path in this repository imports this module to write to it — enforced by
// what actually calls `recordDecision()`, not by a comment.
//
// Deliberately NOT git-ignored, unlike facts.json/pending.json (see
// phases/12k-context-lifecycle.md §"Where decisions live" for the full
// evaluation): a decision is an irreversible human choice, the same kind of
// artifact `DECISIONS.md` already is — losing it to a missing commit, or
// silently diverging between two teammates' machines, is a real harm a
// machine-regenerated fact/pending queue does not share.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's boundary).

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const DECISIONS_DIR = '.juntia';
const DECISIONS_FILE = 'decisions.json';
const NARRATIVE_FILE = 'DECISIONS.md';
const NARRATIVE_TEMPLATE = path.join(__dirname, '..', '..', 'templates', 'DECISIONS.md');
const ACTIVE_SECTION_HEADING = '## Active decisions';
const PLACEHOLDER_LINE = '- <decision> — <short reason> (<date>)';

function decisionsPath(projectRoot) {
  return path.join(projectRoot, DECISIONS_DIR, DECISIONS_FILE);
}

// Same never-crash-on-corruption contract as facts-store.js/pending-store.js.
function loadDecisions(projectRoot) {
  const filePath = decisionsPath(projectRoot);
  if (!fs.existsSync(filePath)) return { exists: false, decisions: [] };

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { exists: true, unknown: true, reason: 'decisions.json exists but is not valid JSON', decisions: [] };
  }
  if (!document || typeof document !== 'object' || !Array.isArray(document.decisions)) {
    return { exists: true, unknown: true, reason: 'decisions.json exists but is not a recognized decisions document', decisions: [] };
  }
  if (document.schemaVersion !== SCHEMA_VERSION) {
    return {
      exists: true, unknown: true,
      reason: `decisions.json has schemaVersion ${JSON.stringify(document.schemaVersion)}, this version of Juntia only reads ${SCHEMA_VERSION}`,
      decisions: [],
    };
  }
  return { exists: true, unknown: false, decisions: document.decisions };
}

function saveDecisions(projectRoot, decisions) {
  fs.mkdirSync(path.join(projectRoot, DECISIONS_DIR), { recursive: true });
  const document = { schemaVersion: SCHEMA_VERSION, decisions };
  fs.writeFileSync(decisionsPath(projectRoot), `${JSON.stringify(document, null, 2)}\n`);
  return document;
}

// Turns a confirmed pending item into a decision record. The stored `text`
// is the ORIGINAL interpretation text, verbatim — never mechanically
// reworded from a hedge ("appears to", "podría") into an unqualified claim.
// Rewording is itself a text-generation step nothing in this phase actually
// performs or the user actually authored; storing the exact text the human
// said "yes" to is the only way `basedOn`/`confidence` stay honestly
// attached to what was really confirmed. `confidence`/`basedOn`/`unknowns`
// are frozen copies — Phase 12K's own "decisión conserva evidencia
// original" requirement: they never change even if a later `analyze`
// changes the underlying facts (see detectConflicts below for how a stale
// decision is surfaced instead of silently rewritten).
function recordDecision(projectRoot, pendingItem) {
  const { decisions } = loadDecisions(projectRoot);
  const decision = {
    id: pendingItem.id,
    text: pendingItem.interpretation,
    confidence: pendingItem.confidence,
    basedOn: pendingItem.basedOn,
    unknowns: pendingItem.unknowns,
    confirmedAt: new Date().toISOString(),
    status: 'active',
  };
  saveDecisions(projectRoot, [...decisions.filter((d) => d.id !== decision.id), decision]);
  return decision;
}

// Appends a one-line, human-readable record of the same decision into
// `.juntia/DECISIONS.md` — reusing the file `juntia init` already scaffolds
// (templates/DECISIONS.md) and its own established "## Active decisions"
// bullet convention, rather than inventing a second, competing narrative
// surface. If the project never ran `init`, the template itself is used as
// the starting content (so `confirm` never requires `init` to have run
// first) and the file is created for the first time here. The template's
// own placeholder bullet is removed once a real entry is added — an
// invented-looking placeholder next to real decisions would misrepresent
// what's actually settled, the same concern the template's own intro text
// already states about `UNKNOWN` entries.
//
// Deliberately mechanical text insertion, not free-text generation: the
// only new prose here is `decision.text` itself, copied verbatim from what
// the user already confirmed — nothing is reworded or summarized.
function appendDecisionNarrative(projectRoot, decision) {
  const narrativePath = path.join(projectRoot, DECISIONS_DIR, NARRATIVE_FILE);
  const content = fs.existsSync(narrativePath)
    ? fs.readFileSync(narrativePath, 'utf8')
    : fs.readFileSync(NARRATIVE_TEMPLATE, 'utf8');
  const lines = content.split('\n');

  const date = decision.confirmedAt.slice(0, 10);
  const bulletLine = `- ${decision.text} — confirmed via \`juntia confirm\`, based on: ${decision.basedOn.join(', ')} (${date})`;

  const headingIdx = lines.findIndex((l) => l.trim() === ACTIVE_SECTION_HEADING);
  if (headingIdx === -1) {
    lines.push('', ACTIVE_SECTION_HEADING, '', bulletLine);
  } else {
    let boundaryIdx = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i += 1) {
      if (lines[i].trim().startsWith('## ')) { boundaryIdx = i; break; }
    }
    const section = lines.slice(headingIdx + 1, boundaryIdx).filter((l) => l.trim() !== PLACEHOLDER_LINE);
    while (section.length > 0 && section[section.length - 1].trim() === '') section.pop();
    while (section.length > 0 && section[0].trim() === '') section.shift();
    lines.splice(headingIdx + 1, boundaryIdx - (headingIdx + 1), '', ...section, bulletLine, '');
  }

  fs.mkdirSync(path.join(projectRoot, DECISIONS_DIR), { recursive: true });
  fs.writeFileSync(narrativePath, lines.join('\n'));
}

// A decision is never deleted or silently rewritten when the facts it cited
// change — Phase 12K's own explicit "Juntia NO debe borrar la decisión"
// requirement. This only ever REPORTS which active decisions cite a fact
// that no longer exists; the caller decides whether/how to persist the
// resulting 'conflicted' status (bin/juntia.js's runAnalyze does, via
// markConflicted below) — human review resolves it from there, nothing
// here does.
function detectConflicts(facts, decisions) {
  const factKeySet = new Set(facts.map((f) => `${f.category}:${f.name}`));
  return decisions
    .filter((d) => d.status === 'active')
    .map((d) => ({ decision: d, missingFacts: d.basedOn.filter((b) => !factKeySet.has(b)) }))
    .filter((c) => c.missingFacts.length > 0);
}

// Marks conflicted decisions as such in the persisted store — status only,
// every other field (including `basedOn`, the original evidence) untouched.
// Reversible: a future phase's "resolve conflict" flow could set status
// back to 'active' or 'superseded'; this phase only detects and flags.
function markConflicted(projectRoot, conflicts) {
  if (conflicts.length === 0) return;
  const { decisions } = loadDecisions(projectRoot);
  const conflictedIds = new Set(conflicts.map((c) => c.decision.id));
  const next = decisions.map((d) => (conflictedIds.has(d.id) ? { ...d, status: 'conflicted' } : d));
  saveDecisions(projectRoot, next);
}

module.exports = {
  SCHEMA_VERSION, loadDecisions, saveDecisions, recordDecision, detectConflicts, markConflicted, appendDecisionNarrative,
};
