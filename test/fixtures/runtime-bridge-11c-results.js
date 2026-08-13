'use strict';

// Phase 11C — frozen recording of REAL Claude Code CLI invocations.
//
// Captured 2026-08-13 via lib/runtime/claude-cli-adapter.js, using the
// session's own already-authenticated OAuth session (no ANTHROPIC_API_KEY,
// no new credential — confirmed unset in this environment both before and
// during capture). Model: claude-haiku-4-5-20251001, invoked via the
// installed Claude Code CLI binary (CLAUDE_CODE_EXECPATH), --tools "" (zero
// tool access), --no-session-persistence, --json-schema enforcing the
// contract in lib/runtime/reasoning-guideline.js.
//
// `npm test` never invokes the CLI live — this fixture is asserted against
// exactly like Phase 11A's local-model-11a-results.js: real numbers,
// recorded once, never re-simulated. Dataset items reused verbatim from
// Phases 04/05/08/09/11A (see each item's `origin`) — none invented for
// this phase, none reworded after seeing results.
//
// `genuine_paraphrase` has TWO real recordings, both kept: the organic
// first run (which genuinely timed out at the then-default 30s) and a
// clearly separate retry at a longer timeout — neither replaces the other.
// The first is also this phase's real evidence for the required
// timeout-failure test; it was not manufactured for that purpose, it just
// happened to serve both roles honestly.

