'use strict';

// False-confidence risk signal — Phase 11 (Runtime Routing), opened after
// 11A-11C's sub-phase investigations converged on this as the single most
// evidenced, narrowly-scoped fix for the routing blind spot Phase 11C
// measured directly: deterministic-first routing that escalates only on
// `AMBIGUOUS` never reaches Phase 08/09's two known false-confidence bugs,
// because both are cases where the router is confidently WRONG, not
// honestly uncertain. Full rationale, corpus validation, and the decision
// among options A-E: phases/11-runtime-routing.md.
//
// GOVERNANCE, not INTERPRETATION (Phase 11B's classification, reused): this
// module does not attempt to understand what a sentence means — it is a
// narrow, mechanical trigger over the real Phase 04 router's own already-
// computed output plus a literal-text check, exactly the kind of thing this
// migration has kept deterministic throughout (ALWAYS_CONFIRM_CATEGORIES,
// BASE_TIER_BY_INTENT). `lib/intent-router.js` is NOT modified — per this
// migration's unbroken phase-boundary discipline and this phase's own
// explicit "do not change Phase 04 merely to make Phase 11 easier" rule,
// this lives as a separate, small, independently-testable check the routing
// layer applies to Phase 04's real, unmodified output.
//
// Root cause, per Phase 09's own precise finding (LEARNINGS.md, Phase 09):
// the bug is NOT "negation breaks the router in general" — Phase 09's own
// adversarial set already showed 3 of 5 negated/retracted requests land
// correctly on AMBIGUOUS, because the specific verb forms used don't match
// any Phase 04 rule at all. The bug is specific: certain NEW_FEATURE/
// ARCHITECTURE rules match a stem or a literal cue (e.g. "añad-", "multi-
// tenant") without checking for a preceding negation/retraction marker in
// the same sentence, and confidently proceed anyway (`action: 'auto'`).
//
// Scope, deliberately narrow and evidence-bounded (real-corpus-validated,
// not assumed): flags a result as at-risk only when ALL of:
//   1. the real Phase 04 router already committed to `action: 'auto'`
//      (a confidently-unquestioned result — nothing here touches cases
//      already asking/confirming);
//   2. the intent is NEW_FEATURE, EVOLUTION, or ARCHITECTURE — the
//      "creation/change/foundational" family Phase 09 characterized, NOT
//      BUG. This exclusion is load-bearing: BUG's own strongest rule IS
//      negation ("no funciona", "no reciben") — a naive check without this
//      exclusion would have flagged the majority of real BUG examples in
//      this migration's own dataset as false positives, actively
//      undermining a rule that is already correct;
//   3. the text contains a negation/retraction marker.
//
// Validated directly against every unique text across every dataset fixture
// in this migration (143 items, 7 files, Phases 04/05/06/07/08/09/11A):
// exactly 2 flagged, both are the known false-confidence cases, zero false
// positives — including on all 5 real BUG examples containing "no" in this
// migration's corpus. See phases/11-runtime-routing.md for the full table.

const RISK_INTENTS = new Set(['NEW_FEATURE', 'EVOLUTION', 'ARCHITECTURE']);

// Deliberately a single, simple marker — not an attempt to catch every
// negation phrasing (that would be exactly the "recreate Phase 04 in a new
// regex table" anti-pattern Phase 11B warned against). This is a narrow
// SAFETY NET that decides whether to ask for a second opinion, not a
// classifier — a missed negation here simply means the existing behavior
// (no escalation) continues unchanged, not a new failure mode.
const NEGATION_OR_RETRACTION_MARKER = /\bno\b/i;

function hasFalseConfidenceRisk(text, deterministicResult) {
  if (!deterministicResult || deterministicResult.action !== 'auto') return false;
  if (!RISK_INTENTS.has(deterministicResult.intent)) return false;
  return NEGATION_OR_RETRACTION_MARKER.test(text || '');
}

module.exports = { hasFalseConfidenceRisk, RISK_INTENTS };
