'use strict';

// Evaluation dataset for Product Reasoning (Phase 05). 35 requests across
// the 6 buckets the phase brief required (5 each minimum: tiny maintenance,
// normal feature, evolution, exploratory ideas, ambiguous, insufficient
// product information), plus items from the brief's own worked examples and
// a few cross-phase findings worth preserving as regression cases.
//
// Every `expectedIntent`/`expectedLevel`/`expectedBlocking` value below was
// recorded from actually running `classifyIntent()` + `analyzeProduct()`
// against the text — not predicted first and then reconciled. Several
// items deliberately preserve real gaps discovered this way (an intent the
// router can't yet classify, or an unknown the reasoning module doesn't yet
// detect) rather than being reworded until they passed — see each item's
// `note` and the phase doc §7 for the honest account.

module.exports = [
  // --- Tiny maintenance (5) — expect MAINTENANCE, level 'none' ---
  { bucket: 'tiny_maintenance', text: 'Corrige el typo en el mensaje de confirmación de reserva.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'tiny_maintenance', text: 'Actualiza la dependencia de Stripe a la última versión menor.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'tiny_maintenance', text: 'Arregla el warning de lint en el archivo de checkout.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'tiny_maintenance', text: 'Actualiza el changelog con los cambios de esta semana.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'tiny_maintenance', text: 'Actualiza la versión de Node en el CI a la 22.', expectedIntent: 'MAINTENANCE', expectedLevel: 'none', expectedBlocking: [] },

  // --- Normal feature (5) — expect NEW_FEATURE, level 'full' ---
  { bucket: 'normal_feature', text: 'Quiero añadir clientes VIP.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: ['VIP'], note: 'phase brief\'s own critical-pair example, carried forward from Phase 04' },
  { bucket: 'normal_feature', text: 'Quiero añadir reservas.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: [], note: 'phase brief\'s own example #3' },
  { bucket: 'normal_feature', text: 'Necesitamos implementar un sistema de notificaciones por email.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: [] },
  { bucket: 'normal_feature', text: 'Quiero construir un flujo de checkout para el carrito.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: [] },
  { bucket: 'normal_feature', text: 'Quiero crear un panel de administración.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: [] },

  // --- Evolution (5) — expect EVOLUTION, level 'full' ---
  { bucket: 'evolution', text: 'Quiero permitir cancelar reservas.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedBlocking: [], note: 'phase brief\'s own example #4' },
  { bucket: 'evolution', text: 'Quiero cambiar cómo funcionan los clientes VIP.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedBlocking: ['VIP'], note: 'phase brief\'s own critical-pair example' },
  { bucket: 'evolution', text: 'Quiero ampliar el sistema de descuentos para incluir cupones combinables.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedBlocking: [] },
  { bucket: 'evolution', text: 'Necesitamos que el checkout también acepte pagos con criptomonedas.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedBlocking: [] },
  { bucket: 'evolution', text: 'Quiero extender el sistema de notificaciones para incluir SMS.', expectedIntent: 'EVOLUTION', expectedLevel: 'full', expectedBlocking: [] },

  // --- Exploratory ideas (5) — expect EXPLORE (or hedged-AMBIGUOUS), level 'light' ---
  { bucket: 'exploratory', text: 'Creo que deberíamos tener un programa de fidelización.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'light', expectedBlocking: ['programa de fidelización', 'Comportamiento deseado'], note: 'phase brief\'s own example #5 — Intent Router finds no signal at all (AMBIGUOUS), but Product Reasoning recognizes hedging language and reasons at light level anyway; see phase doc §7' },
  { bucket: 'exploratory', text: '¿Qué opciones tenemos para fidelizar a los clientes frecuentes?', expectedIntent: 'EXPLORE', expectedLevel: 'light', expectedBlocking: ['clientes frecuentes'] },
  { bucket: 'exploratory', text: '¿Vale la pena evaluar un programa de fidelización?', expectedIntent: 'EXPLORE', expectedLevel: 'light', expectedBlocking: ['programa de fidelización'] },
  { bucket: 'exploratory', text: '¿Qué pasaría si ofreciéramos envío gratis a los clientes frecuentes?', expectedIntent: 'EXPLORE', expectedLevel: 'light', expectedBlocking: ['clientes frecuentes'] },
  { bucket: 'exploratory', text: 'Quiero comparar enfoques para retener clientes antes de decidir nada.', expectedIntent: 'EXPLORE', expectedLevel: 'light', expectedBlocking: [] },

  // --- Ambiguous requests (5) — expect AMBIGUOUS, level 'none' ---
  { bucket: 'ambiguous', text: 'Algo pasa con las reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [], note: 'no signal at all — carried from Phase 04\'s own dataset' },
  { bucket: 'ambiguous', text: 'Mejora el sistema de pagos.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'ambiguous', text: 'Arregla las reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'ambiguous', text: 'Quiero mejorar el rendimiento del checkout.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [] },
  { bucket: 'ambiguous', text: '¿Deberíamos considerar añadir un sistema de referidos?', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [], note: 'a genuine tie between EXPLORE and NEW_FEATURE cues, not a "no signal" case — Product Reasoning correctly declines to proceed either way, deferring entirely to the Intent Router\'s own either/or question' },

  // --- Insufficient product information (5) — clear intent, thin specifics ---
  { bucket: 'insufficient_info', text: 'Quiero implementar beneficios especiales para clientes premium.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: ['premium'] },
  { bucket: 'insufficient_info', text: 'Quiero añadir un programa de puntos para clientes recurrentes.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: ['clientes recurrentes'], note: '"programa de puntos" is itself just as undefined as "clientes recurrentes" but is not in the narrow NAMED_CATEGORY_TERMS list — a real, acknowledged recall gap, not silently patched to make this item look cleaner (see phase doc §6)' },
  { bucket: 'insufficient_info', text: 'Quiero implementar un sistema de invitaciones para clientes VIP.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: ['VIP'] },
  { bucket: 'insufficient_info', text: 'Quiero crear un programa de fidelización con beneficios para clientes premium.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: ['premium', 'programa de fidelización'], note: 'two independent undefined categories in one request — both should surface' },
  { bucket: 'insufficient_info', text: 'Quiero añadir un programa de puntos.', expectedIntent: 'NEW_FEATURE', expectedLevel: 'full', expectedBlocking: [], expectedFinding: 'miss', note: 'DELIBERATE MISS: this is obviously under-specified in reality (what earns points? what are they worth?) but "puntos"/"programa de puntos" is not in NAMED_CATEGORY_TERMS, so zero unknowns are detected — kept in the dataset specifically to document this limitation honestly rather than hide it (phase doc §6, §7)' },

  // --- Bonus: BUG escalation and cross-phase findings (5) ---
  { bucket: 'bonus', text: 'Los clientes están recibiendo descuentos incorrectos.', expectedIntent: 'BUG', expectedLevel: 'none', expectedBlocking: [], note: 'phase brief\'s own example #6 — does NOT literally say "VIP", so the category-without-definition heuristic correctly does not fire on this exact sentence; a real coreference limitation (no cross-sentence context), documented rather than hidden' },
  { bucket: 'bonus', text: 'El checkout falla cuando el carrito tiene más de 10 productos.', expectedIntent: 'BUG', expectedLevel: 'none', expectedBlocking: [], note: 'clean technical bug, correct contrast case to the item above' },
  { bucket: 'bonus', text: 'Quiero eliminar el programa de fidelización actual.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [], note: 'real Phase 04 gap: "eliminar" (remove) has no rule coverage at all — a removal-type request is invisible to the current Intent Router' },
  { bucket: 'bonus', text: 'Quiero que los clientes VIP tengan un descuento del 10%.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [], note: 'the flagship NEW_FEATURE-vs-EVOLUTION ambiguity case carried forward from Phase 04 — still correctly unresolved, still correctly deferred rather than guessed' },
  { bucket: 'bonus', text: 'Quiero que los usuarios puedan compartir sus reservas.', expectedIntent: 'AMBIGUOUS', expectedLevel: 'none', expectedBlocking: [], note: 'phase brief\'s own example #8, preserved verbatim — a real Phase 04 gap: "poder" (can/allow) conjugations aren\'t covered by any EVOLUTION rule, so this scores no signal at all despite reading unambiguously as EVOLUTION to a human' },
];
