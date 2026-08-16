'use strict';

// Phase 12K — tests for lib/project-intelligence/decisions-store.js: the
// only module in this codebase allowed to write .juntia/decisions.json, and
// only ever invoked by bin/juntia.js's runConfirm() after a real human
// answer. Real fs.mkdtempSync fixtures throughout.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadDecisions, saveDecisions, recordDecision, detectConflicts, markConflicted, appendDecisionNarrative,
} = require('../lib/project-intelligence/decisions-store.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-decisions-test-'));
}

const PENDING_ITEM = {
  id: 'abc1234567',
  interpretation: 'This project appears to use Phaser as its main engine.',
  confidence: 'medium',
  basedOn: ['dependency:phaser', 'config:vite.config.ts'],
  unknowns: [{ topic: 'renderer', reason: 'not specified in the scanned facts' }],
  status: 'pending',
};

test('loadDecisions on a project with no decisions.json returns an empty, non-crashing result', () => {
  const root = tempProject();
  const r = loadDecisions(root);
  assert.equal(r.exists, false);
  assert.deepEqual(r.decisions, []);
});

test('recordDecision stores the ORIGINAL interpretation text verbatim as the decision, never reworded', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);

  assert.equal(decision.text, PENDING_ITEM.interpretation);
  assert.equal(decision.status, 'active');
  assert.ok(decision.confirmedAt);

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].id, PENDING_ITEM.id);
});

test('a decision conserves its original evidence (basedOn/confidence/unknowns) exactly as the confirmed interpretation had them', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);

  assert.deepEqual(decision.basedOn, PENDING_ITEM.basedOn);
  assert.equal(decision.confidence, PENDING_ITEM.confidence);
  assert.deepEqual(decision.unknowns, PENDING_ITEM.unknowns);
});

test('decisions.json is NOT git-ignored — no .gitignore entry is added for it', () => {
  const root = tempProject();
  recordDecision(root, PENDING_ITEM);

  const gitignorePath = path.join(root, '.juntia', '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    assert.doesNotMatch(fs.readFileSync(gitignorePath, 'utf8'), /decisions\.json/);
  }
});

test('detectConflicts finds an active decision whose basedOn cites a fact the current scan no longer has, and reports exactly what is missing', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);
  const currentFacts = [{ category: 'config', name: 'vite.config.ts' }]; // dependency:phaser is gone

  const conflicts = detectConflicts(currentFacts, [decision]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].decision.id, decision.id);
  assert.deepEqual(conflicts[0].missingFacts, ['dependency:phaser']);
});

test('detectConflicts finds nothing when every cited fact is still present', () => {
  const decision = { id: 'x', basedOn: ['dependency:phaser'], status: 'active' };
  const conflicts = detectConflicts([{ category: 'dependency', name: 'phaser' }], [decision]);
  assert.equal(conflicts.length, 0);
});

test('detectConflicts never reports an already-conflicted or non-active decision a second time', () => {
  const decision = { id: 'x', basedOn: ['dependency:phaser'], status: 'conflicted' };
  const conflicts = detectConflicts([], [decision]);
  assert.equal(conflicts.length, 0);
});

test('markConflicted flips only the status field, leaving every other field (the original evidence) untouched — the decision is never deleted', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);
  const conflicts = detectConflicts([], [decision]);

  markConflicted(root, conflicts);

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1, 'the decision must still exist — never deleted');
  assert.equal(decisions[0].status, 'conflicted');
  assert.deepEqual(decisions[0].basedOn, PENDING_ITEM.basedOn, 'original evidence must survive a conflict flag unchanged');
});

test('a decision survives a later saveDecisions call for an unrelated decision — decisions accumulate, they do not get clobbered', () => {
  const root = tempProject();
  recordDecision(root, PENDING_ITEM);
  recordDecision(root, { ...PENDING_ITEM, id: 'second-decision', interpretation: 'Second decision.', basedOn: ['language:TypeScript'] });

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);
});

test('a corrupt decisions.json is reported as UNKNOWN, never crashes', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'decisions.json'), '{ not json');

  const r = loadDecisions(root);
  assert.equal(r.unknown, true);
});

// --- appendDecisionNarrative --------------------------------------------

test('appendDecisionNarrative creates .juntia/DECISIONS.md from the real init template when none exists yet, with the placeholder bullet removed', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);

  appendDecisionNarrative(root, decision);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /## Active decisions/);
  assert.equal(narrative.includes('<decision> — <short reason> (<date>)'), false, 'the template placeholder bullet must be removed once a real decision is added');
  assert.match(narrative, /This project appears to use Phaser as its main engine\./);
  assert.match(narrative, /juntia confirm/);
  assert.match(narrative, /dependency:phaser, config:vite\.config\.ts/);
});

test('appendDecisionNarrative appends to an existing DECISIONS.md (e.g. one already created by `juntia init`) without disturbing its other sections', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '.juntia'), { recursive: true });
  fs.writeFileSync(path.join(root, '.juntia', 'DECISIONS.md'), [
    '# Decisions',
    '',
    '## Active decisions',
    '',
    '- Use PostgreSQL — team already knows it (2026-01-01)',
    '',
    '## Discarded and why',
    '',
    '- MongoDB — no real need for schemaless data',
    '',
  ].join('\n'));

  const decision = recordDecision(root, PENDING_ITEM);
  appendDecisionNarrative(root, decision);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /Use PostgreSQL — team already knows it/);
  assert.match(narrative, /This project appears to use Phaser as its main engine\./);
  assert.match(narrative, /## Discarded and why[\s\S]*MongoDB/);
});

