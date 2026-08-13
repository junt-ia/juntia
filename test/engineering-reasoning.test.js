'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../lib/intent-router.js');
const { analyzeProduct } = require('../lib/product-reasoning.js');
const { analyzeArchitecture } = require('../lib/architecture-reasoning.js');
const { analyzeEngineering, ENGINEERING_APPLICABLE_INTENTS } = require('../lib/engineering-reasoning.js');
const dataset = require('./fixtures/engineering-reasoning-dataset.js');

function chain(text, known) {
  const ir = classifyIntent(text);
  const pr = analyzeProduct(text, ir, known);
  const ar = analyzeArchitecture(text, pr, known);
  const er = analyzeEngineering(pr, ar, known);
  return { ir, pr, ar, er };
}

// --- Contract shape --------------------------------------------------------

test('analyzeEngineering: always returns the full output contract', () => {
  const { er } = chain('Quiero añadir reservas.', {});
  for (const key of ['scope', 'nonGoals', 'affectedAreas', 'filesLikelyAffected', 'implementationSteps', 'validationStrategy', 'risks', 'constraints', 'decisionsRequired', 'unknowns', 'questions']) {
    assert.ok(Array.isArray(er[key]), `${key} should be an array`);
  }
  assert.ok(typeof er.applicable === 'boolean');
});

test('missing productResult or architectureResult returns a not-applicable result, not a crash', () => {
  const er1 = analyzeEngineering(null, null, {});
  assert.equal(er1.applicable, false);
  const { pr } = chain('Quiero añadir reservas.', {});
  const er2 = analyzeEngineering(pr, null, {});
  assert.equal(er2.applicable, false);
});

// --- Gate: which intents are even engineering-applicable -------------------

test('ENGINEERING_APPLICABLE_INTENTS excludes UNDERSTAND, EXPLORE, VALIDATION, AMBIGUOUS, ARCHITECTURE', () => {
  for (const excluded of ['UNDERSTAND', 'EXPLORE', 'VALIDATION', 'AMBIGUOUS', 'ARCHITECTURE']) {
    assert.equal(ENGINEERING_APPLICABLE_INTENTS.includes(excluded), false);
  }
});

test('ARCHITECTURE intent never engages Engineering, even with a resolving decision and component supplied', () => {
  const known = {
    decisions: [{ topic: 'arquitectura multi-tenant', decision: 'Se decidió adoptar TenantContext.', source: 'human' }],
    existingArchitecture: { components: [{ name: 'TenantContext', description: 'contexto existente', relevantTo: ['ownership'], files: ['src/tenant/context.js'] }] },
  };
  const { ir, er } = chain('Necesitamos soporte multi-tenant para que cada restaurante tenga sus datos aislados.', known);
  assert.equal(ir.intent, 'ARCHITECTURE');
  assert.equal(er.applicable, false);
  assert.match(er.reason, /no autoriza trabajo de ingeniería/);
});

test('a clean technical BUG (product level none) still reaches Engineering at tiny tier', () => {
  const { pr, er } = chain('Los emails de confirmación no se están enviando desde ayer.', {});
  assert.equal(pr.level, 'none');
  assert.equal(er.applicable, true);
  assert.equal(er.effortTier, 'tiny');
  assert.equal(er.status, 'READY');
});

// --- Unknown propagation: blocking vs non-blocking -------------------------

test('a blocking unknown (from product or architecture) produces BLOCKED status and humanAction BLOCK, with zero invented content', () => {
  const { er } = chain('Quiero crear un sistema de fidelización con persistencia propia.', {});
  assert.equal(er.status, 'BLOCKED');
  assert.equal(er.humanAction, 'BLOCK');
  assert.deepEqual(er.implementationSteps, []);
  assert.deepEqual(er.filesLikelyAffected, []);
  assert.equal(er.objective, null);
  assert.ok(er.decisionsRequired.length > 0);
});

test('resolving the same blocking unknowns upstream (product decision + architecture component) flips BLOCKED to READY', () => {
  const known = {
    decisions: [{ topic: 'fidelizacion', decision: 'Programa de fidelización = 1 punto por cada $10 gastados.', source: 'product-team' }],
    existingArchitecture: { components: [{ name: 'CustomerProfileStore', description: 'almacén existente', relevantTo: ['persistence'], files: ['src/customers/store.js'] }] },
  };
  const { er } = chain('Quiero crear un sistema de fidelización con persistencia propia.', known);
  assert.equal(er.status, 'READY');
  assert.equal(er.humanAction, 'CONFIRM');
});

test('a non-blocking unknown does not block the plan', () => {
  const { ar, er } = chain('Quiero permitir reservas desde una app móvil.', {});
  assert.ok(ar.unknowns.some((u) => !u.blocking));
  assert.equal(er.status, 'READY');
});

// --- Files: never invented, only cited from known.existingArchitecture -----