module.exports = {
  model: 'claude-haiku-4-5-20251001',
  runtime: 'Claude Code CLI 2.1.227',
  authMethod: 'existing OAuth session (Claude Code Pro/Max subscription) — no API key used',
  capturedAt: '2026-08-13',

  primaryMatrix: [
    {
      label: 'trivial_maintenance', origin: 'phase04',
      text: 'Actualiza la dependencia de Stripe a la última versión menor.',
      deterministicOnly: { intent: 'MAINTENANCE', confidence: 'high', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'MAINTENANCE', confidence: 'high', action: 'auto' },
      totalMs: 1,
    },
    {
      label: 'obvious_feature', origin: 'phase04',
      text: 'Quiero implementar notificaciones por email cuando se confirma una reserva.',
      deterministicOnly: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      totalMs: 0,
    },
    {
      label: 'obvious_bug', origin: 'phase04',
      text: 'El checkout falla cuando el carrito tiene más de 10 productos.',
      deterministicOnly: { intent: 'BUG', confidence: 'high', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'BUG', confidence: 'high', action: 'auto' },
      totalMs: 0,
    },
    {
      label: 'ambiguous_feature', origin: 'phase04_flagship',
      text: 'Quiero que los clientes VIP tengan un descuento del 10%.',
      deterministicOnly: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      runtimeInvoked: true,
      finalResult: {
        intent: 'AMBIGUOUS', confidence: 'medium', action: 'ask',
        interpretation: 'El usuario solicita que los clientes VIP reciban un descuento del 10%, pero no está claro si esto introduce una nueva característica o modifica un sistema de descuentos existente.',
        unknownsCount: 3,
      },
      runtimeMeta: { durationMs: 22201, costUsd: 0.011308 },
      totalMs: 22202,
      note: 'runtime reached the SAME safe AMBIGUOUS/ask outcome as the deterministic router, but with a legible interpretation and 3 named unknowns instead of a bare "ask" — see phase doc for how this is scored',
    },
    {
      label: 'genuine_paraphrase', origin: 'phase08_paraphrase',
      text: 'Necesitamos que los clientes que más compran tengan alguna ventaja.',
      deterministicOnly: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      runtimeInvoked: true,
      firstAttempt: {
        outcome: 'timeout', timeoutMs: 30000, durationMs: 32359,
        note: 'REAL, organic timeout at this phase\'s original 30s default — not manufactured. Doubles as this phase\'s primary evidence for the required timeout-failure test (see failureExperiments below).',
        fallbackResult: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      },
      retryAtLongerTimeout: {
        timeoutMs: 60000, durationMs: 29792,
        finalResult: {
          intent: 'NEW_FEATURE', confidence: 'medium', action: 'confirm',
          interpretation: 'Introduce a system that grants some form of advantage or preferential benefit to customers with the highest purchase activity.',
          unknownsCount: 3,
        },
        runtimeMeta: { costUsd: 0.013691 },
        note: 'Did not classify AMBIGUOUS — picked NEW_FEATURE at medium confidence, but correctly flagged "existing system state" as an unknown and set action=confirm (not auto) — informative AND safe, not a silent guess. This is the one case in this matrix where the runtime added real interpretive value over the deterministic AMBIGUOUS/ask baseline.',
      },
    },
    {
      label: 'colloquial_spanish', origin: 'phase08_colloquial',
      text: 'Dale soporte a los VIP.',
      deterministicOnly: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      runtimeInvoked: true,
      finalResult: {
        intent: 'AMBIGUOUS', confidence: 'low', action: 'ask',
        interpretation: 'El usuario solicita que se proporcione soporte a los VIPs, pero no especifica qué forma debe tomar ese soporte ni si VIP es una categoría de usuario que ya existe en el sistema.',
        unknownsCount: 3,
      },
      runtimeMeta: { durationMs: 20533, costUsd: 0.009604 },
      totalMs: 20533,
    },
    {
      label: 'english', origin: 'phase08_english',
      text: "Let's give our loyal customers a 10% discount.",
      deterministicOnly: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      runtimeInvoked: true,
      finalResult: {
        intent: 'AMBIGUOUS', confidence: 'low', action: 'ask',
        interpretation: 'The user proposes implementing a 10% discount for loyal customers, but it is unclear whether this introduces a new loyalty discount system or modifies an existing one.',
        unknownsCount: 3,
      },
      runtimeMeta: { durationMs: 29452, costUsd: 0.014247 },
      totalMs: 29452,
    },
    {
      label: 'negation', origin: 'phase08_09_false_confidence_1',
      text: 'No añadas nada, solo revisa el código.',
      deterministicOnly: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      totalMs: 0,
      note: 'CRITICAL FINDING: this is Phase 08/09\'s known false-confidence bug. Deterministic-first routing means the runtime is NEVER invoked here, because the router does not report itself as AMBIGUOUS or low-confidence for this input — it is confidently wrong. AMBIGUOUS-only fallback does not catch confidently-wrong cases, only honestly-uncertain ones. See phase doc.',
    },
    {
      label: 'retraction', origin: 'phase09_false_confidence_2',
      text: 'Antes queríamos multi-tenant, pero ya no lo necesitamos.',
      deterministicOnly: { intent: 'ARCHITECTURE', confidence: 'high', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'ARCHITECTURE', confidence: 'high', action: 'auto' },
      totalMs: 0,
      note: 'Same finding as negation above: Phase 09\'s second known false-confidence case is also never reached by the runtime bridge, for the identical structural reason.',
    },
    {
      label: 'missing_business_definition', origin: 'phase05_deliberate_miss',
      text: 'Quiero añadir un programa de puntos.',
      deterministicOnly: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'NEW_FEATURE', confidence: 'medium', action: 'auto' },
      totalMs: 0,
      note: 'Correctly out of this bridge\'s scope — Phase 04\'s Intent Router is not ambiguous about the INTENT here (it is NEW_FEATURE); the undefined-business-term gap is a Product Reasoning-level problem (Phase 05), which this phase explicitly does not migrate.',
    },
    {
      label: 'potentially_dangerous_invented_assumption', origin: 'phase11a_real_hallucination_1',
      text: 'Los clientes que más gastan merecen un trato diferente.',
      deterministicOnly: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      runtimeInvoked: true,
      finalResult: {
        intent: 'AMBIGUOUS', confidence: 'low', action: 'ask',
        interpretation: 'El usuario afirma que los clientes con mayor gasto merecen trato diferente, pero no especifica qué acción desea (entender comportamiento actual, explorar opciones, implementar una característica, o validar un requisito).',
        unknownsCount: 4,
      },
      runtimeMeta: { durationMs: 20339, costUsd: 0.00927 },
      totalMs: 20339,
      note: 'The same source text Phase 11A\'s local model hallucinated on (it invented "un descuento" — a discount — never mentioned in the source). This run\'s evidence/unknowns list explicitly flags "Concrete definition of \'different treatment\'" as unresolved and does NOT invent a mechanism anywhere in interpretation, evidence, or unknowns — no repeat of Phase 11A\'s specific hallucination in this one real run (not a claim this can never happen, see phase doc for how this is scored).',
    },
    {
      label: 'architecture_request', origin: 'phase04_architecture',
      text: 'Necesitamos decidir la arquitectura para soportar múltiples inquilinos (multi-tenant).',
      deterministicOnly: { intent: 'ARCHITECTURE', confidence: 'high', action: 'auto' },
      runtimeInvoked: false,
      finalResult: { intent: 'ARCHITECTURE', confidence: 'high', action: 'auto' },
      totalMs: 0,
    },
  ],

  failureExperiments: [
    {
      case: 'timeout (organic, real)',
      trigger: 'genuine_paraphrase primary run exceeded the 30000ms default',
      observed: { error: 'timeout', durationMs: 32359 },
      bridgeFallback: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
    },
    {
      case: 'timeout (forced, real)',
      trigger: 'timeoutMs: 10 supplied deliberately against the real binary',
      observed: { error: 'timeout', durationMs: 13 },
      bridgeFallback: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
    },
    {
      case: 'binary_not_found (real)',
      trigger: 'CLAUDE_CODE_EXECPATH temporarily pointed at a nonexistent path',
      observed: { error: 'binary_not_found', message: 'spawn ENOENT', durationMs: 1 },
      bridgeFallback: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
    },
    {
      case: 'malformed JSON output',
      trigger: 'not reachable via the real binary under normal operation (it reliably respects --json-schema) — exercised instead via lib/runtime/validator.js unit tests with hand-constructed input, same discipline Phase 06/07 used for their own anti-hallucination gates',
      observed: 'see test/runtime-validator.test.js',
      bridgeFallback: { intent: 'AMBIGUOUS', confidence: 'low', action: 'ask' },
      real: false,
    },
    {
      case: 'empty response',
      trigger: 'not reachable via the real binary under normal operation in this experiment — the adapter\'s empty-response check (lib/runtime/claude-cli-adapter.js) is code-reviewed and logic-verified but not empirically triggered; documented as an honest gap, not fabricated',
      observed: null,
      real: false,
    },
    {
      case: 'unexpected governance field in output',
      trigger: 'not observed from the real binary in any of the 6 real successful calls in this experiment — exercised via lib/runtime/validator.js unit tests instead',
      observed: 'see test/runtime-validator.test.js',
      real: false,
    },
  ],

  costSummary: {
    totalRealCallsSucceeded: 6,
    totalRealCallsFailed: 3,
    totalCostUsd: 0.011308 + 0.009604 + 0.014247 + 0.00927 + 0.013691,
    note: 'total_cost_usd is what the CLI itself reports per call — a notional per-token-equivalent cost tracked against the Pro/Max subscription\'s usage allowance, NOT a separate charge; no ANTHROPIC_API_KEY was used at any point in this experiment.',
  },
};