test('two confirmed decisions both appear in DECISIONS.md, appended in order, not overwriting each other', () => {
  const root = tempProject();
  const first = recordDecision(root, PENDING_ITEM);
  appendDecisionNarrative(root, first);
  const second = recordDecision(root, { ...PENDING_ITEM, id: 'second', interpretation: 'Second real decision.', basedOn: ['language:TypeScript'] });
  appendDecisionNarrative(root, second);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /This project appears to use Phaser as its main engine\./);
  assert.match(narrative, /Second real decision\./);
});

// --- Phase 15F: product/architecture decisions — real evidence, restaurant-game M04 ---
//
// Real request that could never go through `recordDecision`'s pre-15F,
// interpretation-only shape: no `.juntia/facts.json` entry supports a
// specific timeout duration — there is nothing to cite as `basedOn`.

const PRODUCT_DECISION_REQUEST = {
  id: 'wait-timeout',
  type: 'product',
  question: '¿Cuánto tiempo espera un cliente antes de abandonar?',
  context: 'NPC waiting system',
  options: ['10000ms', '15000ms', '20000ms'],
};

test('recordDecision builds a product-decision record from the human\'s own answer, never from anything the pending item proposed', () => {
  const root = tempProject();
  const decision = recordDecision(root, PRODUCT_DECISION_REQUEST, '15000ms');

  assert.equal(decision.type, 'product');
  assert.equal(decision.text, '15000ms', 'the recorded decision must be the human\'s real answer, not derived from the request');
  assert.equal(decision.question, PRODUCT_DECISION_REQUEST.question);
  assert.equal(decision.context, 'NPC waiting system');
  assert.deepEqual(decision.options, ['10000ms', '15000ms', '20000ms']);
  assert.equal(decision.source, 'human');
  assert.equal(decision.status, 'active');
});

test('an interpretation-type decision also records source: "human" — the same structural guarantee applies to every decision type', () => {
  const root = tempProject();
  const decision = recordDecision(root, PENDING_ITEM);
  assert.equal(decision.source, 'human');
  assert.equal(decision.type, 'interpretation');
});

test('a product decision has no basedOn field at all — it is never mistaken for a fact-grounded interpretation', () => {
  const root = tempProject();
  const decision = recordDecision(root, PRODUCT_DECISION_REQUEST, '15000ms');
  assert.equal(decision.basedOn, undefined);
  assert.equal(decision.confidence, undefined);
});

test('an architecture decision request records its own type distinctly from product', () => {
  const root = tempProject();
  const decision = recordDecision(root, { ...PRODUCT_DECISION_REQUEST, id: 'arch-1', type: 'architecture', question: 'Where should reservation state live?' }, 'In restaurant.ts, not a new module.');
  assert.equal(decision.type, 'architecture');
});

test('detectConflicts never flags a product/architecture decision — it has no basedOn to compare against real facts, even when evidence looks like a real-sounding (but not real) fact reference', () => {
  const decision = {
    id: 'x', type: 'product', text: '15000ms', evidence: ['docs/MILESTONES.md M04'], status: 'active',
  };
  const conflicts = detectConflicts([{ category: 'dependency', name: 'phaser' }], [decision]);
  assert.equal(conflicts.length, 0, 'a product decision\'s free-text evidence must never be checked against real fact keys');
});

test('appendDecisionNarrative renders a product decision distinctly — never with the interpretation-shaped "based on: <fact keys>" phrase', () => {
  const root = tempProject();
  const decision = recordDecision(root, PRODUCT_DECISION_REQUEST, '15000ms');
  appendDecisionNarrative(root, decision);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /15000ms — product decision \(NPC waiting system\): ¿Cuánto tiempo espera un cliente antes de abandonar\?/);
  assert.doesNotMatch(narrative, /based on:/);
});

test('appendDecisionNarrative renders an architecture decision with its own label, distinct from product', () => {
  const root = tempProject();
  const decision = recordDecision(root, { ...PRODUCT_DECISION_REQUEST, id: 'arch-2', type: 'architecture', question: 'Which module owns reservation state?' }, 'restaurant.ts');
  appendDecisionNarrative(root, decision);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /restaurant\.ts — architecture decision/);
});

test('a product decision and an interpretation decision coexist in the same decisions.json without either corrupting the other\'s shape', () => {
  const root = tempProject();
  recordDecision(root, PENDING_ITEM);
  recordDecision(root, PRODUCT_DECISION_REQUEST, '15000ms');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);
  const interpretation = decisions.find((d) => d.id === PENDING_ITEM.id);
  const product = decisions.find((d) => d.id === PRODUCT_DECISION_REQUEST.id);
  assert.equal(interpretation.type, 'interpretation');
  assert.ok(Array.isArray(interpretation.basedOn) && interpretation.basedOn.length > 0);
  assert.equal(product.type, 'product');
  assert.equal(product.basedOn, undefined);
});

// --- Compatibility: a pre-15F decisions.json (no `type` field at all) ---

test('a decision record with no type field (written before Phase 15F) still renders correctly in the narrative — treated as interpretation, not crashed on', () => {
  const root = tempProject();
  const legacyDecision = {
    id: 'legacy-1',
    text: 'This project appears to use Phaser.',
    confidence: 'high',
    basedOn: ['dependency:phaser'],
    unknowns: [],
    confirmedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
  };
  appendDecisionNarrative(root, legacyDecision);

  const narrative = fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  assert.match(narrative, /This project appears to use Phaser\. — confirmed via `juntia confirm`, based on: dependency:phaser/);
});
