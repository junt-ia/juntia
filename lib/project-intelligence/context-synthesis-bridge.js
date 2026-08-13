'use strict';

// Context Synthesis Bridge — Phase 12J of the Juntia migration.
//
// The first real wiring between Project Intelligence's persisted facts
// (Phase 12I: `.juntia/facts.json`) and an AI runtime, evaluating Phase
// 12H's design: can a runtime turn verified FACTs into a useful
// INTERPRETATION without ever crossing into DECISION? Modeled directly on
// `lib/intent-runtime-bridge.js` (Phase 11C/11) — same shape (an injected
// adapter, a guideline, a validator, fail-closed on any error), applied to
// a second, independent interpretation domain. `lib/intent-runtime-bridge.js`
// itself is not touched.
//
// Unlike the intent bridge, this one is never escalated to automatically —
// there is no deterministic-first routing decision to make here, because
// there is no deterministic equivalent of "interpretation" (the scanner
// only ever produces facts, by design — Phase 12E/12G). Every call is
// therefore an explicit, opt-in invocation from `bin/juntia.js`'s
// `analyze --explain` (Option A, console-only — see the phase doc for why
// a second output surface, `.juntia/pending.json`, was evaluated and
// deliberately not built this phase).
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's Public API
// boundary), same as facts-store.js and the scanner it wraps.

const { factKey } = require('./facts-store.js');
const { SYSTEM_PROMPT, OUTPUT_SCHEMA } = require('../runtime/project-interpretation-guideline.js');
const { validateProjectInterpretation } = require('../runtime/project-interpretation-validator.js');

// The identifier is bracketed so its boundary is unambiguous to copy
// verbatim into `basedOn` — found necessary via a real, live run (not
// assumed): an earlier, unbracketed rendering (`dependency:phaser (value:
// ...)`) led a real runtime response to cite
// "dependency:phaser (value: 49)" as if the trailing annotation were part
// of the identifier, which the validator correctly rejected as unknown.
// See phases/12j-context-synthesis-runtime-evaluation.md for the full
// before/after evidence.
function renderFact(fact) {
  const value = fact.value !== undefined ? ` value:${JSON.stringify(fact.value)}` : '';
  const evidenceSource = fact.evidence && fact.evidence.source ? fact.evidence.source : 'scan';
  return `- id:[${factKey(fact)}]${value} evidence:${evidenceSource}`;
}

function renderChanges(diff) {
  if (!diff || (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0)) {
    return 'No changes since the previous scan (or this is the first scan).';
  }
  const lines = [];
  for (const f of diff.added) lines.push(`+ added: ${factKey(f)}`);
  for (const f of diff.removed) lines.push(`- removed: ${factKey(f)}`);
  for (const c of diff.changed) lines.push(`~ changed: ${c.category}:${c.name} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  return lines.join('\n');
}

// Builds the exact text sent to the runtime. Exported so tests and the real
// validation run can inspect precisely what the runtime is given, without
// re-deriving it — the input contract this phase's brief required to be
// designed explicitly, not assumed.
function buildRequestText(facts, diff) {
  return [
    'FACTS:',
    facts.length > 0 ? facts.map(renderFact).join('\n') : '(no facts — nothing was detected in this project)',
    '',
    'CHANGES:',
    renderChanges(diff),
    '',
    'EXISTING CONTEXT:',
    '(none persisted yet — Juntia has no confirmed interpretation or decision for this project)',
  ].join('\n');
}

// synthesizeContext(facts, diff, { adapter, adapterOptions }) ->
// Promise<{ invoked, ok, result, reason, validation, runtimeMeta }>
//
// Never throws, never guesses. `result` is populated only when the runtime
// was invoked, responded, and passed validation (including the fact-
// grounding check) — every other path returns `result: null` plus a plain-
// text `reason`, exactly like `lib/intent-runtime-bridge.js`'s
// safeFallback, except this bridge has no fallback INTERPRETATION to
// invent (there is nothing deterministic to fall back to for this domain),
// so it fails to nothing rather than to a guessed value.
async function synthesizeContext(facts, diff, { adapter, adapterOptions } = {}) {
  if (!adapter) {
    return { invoked: false, ok: false, result: null, reason: 'no runtime adapter supplied', validation: null, runtimeMeta: null };
  }

  const requestText = buildRequestText(facts, diff);
  const runtimeResponse = await adapter.interpret(requestText, {
    ...adapterOptions, systemPrompt: SYSTEM_PROMPT, schema: OUTPUT_SCHEMA,
  });

  if (!runtimeResponse.ok) {
    return {
      invoked: true, ok: false, result: null,
      reason: `runtime failure: ${runtimeResponse.error} — ${runtimeResponse.message || 'no detail'}`,
      validation: null,
      runtimeMeta: { error: runtimeResponse.error, message: runtimeResponse.message, durationMs: runtimeResponse.durationMs },
    };
  }

  const validation = validateProjectInterpretation(runtimeResponse.raw, facts);

  if (!validation.valid) {
    return {
      invoked: true, ok: false, result: null,
      reason: `runtime output failed validation: ${validation.errors.join('; ')}`,
      validation,
      runtimeMeta: { durationMs: runtimeResponse.durationMs, costUsd: runtimeResponse.costUsd },
    };
  }

  return {
    invoked: true, ok: true, result: validation.result, reason: null, validation,
    runtimeMeta: { durationMs: runtimeResponse.durationMs, costUsd: runtimeResponse.costUsd, usage: runtimeResponse.usage },
  };
}

module.exports = { synthesizeContext, buildRequestText };
