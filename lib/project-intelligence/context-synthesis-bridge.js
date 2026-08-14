'use strict';

// Context Request Builder — originally Phase 12J's Context Synthesis
// Bridge; narrowed by Phase 13D once the architecture it served (Juntia
// spawning an internal AI runtime to interpret a project — see
// `synthesizeContext`, Phase 12J-13C) was retired in favor of an AI
// Handoff: the same FACTS/CHANGES/EXISTING CONTEXT rendering this module
// built for an internal runtime call is still exactly what an external
// agent needs to see, so `buildRequestText` survives unchanged and is now
// reused by `agent-handoff.js`. `synthesizeContext` itself — the part that
// invoked an injected adapter — is gone: nothing in this codebase invokes
// an AI runtime internally anymore (see phases/13d-ai-handoff-
// implementation.md).
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's Public API
// boundary), same as facts-store.js and the scanner it wraps.

const { factKey } = require('./facts-store.js');

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

// Real human decisions, if any exist (Phase 12K), given to the runtime as
// read-only background — never something it can add to or contradict
// without saying so. Closes a real gap Phase 12J itself left: its own
// EXISTING CONTEXT text always claimed "none persisted yet," which became
// factually wrong the moment Phase 12K made decisions.json real. A
// conflicted decision is still included (labeled), since "a human decided
// X, though the evidence for it may be stale" is still real, useful
// context — deciding whether that conflict matters is still the human's
// job, not something this bridge resolves.
function renderExistingContext(decisions) {
  if (!decisions || decisions.length === 0) {
    return '(none persisted yet — Juntia has no confirmed decision for this project)';
  }
  return decisions
    .map((d) => `- ${d.text}${d.status === 'conflicted' ? ' [flagged: based on evidence that may no longer be current]' : ''}`)
    .join('\n');
}

// Builds the exact text sent to the runtime. Exported so tests and the real
// validation run can inspect precisely what the runtime is given, without
// re-deriving it — the input contract this phase's brief required to be
// designed explicitly, not assumed.
function buildRequestText(facts, diff, decisions = []) {
  return [
    'FACTS:',
    facts.length > 0 ? facts.map(renderFact).join('\n') : '(no facts — nothing was detected in this project)',
    '',
    'CHANGES:',
    renderChanges(diff),
    '',
    'EXISTING CONTEXT:',
    renderExistingContext(decisions),
  ].join('\n');
}

module.exports = { buildRequestText };
