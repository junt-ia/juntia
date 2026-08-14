'use strict';

// Provider Registry — Phase 13B of the Juntia migration.
//
// The concrete "provider name -> adapter module" lookup Phase 12C named as
// the real next step ("closing that gap needs a small provider-name ->
// adapter-module lookup, not a new abstraction") and Phase 12L/13A
// deliberately left unbuilt while `runtime.provider` was still just a
// recorded preference. This is that lookup — the one thing standing
// between "Juntia knows which assistant you use" and "Juntia actually
// calls it."
//
// Deliberately separate from lib/project-intelligence/agent-integration.js's
// RUNTIME_PROFILES: that map answers "which pointer file does this runtime
// need" (Phase 12L); this one answers "which adapter module answers a real
// AI call for this runtime" (this phase). Per this phase's own explicit "no
// mezclar runtime de integrations" — the two concerns share a provider name
// as vocabulary, not a data structure, so one could gain a real profile
// without the other and nothing here would need to change.

const PROVIDERS = {
  'claude-code': { label: 'Claude Code', load: () => require('./claude-cli-adapter.js') },
};

// resolveProvider(providerName) -> { ok: true, label, adapter } |
// { ok: false, reason }
// Never throws, never guesses a fallback provider. An unrecognized name
// (a typo, or a real provider this codebase doesn't have an adapter for
// yet) fails closed with a plain reason string — the caller decides how to
// present that to a human.
function resolveProvider(providerName) {
  const entry = PROVIDERS[providerName];
  if (!entry) {
    return {
      ok: false,
      reason: `Juntia doesn't have a runtime adapter for "${providerName}" yet — supported: ${Object.keys(PROVIDERS).join(', ')}`,
    };
  }
  return { ok: true, label: entry.label, adapter: entry.load() };
}

module.exports = { PROVIDERS, resolveProvider };
