'use strict';

// Governance Level Dynamic — tests for `lib/governance/governance-signals.js`.
// Central properties under test: (1) signals are only ever DECLARED, never
// computed from free text — this module has no text-matching logic at all;
// (2) with no declared signals, the final level always equals the base
// level, byte-identical to the pre-existing static behavior; (3) a single
// `strict` signal always wins over any number of lower ones, and an
// all-`light` declaration can resolve BELOW the workflow's own base level
// (the brief's own de-escalation example).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  GOVERNANCE_SIGNALS_FILE, parseGovernanceSignals, loadGovernanceSignals, evaluateGovernanceLevel,
} = require('../lib/governance/governance-signals.js');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'governance', 'rules', 'governance-signals.md');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-governance-signals-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// --- parseGovernanceSignals ---

test('parses the real, shipped governance-signals.md template into a well-formed catalog', () => {
  const markdown = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const signals = parseGovernanceSignals(markdown);

  assert.ok(signals.length >= 10);
  for (const entry of signals) {
    assert.equal(typeof entry.signal, 'string');
    assert.ok(['light', 'standard', 'strict'].includes(entry.level));
    assert.equal(typeof entry.reason, 'string');
    assert.ok(entry.reason.length > 0);
  }

  const byName = Object.fromEntries(signals.map((s) => [s.signal, s]));
  assert.equal(byName.documentation_only.level, 'light');
  assert.equal(byName.new_functionality.level, 'standard');
  assert.equal(byName.new_dependency.level, 'strict');
  assert.equal(byName.new_dependency.decisionType, 'architecture');
  assert.equal(byName.documentation_only.decisionType, null);
});

test('an entry missing Level or Reason is skipped, never guessed at', () => {
  const markdown = [
    '## incomplete_signal',
    '',
    '- **Reason:** no level given here.',
    '',
    '## real_signal',
    '',
    '- **Level:** strict',
    '- **Reason:** a real, complete entry.',
  ].join('\n');
  const signals = parseGovernanceSignals(markdown);
  assert.deepEqual(signals.map((s) => s.signal), ['real_signal']);
});

test('a wrapped Reason field is joined into one line, same convention as decision-triggers.js', () => {
  const markdown = [
    '## wrapped_reason_signal',
    '',
    '- **Level:** standard',
    '- **Reason:** the first line',
    '  continues on a second, indented line.',
  ].join('\n');
  const [entry] = parseGovernanceSignals(markdown);
  assert.equal(entry.reason, 'the first line continues on a second, indented line.');
});

// --- loadGovernanceSignals ---

test('loadGovernanceSignals reports ok: false for a project with no scaffolded file, never crashes', () => {
  const root = tempProject();
  const result = loadGovernanceSignals(root);
  assert.equal(result.ok, false);
  assert.match(result.reason, /juntia init/);
});

test('loadGovernanceSignals reads the real scaffolded file', () => {
  const root = tempProject();
  writeFile(root, GOVERNANCE_SIGNALS_FILE, fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const result = loadGovernanceSignals(root);
  assert.equal(result.ok, true);
  assert.ok(result.signals.some((s) => s.signal === 'new_dependency'));
});

// --- evaluateGovernanceLevel ---

const CATALOG = [
  { signal: 'documentation_only', level: 'light', reason: 'x', decisionType: null },
  { signal: 'isolated_change', level: 'light', reason: 'x', decisionType: null },
  { signal: 'new_functionality', level: 'standard', reason: 'x', decisionType: null },
  { signal: 'new_dependency', level: 'strict', reason: 'x', decisionType: 'architecture' },
  { signal: 'architecture_change', level: 'strict', reason: 'x', decisionType: 'architecture' },
];

test('no declared signals: finalLevel equals baseLevel unchanged — byte-identical to pre-existing static behavior', () => {
  const result = evaluateGovernanceLevel({ baseLevel: 'standard', declaredSignals: [], catalogSignals: CATALOG });
  assert.deepEqual(result, {
    baseLevel: 'standard', detectedSignals: [], finalLevel: 'standard', requiredReview: [],
  });
});

test('an unrecognized declared signal is silently ignored — finalLevel stays at baseLevel', () => {
  const result = evaluateGovernanceLevel({ baseLevel: 'standard', declaredSignals: ['not_a_real_signal'], catalogSignals: CATALOG });
  assert.deepEqual(result.detectedSignals, []);
  assert.equal(result.finalLevel, 'standard');
});

test('a single strict signal escalates a standard base to strict, and names the required review', () => {
  const result = evaluateGovernanceLevel({ baseLevel: 'standard', declaredSignals: ['architecture_change'], catalogSignals: CATALOG });
  assert.equal(result.finalLevel, 'strict');
  assert.deepEqual(result.detectedSignals.map((s) => s.signal), ['architecture_change']);
  assert.deepEqual(result.requiredReview, ['architecture']);
});

test('light-only signals de-escalate a standard base to light — the brief\'s own NPC-animation example', () => {
  const result = evaluateGovernanceLevel({
    baseLevel: 'standard',
    declaredSignals: ['documentation_only', 'isolated_change'],
    catalogSignals: CATALOG,
  });
  assert.equal(result.finalLevel, 'light');
  assert.deepEqual(result.requiredReview, []);
});

test('mixed light and strict signals: strict always wins, regardless of declaration order', () => {
  const result = evaluateGovernanceLevel({
    baseLevel: 'standard',
    declaredSignals: ['isolated_change', 'new_dependency', 'documentation_only'],
    catalogSignals: CATALOG,
  });
  assert.equal(result.finalLevel, 'strict');
  assert.deepEqual(result.requiredReview, ['architecture']);
});

test('two strict signals both feed requiredReview, deduped', () => {
  const result = evaluateGovernanceLevel({
    baseLevel: 'light',
    declaredSignals: ['new_dependency', 'architecture_change'],
    catalogSignals: CATALOG,
  });
  assert.equal(result.finalLevel, 'strict');
  assert.deepEqual(result.requiredReview, ['architecture']);
});

test('escalation ladder: LIGHT base -> STANDARD signal -> STANDARD; STANDARD base -> STRICT signal -> STRICT', () => {
  const toStandard = evaluateGovernanceLevel({ baseLevel: 'light', declaredSignals: ['new_functionality'], catalogSignals: CATALOG });
  assert.equal(toStandard.finalLevel, 'standard');

  const toStrict = evaluateGovernanceLevel({ baseLevel: 'standard', declaredSignals: ['new_dependency'], catalogSignals: CATALOG });
  assert.equal(toStrict.finalLevel, 'strict');
});

test('an invalid baseLevel produces finalLevel: null rather than guessing', () => {
  const result = evaluateGovernanceLevel({ baseLevel: 'not-a-real-level', declaredSignals: [], catalogSignals: CATALOG });
  assert.equal(result.baseLevel, null);
  assert.equal(result.finalLevel, null);
});
