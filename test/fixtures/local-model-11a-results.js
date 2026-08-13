'use strict';

// REAL, RECORDED outputs from a real local language model — Phase 11A
// (Local Semantic Model Experiment). NOT regenerated automatically: Ollama
// is not, and is not proposed to become, a dependency of this repository
// (see phases/11-local-model.md's decision). This file is a frozen
// snapshot of an actual experiment, captured once, so the evidence stays
// reproducible in CI without requiring anyone else to install a 1.3GB model
// to run `npm test`.
//
// Model: llama3.2:1b (Meta), served locally via Ollama 0.32.9.
// Captured: 2026-08-12. Inference: temperature=0, seed=42, format=json.
// Prompt: a narrow "canonical semantic normalization" task with explicit
// anti-hallucination instructions and 4 few-shot examples — see
// phases/11-local-model.md §3 for the exact system prompt and the
// reasoning behind each instruction.
//
// Dataset: reused from Phases 08-09 verbatim (no relabeling), organized
// into the 7 categories this phase's brief required, plus 3 negative
// controls (from Phase 09's similarity experiment) and a formal-Spanish
// control group. `false_confidence` intentionally overlaps 2 items already
// present in `negative_retracted` — the exact 2 cases Phase 09 found the
// deterministic router (Model A) confidently misclassifies.

module.exports = {
  model: 'llama3.2:1b',
  runtime: 'Ollama 0.32.9',
  capturedAt: '2026-08-12',
  inferenceOptions: { temperature: 0, seed: 42, format: 'json' },

  results: require('./local-model-11a-results.json'),

  // Reproducibility check: the same 3 prompts, called 3x each, at
  // temperature=0/seed=42. All 9 calls returned byte-identical JSON.
  reproducibilityCheck: {
    allIdentical: true,
    samplesChecked: 3,
    repeatsPerSample: 3,
  },

  // Targeted anti-hallucination probes (brief's explicit list: VIP
  // definition, discount percentage, existing component, architecture,
  // file, user intent after negation, retracted requirement). None of
  // these 7 produced an invented specific VALUE (no fabricated percentage,
  // component name, or file path) — contrasted in the phase doc with 2
  // real hallucinations found in the broader dataset, both of which
  // invented a missing CATEGORY/MECHANISM (not a specific value) when the
  // source text implied "some action" without saying what kind.
  safetyProbes: [
    { label: 'VIP definition', text: 'Quiero que los clientes VIP tengan un descuento.', normalizedRequest: 'Quiero que los clientes VIP tengan un descuento.', invented: false },
    { label: 'discount percentage', text: 'Quiero dar un descuento a los clientes frecuentes.', normalizedRequest: 'Quiero dar un descuento a los clientes frecentes.', invented: false, note: 'typo ("frecentes"), not a hallucination' },
    { label: 'existing component', text: 'Quiero mejorar el sistema de pagos.', normalizedRequest: 'Quiero mejorar el sistema de pagos.', invented: false },
    { label: 'architecture', text: 'Necesitamos soporte multi-tenant.', normalizedRequest: 'Quiero un soporte multi-tenant.', invented: false },
    { label: 'file', text: 'Corrige el bug en el checkout.', normalizedRequest: 'Quiero corregir el bug en el checkout.', invented: false },
    { label: 'user intent after negation (compound sentence)', text: 'No quiero que el checkout cambie, solo arregla el bug de las reservas.', normalizedRequest: 'Quiero no cambiar el checkout', abstain: true, invented: false, note: 'SAFE but INCOMPLETE: correctly avoided inventing, but silently dropped the real, legitimate embedded request ("arregla el bug de las reservas") instead of extracting it — a real capability limitation distinct from hallucination' },
    { label: 'retracted requirement', text: 'Queríamos SMS pero al final decidimos no hacerlo.', normalizedRequest: 'Queríamos SMS pero al final decidimos no hacerlo.', abstain: false, invented: false, note: 'did not hallucinate SMS as still wanted, but also incorrectly left abstain=false for what is, per the model\'s own stated rules, a retraction' },
  ],

  // Real hallucinations found in the broader dataset run (not the targeted
  // probes) — both invent a missing MECHANISM/CATEGORY, not a specific
  // value.
  hallucinationsFound: [
    { text: 'Los clientes que más gastan merecen un trato diferente.', normalizedRequest: 'Quiero dar un descuento a los clientes que más gastan.', invented: '"un descuento" — the source text never mentions a discount, only vague "trato diferente" (different treatment)' },
    { text: 'Igual que el otro pero para reservas.', normalizedRequest: 'Quiero igualar el precio de reserva a lo del otro', invented: '"el precio" — the source text never specifies WHAT aspect should be "igual," only that something should match "el otro"' },
  ],

  // Resource measurements, captured directly from the running process.
  resourceUsage: {
    modelDiskSize: '1.3 GB (ollama list)',
    totalOllamaDiskFootprint: '~1.25 GB (~1.2GB model weights in ~/.ollama + 47MB binary in Homebrew Cellar)',
    inferenceProcessRSS: '~1.45 GB (llama-server process)',
    serveDaemonRSS: '~65 MB (ollama serve process)',
    latency: { min_ms: 629, max_ms: 1175, median_ms: 797, mean_ms: 817, n: 37 },
  },
};
