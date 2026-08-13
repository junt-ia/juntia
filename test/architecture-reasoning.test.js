'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../lib/intent-router.js');
const { analyzeProduct } = require('../lib/product-reasoning.js');
const { analyzeArchitecture, ALWAYS_CONFIRM_CATEGORIES, CONTEXT_NEEDS_BY_IMPACT } = require('../lib/architecture-reasoning.js');
const dataset = require('./fixtures/architecture-reasoning-dataset.js');

function chain(text, known) {
  const ir = classifyIntent(text);
  const pr = analyzeProduct(text, ir, known);
  const ar = analyzeArchitecture(text, pr, known);
  return { ir, pr, ar };
}

// --- Contract shape --------------------------------------------------------

test('analyzeArchitecture: always returns the full output contract', () => {
  const { ar } = chain('Quiero agregar pagos con un proveedor externo.');
  assert.match(ar.impactLevel, /^(none|low|moderate|high)$/);
  for (const key of ['impactCategories', 'recommendations', 'tradeoffs', 'risks', 'constraints', 'unknowns', 'decisionsRequired', 'questions']) {
    assert.ok(Array.isArray(ar[key]), `${key} should be an array`);
  }
  assert.ok('contextNeeds' in ar);
});

test('impactLevel none produces an entirely empty result (proportionality gate)', () => {
  const { ar } = chain('Corrige el typo en el mensaje de confirmación.');
  assert.equal(ar.impactLevel, 'none');
  assert.deepEqual(ar.impactCategories, []);
  assert.deepEqual(ar.recommendations, []);
  assert.deepEqual(ar.unknowns, []);
  assert.deepEqual(ar.contextNeeds, CONTEXT_NEEDS_BY_IMPACT.none);
});

// --- The ARCHITECTURE-intent gate exception, found by testing ------------

test('ARCHITECTURE intent always proceeds to impact detection even though Phase 05 reports level=none', () => {
  const { ir, pr, ar } = chain('Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.');
  assert.equal(ir.intent, 'ARCHITECTURE');
  assert.equal(pr.level, 'none'); // confirms the real Phase 05 behavior this gate must work around
  assert.equal(ar.impactLevel, 'high');
  assert.ok(ar.impactCategories.includes('ownership'));
});

// --- Recommendation vs. decision (never auto-promoted) --------------------

