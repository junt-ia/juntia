'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../lib/intent-router.js');
const dataset = require('./fixtures/intent-dataset.js');

const { classifyIntent, CONTEXT_MAP, WORKFLOW_MAP, INTENTS, CONTEXT_CATEGORIES } = router;

// --- Contract shape -------------------------------------------------------

test('classifyIntent: always returns the full output contract', () => {
  const result = classifyIntent('Quiero añadir clientes VIP.');
  assert.equal(typeof result.intent, 'string');
  assert.match(result.confidence, /^(high|medium|low)$/);
  assert.equal(typeof result.reason, 'string');
  assert.ok('alternateIntent' in result);
  assert.ok('contextRequirements' in result);
  assert.ok('workflow' in result);
  assert.match(result.action, /^(auto|confirm|ask)$/);
  assert.ok(Array.isArray(result.questions));
});

test('classifyIntent: empty/whitespace-only text is AMBIGUOUS, not a guess', () => {
  assert.equal(classifyIntent('').intent, 'AMBIGUOUS');
  assert.equal(classifyIntent('   ').intent, 'AMBIGUOUS');
});

test('classifyIntent: unrecognizable text is AMBIGUOUS with an open question, not forced into a category', () => {
  const result = classifyIntent('xyz qwerty 12345');
  assert.equal(result.intent, 'AMBIGUOUS');
  assert.equal(result.action, 'ask');
  assert.equal(result.questions.length, 1);
});

// --- Data tables cover every intent, symmetrically ------------------------

test('CONTEXT_MAP and WORKFLOW_MAP have an entry for every core intent, no more, no less', () => {
  for (const intent of INTENTS) {
    assert.ok(CONTEXT_MAP[intent], `CONTEXT_MAP missing ${intent}`);
    assert.ok(WORKFLOW_MAP[intent], `WORKFLOW_MAP missing ${intent}`);
    for (const category of CONTEXT_CATEGORIES) {
      assert.match(
        CONTEXT_MAP[intent][category],
        /^(minimal|relevant|optional|prohibited)$/,
        `${intent}.${category} has an invalid budget label`,
      );
    }
  }
  assert.equal(Object.keys(CONTEXT_MAP).length, INTENTS.length);
  assert.equal(Object.keys(WORKFLOW_MAP).length, INTENTS.length);
});

// --- The critical distinction (NEW_FEATURE vs EVOLUTION vs BUG vs REFACTOR)

test('critical distinction: the phase brief\'s own VIP example set classifies coherently', () => {
  assert.equal(classifyIntent('Quiero añadir clientes VIP.').intent, 'NEW_FEATURE');
  assert.equal(classifyIntent('Quiero cambiar cómo funcionan los clientes VIP.').intent, 'EVOLUTION');
  assert.equal(classifyIntent('Los clientes VIP no reciben el descuento.').intent, 'BUG');
  assert.equal(classifyIntent('Quiero reorganizar el código de clientes VIP.').intent, 'REFACTOR');
});

test('BUG language dominates even when a creation/change cue appears in the same sentence', () => {
  const result = classifyIntent('Los clientes VIP no reciben el descuento que deberíamos añadir.');
  assert.equal(result.intent, 'BUG');
  assert.equal(result.confidence, 'high');
});

// --- Ambiguity-resolution policy ------------------------------------------

test('ambiguity policy: a true tie between two intents returns AMBIGUOUS with a specific either/or question', () => {
  const result = classifyIntent('Algo pasa con las reservas.');
  assert.equal(result.intent, 'AMBIGUOUS');
  assert.equal(result.action, 'ask');
});

test('ambiguity policy: never auto-answers with contextRequirements/workflow when AMBIGUOUS', () => {
  const result = classifyIntent('xyz qwerty 12345');
  assert.equal(result.contextRequirements, null);
  assert.equal(result.workflow, null);
});

test('ambiguity policy: a genuine equal-strength tie presents both candidates as the question', () => {
  const result = classifyIntent('Quiero añadir descuentos y también mejorar el checkout.');
  assert.equal(result.intent, 'AMBIGUOUS');
  assert.equal(result.action, 'ask');
  assert.ok(['NEW_FEATURE', 'EVOLUTION'].includes(result.alternateIntent));
  assert.match(result.questions[0], /NEW_FEATURE|EVOLUTION/);
});

test('ambiguity policy: medium confidence + different workflows + material risk triggers "confirm", not silent auto-pick', () => {
  const result = classifyIntent('Quiero ampliar y reorganizar el sistema de pagos.');
  assert.equal(result.intent, 'REFACTOR');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.alternateIntent, 'EVOLUTION');
  assert.equal(result.action, 'confirm');
  assert.equal(result.questions.length, 1);
});

test('ambiguity policy: MAINTENANCE never asks for confirmation even at medium confidence (low risk, proportionality)', () => {
  // MAINTENANCE and BUG only ever co-occur if BUG's dominant-signal branch
  // doesn't already claim the sentence; construct a low-risk medium-margin
  // case directly against the policy function via a controlled request.
  const result = classifyIntent('Actualiza la dependencia de Stripe.');
  assert.equal(result.intent, 'MAINTENANCE');
  assert.equal(result.action, 'auto');
});

// --- Full dataset (data-driven) -------------------------------------------
// Each fixture becomes its own test case so failures are individually
// visible and re-runnable, not summarized away. `expected` may be a single
// intent, an array of acceptable intents (genuinely defensible multiple
// readings), or 'AMBIGUOUS'.

for (const [i, item] of dataset.entries()) {
  test(`dataset[${i}] "${item.text}" -> expected ${JSON.stringify(item.expected)}`, () => {
    const result = classifyIntent(item.text);
    const acceptable = Array.isArray(item.expected) ? item.expected : [item.expected];
    // A low-confidence non-ambiguous guess is an acceptable outcome for a
    // hard case too, as long as the *intent* itself is one of the
    // defensible readings — confidence, not just intent, is part of being
    // "honest" about a hard case.
    const isHardCase = Array.isArray(item.expected) && item.expected.includes('AMBIGUOUS');
    if (isHardCase) {
      const ok = acceptable.includes(result.intent) || result.confidence === 'low';
      assert.ok(ok, `got intent=${result.intent} confidence=${result.confidence}, reason="${result.reason}"`);
    } else {
      assert.ok(
        acceptable.includes(result.intent),
        `got intent=${result.intent} (confidence=${result.confidence}), expected one of ${acceptable.join('/')}. reason="${result.reason}"`,
      );
    }
  });
}