test('files stay UNKNOWN when no known.existingArchitecture component names real files', () => {
  const { er } = chain('Quiero permitir reservas desde una app móvil.', {});
  assert.ok(er.filesLikelyAffected.length > 0);
  assert.ok(er.filesLikelyAffected.every((f) => f.status === 'UNKNOWN' && f.value === null));
});

test('files are cited (never invented) when a known component names them', () => {
  const known = { existingArchitecture: { components: [{ name: 'PaymentGatewayAdapter', description: 'adaptador existente', relevantTo: ['integration'], files: ['src/payments/adapter.js'] }] } };
  const { er } = chain('Quiero agregar pagos con un proveedor externo.', known);
  const filesEntry = er.filesLikelyAffected.find((f) => f.category === 'integration');
  assert.deepEqual(filesEntry.value, ['src/payments/adapter.js']);
  assert.ok(filesEntry.basis[0].includes('PaymentGatewayAdapter'));
});

test('a component can resolve a human-confirmation unknown without naming real files (two different degrees of grounding)', () => {
  const known = { existingArchitecture: { components: [{ name: 'lib/*.js modules', description: 'módulos sin estado (BASELINE.md §9)', relevantTo: ['persistence'] }] } };
  const { er } = chain('Quiero implementar un sistema de telemetría para guardar datos de uso de los skills.', known);
  assert.equal(er.status, 'READY');
  const filesEntry = er.filesLikelyAffected.find((f) => f.category === 'persistence');
  assert.equal(filesEntry.status, 'UNKNOWN');
});

// --- Proportionality: effort tier ------------------------------------------

test('effort tier is the max of the intent-base tier and the architecture-impact floor', () => {
  const { er: tiny } = chain('Corrige el typo en el mensaje de confirmación.', {});
  assert.equal(tiny.effortTier, 'tiny');
  const { er: normal } = chain('Quiero añadir reservas.', {});
  assert.equal(normal.effortTier, 'normal');
  const { er: deep } = chain('Quiero permitir reservas desde una app móvil.', {});
  assert.equal(deep.effortTier, 'deep');
  const { er: architect } = chain('Quiero implementar el guardar de datos sensibles de tarjetas para compras futuras.', {
    existingArchitecture: { components: [{ name: 'VaultedCardStore', description: 'almacén existente', relevantTo: ['persistence', 'security'], files: ['x'] }] },
  });
  assert.equal(architect.effortTier, 'architect');
});

test('tiny tier produces no scope, no implementation steps — only an objective and a minimal validation note', () => {
  const { er } = chain('Actualiza la dependencia de Stripe a la última versión menor.', {});
  assert.deepEqual(er.scope, []);
  assert.deepEqual(er.implementationSteps, []);
  assert.ok(er.objective.value.length > 0);
});

test('normal tier and above produce implementation steps ending in a validation step', () => {
  const { er } = chain('Quiero añadir reservas.', {});
  assert.ok(er.implementationSteps.length > 0);
  assert.equal(er.implementationSteps[er.implementationSteps.length - 1].value, 'Validar según la estrategia de validación.');
});

// --- Human-in-the-loop: AUTO / CONFIRM / BLOCK ------------------------------

test('humanAction is BLOCK whenever a blocking unknown exists, CONFIRM at deep/architect tier otherwise, AUTO at tiny/normal', () => {
  const { er: blocked } = chain('Quiero agregar autenticación de dos factores para proteger las cuentas.', {});
  assert.equal(blocked.humanAction, 'BLOCK');
  const { er: confirm } = chain('Quiero agregar autenticación de dos factores para proteger las cuentas.', {
    existingArchitecture: { components: [{ name: 'AuthModule', description: 'módulo existente', relevantTo: ['security'], files: ['src/auth/module.js'] }] },
  });
  assert.equal(confirm.humanAction, 'CONFIRM');
  const { er: auto } = chain('Quiero añadir reservas.', {});
  assert.equal(auto.humanAction, 'AUTO');
});

// --- Test strategy: deterministic, tier + category based -------------------

test('test strategy escalates with tier, and always includes integration when security/ownership is touched', () => {
  const { er: tiny } = chain('Actualiza la dependencia de Stripe a la última versión menor.', {});
  assert.deepEqual(tiny.testStrategy, { manual: true, unit: false, integration: false, e2e: false, reason: 'Nivel de esfuerzo tiny.' });
  const { er: security } = chain('Quiero agregar autenticación de dos factores para proteger las cuentas.', {
    existingArchitecture: { components: [{ name: 'AuthModule', description: 'módulo existente', relevantTo: ['security'], files: ['src/auth/module.js'] }] },
  });
  assert.equal(security.testStrategy.integration, true);
});

// --- Regression risk: only from evidence, never invented relationships -----

