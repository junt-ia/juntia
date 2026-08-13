'use strict';

// Evaluation dataset for the intent router (Phase 04). 48 requests: 5 each
// for the 6 categories the phase brief required (UNDERSTAND, EXPLORE,
// NEW_FEATURE, EVOLUTION, BUG, REFACTOR), 4 each for the 3 remaining core
// intents (MAINTENANCE, ARCHITECTURE, VALIDATION), and 6 deliberately hard
// cases including the exact examples the phase brief itself used.
//
// Methodological caveat, stated honestly (see phase doc §7): the same
// author designed both the router's rules and this dataset, which is a
// real risk of unconscious overfitting. Mitigated by phrasing items with
// vocabulary broader than the rule patterns' exact trigger words, and by
// including cases expected to fail or land as AMBIGUOUS rather than tuning
// every item to pass.
//
// `expected`: a single intent string, or an array when more than one
// reading is genuinely defensible, or 'AMBIGUOUS' when the request itself
// is too underdetermined to classify from text alone.

module.exports = [
  // UNDERSTAND (5)
  { text: '¿Qué hace la función calculateTotal?', expected: 'UNDERSTAND', note: 'comprehension question about existing code' },
  { text: 'No entiendo cómo funciona el sistema de reservas.', expected: 'UNDERSTAND' },
  { text: 'Explícame por qué el descuento se aplica antes de los impuestos.', expected: 'UNDERSTAND' },
  { text: '¿Cómo funciona la sincronización de .claude/ cuando hay dos proyectos?', expected: 'UNDERSTAND' },
  { text: '¿Qué es exactamente un cliente VIP en este sistema?', expected: 'UNDERSTAND' },

  // EXPLORE (5)
  { text: '¿Deberíamos considerar usar una cola de mensajes para las notificaciones?', expected: 'EXPLORE' },
  { text: '¿Qué opciones tenemos para manejar los pagos recurrentes?', expected: 'EXPLORE' },
  { text: '¿Qué pasaría si moviéramos la autenticación a un servicio externo?', expected: 'EXPLORE' },
  { text: 'Quiero comparar enfoques para el sistema de caché antes de decidir nada.', expected: 'EXPLORE' },
  { text: '¿Vale la pena evaluar GraphQL para este proyecto?', expected: 'EXPLORE' },

  // NEW_FEATURE (5) — #1 is the phase brief's own example
  { text: 'Quiero añadir clientes VIP.', expected: 'NEW_FEATURE', note: 'phase brief critical-pair #1' },
  { text: 'Necesitamos crear un sistema de reservas desde cero.', expected: 'NEW_FEATURE' },
  { text: 'Quiero implementar notificaciones por email cuando se confirma una reserva.', expected: 'NEW_FEATURE' },
  { text: 'Agreguemos un panel de administración para gestionar productos.', expected: 'NEW_FEATURE' },
  { text: 'Quiero construir un flujo de checkout para el carrito.', expected: 'NEW_FEATURE' },

  // EVOLUTION (5) — #1 and #2 are the phase brief's own examples
  { text: 'Quiero que las reservas permitan cancelar.', expected: 'EVOLUTION', note: 'phase brief EVOLUTION example' },
  { text: 'Quiero cambiar cómo funcionan los clientes VIP.', expected: 'EVOLUTION', note: 'phase brief critical-pair #2' },
  { text: 'Necesitamos que el checkout también acepte pagos con criptomonedas.', expected: 'EVOLUTION' },
  { text: 'Quiero ampliar el sistema de descuentos para incluir cupones combinables.', expected: 'EVOLUTION' },
  { text: 'Además del email, quiero que las confirmaciones también lleguen por SMS.', expected: 'EVOLUTION' },

  // BUG (5) — #1 is the phase brief's own example
  { text: 'Los clientes VIP no reciben el descuento.', expected: 'BUG', note: 'phase brief critical-pair #3' },
  { text: 'Las reservas desaparecen después de reiniciar el servidor.', expected: 'BUG' },
  { text: 'El checkout falla cuando el carrito tiene más de 10 productos.', expected: 'BUG' },
  { text: 'El total se calcula mal cuando hay un cupón aplicado.', expected: 'BUG' },
  { text: 'Los emails de confirmación no se están enviando desde ayer.', expected: 'BUG' },

  // REFACTOR (5) — #1 is the phase brief's own example
  { text: 'Quiero reorganizar el código de clientes VIP.', expected: 'REFACTOR', note: 'phase brief critical-pair #4' },
  { text: 'Quiero extraer ReservationService del controlador.', expected: 'REFACTOR' },
  { text: 'Necesitamos renombrar las variables del módulo de pagos, son confusas.', expected: 'REFACTOR' },
  { text: 'Quiero limpiar el código del checkout sin cambiar el comportamiento.', expected: 'REFACTOR' },
  { text: 'Vamos a mover la lógica de descuentos a un módulo separado.', expected: 'REFACTOR' },

  // MAINTENANCE (4)
  { text: 'Actualiza la dependencia de Stripe a la última versión menor.', expected: 'MAINTENANCE' },
  { text: "Hay un typo en el README, dice 'reservacion' en vez de 'reserva'.", expected: 'MAINTENANCE' },
  { text: 'Arregla el warning de lint en el archivo de checkout.', expected: 'MAINTENANCE' },
  { text: 'Actualiza el changelog con los cambios de esta semana.', expected: 'MAINTENANCE' },

  // ARCHITECTURE (4)
  { text: '¿Deberíamos migrar de PostgreSQL a un almacenamiento distribuido?', expected: 'ARCHITECTURE' },
  { text: '¿Qué base de datos deberíamos usar para el catálogo de productos?', expected: 'ARCHITECTURE' },
  { text: 'Necesitamos decidir la arquitectura para soportar múltiples inquilinos (multi-tenant).', expected: 'ARCHITECTURE' },
  { text: '¿Deberíamos reemplazar el mecanismo de colas actual antes de escalar?', expected: 'ARCHITECTURE' },

  // VALIDATION (4)
  { text: 'Verifica que el flujo de checkout funciona con el nuevo método de pago.', expected: 'VALIDATION' },
  { text: 'Revisa el PR de las reservas antes de que lo mergeemos.', expected: 'VALIDATION' },
  { text: 'Comprueba que los clientes VIP reciben el descuento correctamente tras el fix.', expected: 'VALIDATION', note: 'contains "reciben el descuento" (echoes the BUG example) but leads with explicit checking language' },
  { text: 'Haz QA del flujo de cancelación de reservas.', expected: 'VALIDATION' },

  // Deliberately hard / ambiguous (6)
  {
    text: 'Quiero que los clientes VIP tengan un descuento del 10%.',
    expected: ['NEW_FEATURE', 'EVOLUTION', 'AMBIGUOUS'],
    note: 'the phase brief\'s OWN example input for the router\'s contract — genuinely underdetermined from text alone: is "VIP discount" a new capability, or a change to an existing VIP tier\'s behavior? Flagship ambiguity case, not a rule failure.',
  },
  { text: 'Algo pasa con las reservas.', expected: 'AMBIGUOUS', note: 'too vague, no distinguishing signal at all' },
  {
    text: 'Mejora el sistema de pagos.',
    expected: ['EVOLUTION', 'REFACTOR', 'ARCHITECTURE', 'AMBIGUOUS'],
    note: '"mejora" (improve) alone doesn\'t say whether behavior, structure, or foundational design should change',
  },
  {
    text: 'Cambia el color del botón de reservar.',
    expected: ['MAINTENANCE', 'EVOLUTION', 'AMBIGUOUS'],
    note: 'trivial UI tweak — arguably MAINTENANCE (tiny) or EVOLUTION (a behavior/appearance change), reasonable boundary case',
  },
  {
    text: 'Arregla las reservas.',
    expected: ['BUG', 'AMBIGUOUS'],
    note: '"arreglar" can mean fix-a-bug or colloquially tidy-up, with no deviation language to disambiguate',
  },
  {
    text: 'Quiero mejorar el rendimiento del checkout.',
    expected: ['REFACTOR', 'EVOLUTION', 'AMBIGUOUS'],
    note: 'performance work is arguably structure-only (REFACTOR) or a behavior change (EVOLUTION) depending on how "mejorar" is read',
  },
];
