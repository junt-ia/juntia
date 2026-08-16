'use strict';

// Phase 15G — tests for `lib/governance/decision-triggers.js`: the parser
// for `.juntia/governance/rules/decision-triggers.md`, a small, curated
// catalog of situations that commonly signal a real product/architecture
// decision. Central property under test throughout: this module only ever
// reads and returns data — it never matches a trigger against a request,
// never decides one "fired," and never writes to `pending.json`/
// `decisions.json`. A trigger is a suggestion an agent reads, never
// something Juntia evaluates or acts on automatically.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { init } = require('../bin/juntia.js');
const {
  DECISION_TRIGGERS_FILE, parseDecisionTriggers, loadDecisionTriggers,
} = require('../lib/governance/decision-triggers.js');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'governance', 'rules', 'decision-triggers.md');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-decision-triggers-test-'));
}

// --- Parsing the real, unmodified template file ---

test('parses the real decision-triggers.md into the brief\'s own exact shape: { type, trigger, reason, requiresConfirmation }', () => {
  const markdown = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const triggers = parseDecisionTriggers(markdown);

  assert.ok(triggers.length >= 3, 'a real, curated catalog, not an empty one');
  for (const t of triggers) {
    assert.equal(typeof t.trigger, 'string');
    assert.ok(t.type === 'product' || t.type === 'architecture');
    assert.equal(typeof t.reason, 'string');
    assert.ok(t.reason.length > 0);
    assert.equal(typeof t.requiresConfirmation, 'boolean');
  }
});

test('the catalog stays small and curated — "no crear listas infinitas" is a real, checkable property, not just a stated intention', () => {
  const markdown = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const triggers = parseDecisionTriggers(markdown);
  assert.ok(triggers.length <= 10, `expected a small, curated catalog, got ${triggers.length} entries`);
});

test('includes the real, evidenced balancing_value trigger — grounded directly in the restaurant-game dogfooding finding', () => {
  const markdown = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const triggers = parseDecisionTriggers(markdown);
  const balancing = triggers.find((t) => t.trigger === 'balancing_value');
  assert.ok(balancing);
  assert.equal(balancing.type, 'product');
  assert.match(balancing.reason, /restaurant-game/);
});

test('a multi-line Reason value is joined into one real string, never truncated at its first physical line', () => {
  const markdown = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const triggers = parseDecisionTriggers(markdown);
  // Every real reason in the template wraps onto at least a second line —
  // if the parser truncated at the first line, none of these would contain
  // a period this far into the sentence.
  for (const t of triggers) {
    assert.ok(t.reason.length > 40, `reason for "${t.trigger}" looks truncated: "${t.reason}"`);
  }
});

test('requiresConfirmation defaults to true when the field is absent, and is read correctly when explicitly "no"', () => {
  const markdown = [
    '# Decision Triggers',
    '',
    '## explicit_no',
    '',
    '- **Type:** architecture',
    '- **Reason:** A real, if minor, boundary change.',
    '- **Requires confirmation:** no',
    '',
    '## no_field_at_all',
    '',
    '- **Type:** product',
    '- **Reason:** A real product question.',
    '',
  ].join('\n');
  const triggers = parseDecisionTriggers(markdown);
  assert.equal(triggers.find((t) => t.trigger === 'explicit_no').requiresConfirmation, false);
  assert.equal(triggers.find((t) => t.trigger === 'no_field_at_all').requiresConfirmation, true);
});

test('an entry missing a real Type or Reason is skipped, never guessed at', () => {
  const markdown = [
    '# Decision Triggers',
    '',
    '## incomplete_entry',
    '',
    '- **Type:** product',
    '',
    '## real_entry',
    '',
    '- **Type:** architecture',
    '- **Reason:** A real reason.',
    '',
  ].join('\n');
  const triggers = parseDecisionTriggers(markdown);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].trigger, 'real_entry');
});

test('an empty catalog (no ## headings at all) parses to an empty array, not an error', () => {
  assert.deepEqual(parseDecisionTriggers('# Decision Triggers\n\nNothing here yet.\n'), []);
});

// --- loadDecisionTriggers: real filesystem behavior ---

test('loadDecisionTriggers reads the real, scaffolded catalog from a project initialized by init()', () => {
  const root = tempProject();
  init(root);
  const result = loadDecisionTriggers(root);
  assert.equal(result.ok, true);
  assert.ok(result.triggers.length > 0);
});

test('loadDecisionTriggers on a project that never ran init() fails honestly, naming the fix — never invents a triggers list', () => {
  const root = tempProject();
  const result = loadDecisionTriggers(root);
  assert.equal(result.ok, false);
  assert.match(result.reason, /juntia init/);
});

test('DECISION_TRIGGERS_FILE names the real, documented path', () => {
  assert.equal(DECISION_TRIGGERS_FILE, path.join('.juntia', 'governance', 'rules', 'decision-triggers.md'));
});

// --- The central invariant: triggers never decide or write anything ---

test('loadDecisionTriggers never writes to pending.json or decisions.json — it is a pure read', () => {
  const root = tempProject();
  init(root);
  loadDecisionTriggers(root);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'pending.json')), false);
  assert.equal(fs.existsSync(path.join(root, '.juntia', 'decisions.json')), false);
});

test('parseDecisionTriggers/loadDecisionTriggers take no request text at all — structurally incapable of matching a trigger against anything', () => {
  // The real, checkable form of "a trigger never fires automatically": the
  // functions this module exports have no parameter for a request to match
  // against in the first place.
  assert.equal(parseDecisionTriggers.length, 1);
  assert.equal(loadDecisionTriggers.length, 1);
});