test('regression risk from testCoverage is only added when a known component reports low/none coverage', () => {
  const withRisk = chain('Quiero crear un sistema de fidelización con persistencia propia.', {
    decisions: [{ topic: 'fidelizacion', decision: 'definido', source: 'x' }],
    existingArchitecture: { components: [{ name: 'CustomerProfileStore', description: 'x', relevantTo: ['persistence'], files: ['a'], testCoverage: 'low' }] },
  }).er;
  assert.ok(withRisk.risks.some((r) => r.category === 'regression' && r.value.includes('CustomerProfileStore')));

  const withoutRisk = chain('Quiero crear un sistema de fidelización con persistencia propia.', {
    decisions: [{ topic: 'fidelizacion', decision: 'definido', source: 'x' }],
    existingArchitecture: { components: [{ name: 'CustomerProfileStore', description: 'x', relevantTo: ['persistence'], files: ['a'], testCoverage: 'ok' }] },
  }).er;
  assert.equal(withoutRisk.risks.some((r) => r.category === 'regression'), false);
});

// --- Full dataset (data-driven) -------------------------------------------

for (const [i, item] of dataset.core.entries()) {
  test(`dataset.core[${i}] (${item.bucket}) "${item.text}"`, () => {
    const { ir, er } = chain(item.text, item.known || {});
    assert.equal(ir.intent, item.expectedIntent, `intent mismatch: got ${ir.intent}`);
    assert.equal(er.applicable, item.expectedApplicable, `applicable mismatch for "${item.text}"`);

    if (!item.expectedApplicable) {
      if (item.expectedReasonIncludes) assert.ok(er.reason.includes(item.expectedReasonIncludes));
      return;
    }

    assert.equal(er.status, item.expectedStatus, `status mismatch: got ${er.status}`);
    assert.equal(er.effortTier, item.expectedTier, `tier mismatch: got ${er.effortTier}`);
    assert.equal(er.humanAction, item.expectedHumanAction, `humanAction mismatch: got ${er.humanAction}`);

    if (item.expectedCategories) {
      for (const cat of item.expectedCategories) assert.ok(er.affectedAreas.includes(cat));
    }
    if (item.expectedBlockingTopicsInclude) {
      const blockingTopics = er.unknowns.filter((u) => u.blocking).map((u) => u.topic);
      for (const topic of item.expectedBlockingTopicsInclude) assert.ok(blockingTopics.includes(topic), `expected blocking topic "${topic}", got ${JSON.stringify(blockingTopics)}`);
    }
    if (item.expectFilesUnknownFor) {
      const entry = er.filesLikelyAffected.find((f) => f.category === item.expectFilesUnknownFor);
      assert.ok(entry && entry.status === 'UNKNOWN');
    }
    if (item.expectFilesKnownFor) {
      const entry = er.filesLikelyAffected.find((f) => f.category === item.expectFilesKnownFor);
      assert.ok(entry && entry.status === 'KNOWN' && Array.isArray(entry.value) && entry.value.length > 0);
    }
    if (item.expectRegressionRiskCiting) {
      assert.ok(er.risks.some((r) => r.category === 'regression' && r.value.includes(item.expectRegressionRiskCiting)));
    }
  });
}

for (const [i, item] of dataset.misses.entries()) {
  test(`dataset.misses[${i}] (documented limitation) "${item.text}"`, () => {
    const { ir, er } = chain(item.text, item.known || {});
    assert.equal(ir.intent, item.expectedIntent, 'expected this documented miss to remain a miss');
    assert.equal(er.applicable, false);
  });
}

// --- Real-repository experiment --------------------------------------------

test('real-repo experiment: telemetry request is BLOCKED without grounding, READY (files still UNKNOWN) with a BASELINE.md-shaped component', () => {
  const { text, knownWithoutGrounding, knownWithGrounding } = dataset.realRepoExperiment;
  const without = chain(text, knownWithoutGrounding).er;
  assert.equal(without.status, 'BLOCKED');
  assert.equal(without.humanAction, 'BLOCK');

  const withGrounding = chain(text, knownWithGrounding).er;
  assert.equal(withGrounding.status, 'READY');
  assert.equal(withGrounding.humanAction, 'CONFIRM');
  const filesEntry = withGrounding.filesLikelyAffected.find((f) => f.category === 'persistence');
  assert.equal(filesEntry.status, 'UNKNOWN', 'BASELINE.md names a pattern, not concrete files — grounding resolves confirmation but not file paths');
});

// --- Semantic Layer inheritance (documents that Engineering adds no new gap) ---

test('Semantic Layer inheritance: with a hand-constructed, upstream-shaped input, Engineering\'s own logic works fine — the ceiling is entirely upstream', () => {
  const { productResult, architectureResult } = dataset.semanticLayerInheritance;
  const er = analyzeEngineering(productResult, architectureResult, {});
  assert.equal(er.applicable, true);
  assert.equal(er.status, 'READY');
  assert.equal(er.effortTier, 'normal');
});