test('recommendation vs decision: a recommendation is never returned as a decision, and vice versa', () => {
  const known = { existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente', relevantTo: ['integration'] }] } };
  const { ar } = chain('Quiero agregar pagos con un proveedor externo.', known);
  assert.ok(ar.recommendations.length > 0);
  assert.ok(ar.recommendations.every((r) => !('decision' in r)));
  assert.ok(ar.recommendations.every((r) => Array.isArray(r.basis) && r.basis.length > 0));
});

// --- Anti-hallucination: no known.existingArchitecture -> no invented recommendation ---

test('anti-hallucination: with no existing-architecture context, recommendations stay empty rather than inventing a component', () => {
  const { ar } = chain('Quiero agregar pagos con un proveedor externo.');
  assert.deepEqual(ar.recommendations, []);
  assert.ok(ar.unknowns.some((u) => u.topic.includes('Contexto de arquitectura existente')));
});

test('anti-hallucination: a supplied known component resolves an always-confirm category without inventing anything beyond it', () => {
  const known = { existingArchitecture: { components: [{ name: 'TenantContext', description: 'contexto existente', relevantTo: ['ownership'] }] } };
  const { ar } = chain('Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.', known);
  assert.equal(ar.unknowns.some((u) => u.topic.includes('ownership')), false);
  assert.ok(ar.recommendations.every((r) => r.basis.some((b) => b.includes('TenantContext'))));
});

// --- Human-in-the-loop: always-confirm categories ---------------------------

test('a security/ownership/persistence-touching request always includes a blocking confirmation unknown unless known context resolves it', () => {
  const { ar } = chain('Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.');
  assert.ok(ALWAYS_CONFIRM_CATEGORIES.includes('ownership'));
  assert.ok(ar.unknowns.some((u) => u.blocking && u.topic.includes('ownership')));
  assert.ok(ar.questions.length > 0);
});

test('a request touching none of the always-confirm categories never produces a forced confirmation', () => {
  const { ar } = chain('Quiero permitir reservas desde una app móvil.');
  assert.equal(ar.impactCategories.includes('security'), false);
  assert.equal(ar.impactCategories.includes('ownership'), false);
  assert.equal(ar.impactCategories.includes('persistence'), false);
  assert.deepEqual(ar.unknowns.filter((u) => u.blocking), []);
});

// --- Trade-offs only when 2+ real alternatives are supplied ---------------

test('trade-offs are empty by default — never generic pros/cons', () => {
  const { ar } = chain('Quiero agregar pagos con un proveedor externo.');
  assert.deepEqual(ar.tradeoffs, []);
});

test('trade-offs appear only when the caller supplies 2+ real alternatives', () => {
  const known = {
    existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente', relevantTo: ['integration'] }] },
    alternatives: [
      { option: 'Extender el adapter existente', pros: ['reutiliza infraestructura'], cons: ['acopla dominios'] },
      { option: 'Crear un adapter dedicado', pros: ['aislamiento'], cons: ['duplicación'] },
    ],
  };
  const { ar } = chain('Necesitamos que el checkout también acepte pagos con criptomonedas.', known);
  assert.equal(ar.tradeoffs.length, 2);
});

// --- Full dataset (data-driven) -------------------------------------------

for (const [i, item] of dataset.core.entries()) {
  test(`dataset.core[${i}] (${item.bucket}) "${item.text}"`, () => {
    let ir, pr, ar;
    if (item.simulatedUpstream) {
      // Real chain returns AMBIGUOUS/none for this phrasing (language gap,
      // not this module's concern) — hand-construct the upstream shape to
      // test THIS module's own logic. See phase doc §6.
      pr = {
        intent: item.expectedIntent,
        level: item.expectedLevel,
        problem: null, goal: null, actors: [], desiredBehavior: [], constraints: [],
        knownDecisions: [], unknowns: [], decisionsRequired: [], acceptanceCriteria: [],
        nonGoals: [], questions: [],
      };
      ar = analyzeArchitecture(item.text, pr, item.known || {});
    } else {
      ({ ir, pr, ar } = chain(item.text, item.known || {}));
      assert.equal(ir.intent, item.expectedIntent, `intent mismatch: got ${ir.intent}`);
      assert.equal(pr.level, item.expectedLevel, `product level mismatch: got ${pr.level}`);
    }

    assert.equal(ar.impactLevel, item.expectedImpact, `impact mismatch: got ${ar.impactLevel}, categories=${JSON.stringify(ar.impactCategories)}`);
    if (item.expectedCategories) {
      for (const cat of item.expectedCategories) {
        assert.ok(ar.impactCategories.includes(cat), `expected category "${cat}", got ${JSON.stringify(ar.impactCategories)}`);
      }
    }
    if (item.expectRecommendationCiting) {
      assert.ok(
        ar.recommendations.some((r) => r.basis.some((b) => b.includes(item.expectRecommendationCiting))),
        `expected a recommendation citing "${item.expectRecommendationCiting}"`,
      );
    }
    if (item.expectNoBlockingUnknownFor) {
      assert.equal(ar.unknowns.some((u) => u.blocking && u.topic.includes(item.expectNoBlockingUnknownFor)), false);
    }
    if (item.expectTradeoffs !== undefined) {
      assert.equal(ar.tradeoffs.length, item.expectTradeoffs);
    }
  });
}

for (const [i, item] of dataset.misses.entries()) {
  test(`dataset.misses[${i}] (documented limitation) "${item.text}"`, () => {
    const { ir, pr, ar } = chain(item.text);
    assert.equal(ir.intent, item.expectedIntent);
    assert.equal(pr.level, item.expectedLevel);
    assert.equal(ar.impactLevel, item.expectedImpact, 'expected this documented miss to remain a miss');
  });
}

// --- Semantic Layer Hypothesis probe (documents the real gap, doesn't fix it) ---

test('Semantic Layer Hypothesis: three phrasings of the same request all fail identically upstream (real chain, no simulation)', () => {
  for (const { text } of dataset.semanticLayerProbe) {
    const { ir, pr } = chain(text);
    assert.equal(ir.intent, 'AMBIGUOUS', `expected AMBIGUOUS for "${text}", got ${ir.intent}`);
    assert.equal(pr.level, 'none');
  }
});
