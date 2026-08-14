'use strict';

// Phase 13B — tests for lib/runtime/provider-registry.js: the real
// provider-name -> adapter lookup Phase 12C named as the concrete next
// step. Deterministic, no live call — `resolveProvider('claude-code')`
// returns the real adapter module (a real require, not mocked), but never
// invokes it.

const test = require('node:test');
const assert = require('node:assert/strict');

const { PROVIDERS, resolveProvider } = require('../lib/runtime/provider-registry.js');

test('resolveProvider("claude-code") returns the real, callable adapter module', () => {
  const result = resolveProvider('claude-code');
  assert.equal(result.ok, true);
  assert.equal(result.label, 'Claude Code');
  assert.equal(typeof result.adapter.interpret, 'function');
});

test('resolveProvider returns the exact same real adapter module claude-cli-adapter.js exports', () => {
  const real = require('../lib/runtime/claude-cli-adapter.js');
  const result = resolveProvider('claude-code');
  assert.equal(result.adapter, real);
});

test('resolveProvider fails closed for an unrecognized provider name, never guessing a fallback', () => {
  const result = resolveProvider('openai');
  assert.equal(result.ok, false);
  assert.match(result.reason, /doesn't have a runtime adapter for "openai"/);
  assert.match(result.reason, /claude-code/, 'the failure reason should name what IS supported');
});

test('resolveProvider fails closed for an empty or null provider name', () => {
  assert.equal(resolveProvider('').ok, false);
  assert.equal(resolveProvider(null).ok, false);
  assert.equal(resolveProvider(undefined).ok, false);
});

test('PROVIDERS only lists real, evidenced adapters — one, today', () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['claude-code']);
});
