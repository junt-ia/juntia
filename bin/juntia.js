#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');
const {
  factsFromScanResult, loadFacts, saveFacts, compareFacts,
} = require('../lib/project-intelligence/facts-store.js');
const { interpretationId, loadPending, upsertPending, removePending } = require('../lib/project-intelligence/pending-store.js');
const {
  loadDecisions, recordDecision, detectConflicts, markConflicted, appendDecisionNarrative,
} = require('../lib/project-intelligence/decisions-store.js');
const { generateContext, writeContext } = require('../lib/project-intelligence/context-generator.js');
const {
  integrateRuntime, RUNTIME_PROFILES, PLANNED_PROVIDERS, readRuntimeProvider, withRuntimeProvider,
} = require('../lib/project-intelligence/agent-integration.js');
const { resolveProvider } = require('../lib/runtime/provider-registry.js');

const PACKAGE_ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');

function pkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

// Files `init` scaffolds into <project>/.juntia/, copied verbatim from
// templates/ — never overwritten if already present, so a second `init` run
// is always safe and never clobbers real project content.
const SCAFFOLD_FILES = [
  'config.yml',
  'PROJECT_STATE.md',
  'DECISIONS.md',
  'RULES.md',
  'ARCHITECTURE.md',
  path.join('roles', 'product.md'),
  path.join('roles', 'architect.md'),
  path.join('roles', 'engineer.md'),
  path.join('roles', 'qa.md'),
];

// Pure filesystem scaffolding: no code is read or analyzed, no network call
// is made, nothing outside <projectRoot>/.juntia/ is touched. Deliberately
// this narrow per Phase 12A.5/12B's own "first command must be safe and
// reversible" constraint.
function init(projectRoot) {
  const juntiaDir = path.join(projectRoot, '.juntia');
  const created = [];
  const skipped = [];
  for (const relativePath of SCAFFOLD_FILES) {
    const dest = path.join(juntiaDir, relativePath);
    if (fs.existsSync(dest)) {
      skipped.push(relativePath);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(TEMPLATES_DIR, relativePath), dest);
    created.push(relativePath);
  }
  return { juntiaDir, created, skipped };
}

function runInit(projectRoot = process.cwd()) {
  const { juntiaDir, created, skipped } = init(projectRoot);
  if (created.length === 0 && skipped.length > 0) {
    console.log(`.juntia/ already exists at ${juntiaDir} — nothing to do.`);
    console.log(`(${skipped.length} file(s) already present, none overwritten.)`);
    return;
  }
  console.log(`Created .juntia/ at ${juntiaDir}`);
  for (const file of created) console.log(`  + ${file}`);
  if (skipped.length > 0) {
    console.log('Already present, left unchanged:');
    for (const file of skipped) console.log(`  = ${file}`);
  }
  console.log('');
  console.log('Nothing was read, analyzed, or sent anywhere — this only scaffolds local files.');
}

// Formats scanProject()'s real output as a plain inventory listing — no
// interpretation added here either; this only decides how to print facts
// the scanner already found.
function formatAnalysis(result) {
  const lines = ['Analyzing project...', '', 'Detected:', ''];

  if (result.identity.languages.length > 0) {
    lines.push('Languages:');
    for (const lang of result.identity.languages) lines.push(`  ✓ ${lang.name}`);
    lines.push('');
  }
  if (result.identity.technologies.length > 0) {
    lines.push('Technologies:');
    for (const tech of result.identity.technologies) lines.push(`  ✓ ${tech.name}`);
    lines.push('');
  }
  if (result.dependencies.length > 0) {
    lines.push('Dependencies:');
    for (const dep of result.dependencies) lines.push(`  ✓ ${dep.name}`);
    lines.push('');
  }
  if (result.structure.directories.length > 0) {
    lines.push('Structure:');
    for (const dir of result.structure.directories) lines.push(`  ✓ ${dir}/`);
    lines.push('');
  }

  const nothingFound = result.identity.languages.length === 0
    && result.dependencies.length === 0
    && result.manifests.length === 0;
  if (nothingFound) {
    lines.push('Nothing recognized in this directory (UNKNOWN) — no manifest, language, or config file matched.');
    lines.push('');
  }

  lines.push('This is a mechanical inventory only: no AI was used, and no project type was guessed.');
  return lines.join('\n');
}

// Formats a compareFacts() diff as a plain, fact-level change report — never
// an interpretation of what a change means (Phase 12H/12I's own boundary:
// "dependency phaser removed" is reportable, "the project stopped being a
// game" is not, and this function has no way to produce the latter since it
// only ever prints category/name/value fields compareFacts() itself
// computed).
function formatChanges({ added, removed, changed }) {
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return 'No changes detected since the last analyze.';
  }
  const lines = ['Changes detected:', ''];
  if (added.length > 0) {
    lines.push('Added:');
    for (const fact of added) lines.push(`  + ${fact.category}: ${fact.name}`);
    lines.push('');
  }
  if (removed.length > 0) {
    lines.push('Removed:');
    for (const fact of removed) lines.push(`  - ${fact.category}: ${fact.name}`);
    lines.push('');
  }
  if (changed.length > 0) {
    lines.push('Changed:');
    for (const c of changed) lines.push(`  ~ ${c.category}: ${c.name} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Prints a runtime interpretation (Phase 12J) to the console only — never
// written to a file. This is Option A of the two output surfaces the phase
// evaluated (the other, `.juntia/pending.json`, was deliberately not built
// this phase; see phases/12j-context-synthesis-runtime-evaluation.md). An
// interpretation is never mistaken for a fact: every line here is
// explicitly labeled and clearly separated from `formatAnalysis()`'s own
// output above it.
function formatInterpretation(synthesis) {
  if (!synthesis.ok) {
    return [
      'AI interpretation: not available.',
      formatRuntimeFailure(synthesis),
      'No file was written and no interpretation was recorded — nothing here is a fact or a decision.',
    ].join('\n');
  }
  const { interpretation, confidence, basedOn, unknowns } = synthesis.result;
  const lines = [
    'AI interpretation (not a fact, not saved, not a decision — for you to confirm or discard):',
    '',
    `  ${interpretation}`,
    `  confidence: ${confidence}`,
    `  based on: ${basedOn.join(', ')}`,
  ];
  if (unknowns.length > 0) {
    lines.push('  unknowns:');
    for (const u of unknowns) lines.push(`    - ${u.topic}: ${u.reason}`);
  }
  return lines.join('\n');
}

// scan -> facts -> persist -> compare -> report, per this phase's own design.
// First run: no previous baseline, creates one. Later runs: compares against
// the previous baseline, reports the diff, then updates the baseline for
// next time. A corrupt or schema-incompatible facts.json is reported as
// UNKNOWN and treated as a fresh baseline — never guessed at, never crashes.
// The only file this writes is .juntia/facts.json (and, once, .juntia/.gitignore)
// — verified by test (test/facts-store.test.js, test/cli-analyze.test.js).
// `--explain` (Phase 12J) never adds a file write: it only decides whether
// an extra, clearly-labeled console section is printed after the same
// facts this command already computed. Without it, behavior is byte-for-
// byte identical to before Phase 12J — a real runtime call/cost only ever
// happens when explicitly requested.
// Returns the runtime synthesis result when `explain` was requested
// (undefined otherwise) — mainly so tests can await completion and inspect
// what happened, without needing to spy on console.log.
async function runAnalyze(projectRoot = process.cwd(), { explain = false, adapter = null, adapterOptions } = {}) {
  const result = scanProject(projectRoot);
  console.log(formatAnalysis(result));
  console.log('');

  const facts = factsFromScanResult(result);
  const previous = loadFacts(projectRoot);

  let diff = { added: [], removed: [], changed: [] };
  if (!previous.exists) {
    saveFacts(projectRoot, facts);
    console.log(`Created a factual baseline at .juntia/facts.json (${facts.length} facts). Run analyze again later to see what changed.`);
  } else if (previous.unknown) {
    console.log(`Previous .juntia/facts.json could not be used (${previous.reason}) — treating this as a fresh baseline.`);
    saveFacts(projectRoot, facts);
  } else {
    diff = compareFacts(previous.document.facts, facts);
    console.log(formatChanges(diff));
    saveFacts(projectRoot, facts);
  }

  // Conflict check — deterministic, runs on every analyze regardless of
  // --explain (no AI involved): does any ACTIVE decision cite a fact this
  // fresh scan no longer found? Never deletes or rewrites the decision
  // (Phase 12K's own explicit requirement) — only flags it 'conflicted' and
  // reports it once, here, when the conflict first appears. `juntia
  // context`'s own "Conflicts needing review" section is the persistent,
  // always-current view of every outstanding conflict.
  const { decisions: existingDecisions } = loadDecisions(projectRoot);
  const conflicts = detectConflicts(facts, existingDecisions);
  if (conflicts.length > 0) {
    markConflicted(projectRoot, conflicts);
    console.log('');
    console.log('Decisions needing review (evidence they were based on no longer exists — not deleted):');
    for (const c of conflicts) console.log(`  ! "${c.decision.text}" — missing: ${c.missingFacts.join(', ')}`);
  }

  if (!explain) return undefined;

  console.log('');

  // Phase 13B: never guess which runtime to call. An injected `adapter`
  // (tests, or a future programmatic caller) always wins; otherwise the
  // configured provider is resolved for real from .juntia/config.yml — and
  // if nothing resolves, this returns early with a plain, actionable
  // message instead of silently defaulting to the Claude CLI adapter the
  // way every phase before this one did.
  let runtimeAdapter = adapter;
  if (!runtimeAdapter) {
    const resolved = resolveConfiguredAdapter(projectRoot);
    if (!resolved.ok) {
      console.log(formatUnresolvedRuntime(resolved));
      return undefined;
    }
    runtimeAdapter = resolved.adapter;
  }

  const { synthesizeContext } = require('../lib/project-intelligence/context-synthesis-bridge.js');
  const synthesis = await synthesizeContext(facts, diff, { adapter: runtimeAdapter, adapterOptions, decisions: existingDecisions });
  console.log(formatInterpretation(synthesis));

  if (synthesis.ok) {
    const id = interpretationId(synthesis.result.basedOn);
    const alreadyDecided = existingDecisions.find((d) => d.id === id);
    console.log('');
    if (alreadyDecided) {
      console.log(`This matches an already-confirmed decision: "${alreadyDecided.text}" (confirmed ${alreadyDecided.confirmedAt.slice(0, 10)}) — nothing new to confirm.`);
    } else {
      const pendingId = upsertPending(projectRoot, synthesis.result);
      console.log(`Saved as a pending interpretation (id: ${pendingId}) — run \`juntia confirm\` to confirm or reject it.`);
    }
  }

  return synthesis;
}

// Real, interactive confirmation of one pending interpretation at a time —
// the only code path in this codebase that writes to `.juntia/decisions.json`,
// and it only runs after a real human answers a real question. `prompt` is
// injectable (defaults to a real `readline/promises` prompt over
// stdin/stdout) so tests can drive it without touching a real terminal —
// same dependency-injection pattern `runAnalyze` already uses for the
// runtime adapter.
async function defaultPrompt(question) {
  const readline = require('readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function runConfirm(projectRoot = process.cwd(), { prompt = defaultPrompt } = {}) {
  const pending = loadPending(projectRoot);
  if (pending.unknown) {
    console.log(`.juntia/pending.json could not be used (${pending.reason}) — nothing to confirm.`);
    return { confirmed: [], rejected: [], stale: [] };
  }
  if (pending.items.length === 0) {
    console.log('No pending interpretations to confirm.');
    return { confirmed: [], rejected: [], stale: [] };
  }

  const factsDoc = loadFacts(projectRoot);
  const facts = (factsDoc.exists && !factsDoc.unknown) ? factsDoc.document.facts : [];
  const factKeys = new Set(facts.map((f) => `${f.category}:${f.name}`));

  const confirmed = [];
  const rejected = [];
  const stale = [];

  for (const item of pending.items) {
    // Re-validated against the CURRENT facts, not just trusted from when the
    // interpretation was first generated — facts can change between an
    // `analyze --explain` and a later `confirm`. A pending item grounded in
    // a fact that no longer exists is not asked about; it is dropped with an
    // explanation, since confirming it would create a decision whose own
    // cited evidence is already gone.
    const missing = item.basedOn.filter((b) => !factKeys.has(b));
    if (missing.length > 0) {
      console.log('');
      console.log(`Skipping "${item.interpretation}" — based on evidence that no longer exists (${missing.join(', ')}).`);
      console.log('Run `juntia analyze --explain` again for a fresh interpretation.');
      removePending(projectRoot, item.id);
      stale.push(item.id);
      continue;
    }

    console.log('');
    console.log(`"${item.interpretation}"`);
    console.log(`  confidence: ${item.confidence}`);
    console.log(`  based on: ${item.basedOn.join(', ')}`);
    // eslint-disable-next-line no-await-in-loop
    const answer = (await prompt('Confirm this as a decision? [y/n] ')).trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      const decision = recordDecision(projectRoot, item);
      appendDecisionNarrative(projectRoot, decision);
      removePending(projectRoot, item.id);
      confirmed.push(decision.id);
      console.log('  Recorded as a decision.');
    } else if (answer === 'n' || answer === 'no') {
      removePending(projectRoot, item.id);
      rejected.push(item.id);
      console.log('  Rejected — discarded.');
    } else {
      console.log('  Skipped for now — still pending, ask again later with `juntia confirm`.');
    }
  }

  const { decisions } = loadDecisions(projectRoot);
  writeContext(projectRoot, generateContext(facts, decisions));
  console.log('');
  console.log('Updated .juntia/context.md.');

  return { confirmed, rejected, stale };
}

// Deterministic, no AI: reassembles .juntia/context.md from whatever facts
// and decisions currently exist. Safe to run any time, including with zero
// facts or zero decisions yet — never fabricates a section it has no real
// content for (see lib/project-intelligence/context-generator.js).
function runContext(projectRoot = process.cwd()) {
  const factsDoc = loadFacts(projectRoot);
  const facts = (factsDoc.exists && !factsDoc.unknown) ? factsDoc.document.facts : [];
  const { decisions } = loadDecisions(projectRoot);
  const markdown = generateContext(facts, decisions);
  writeContext(projectRoot, markdown);
  console.log(markdown);
  console.log('Written to .juntia/context.md.');
  return markdown;
}

// Generates (or refreshes) a runtime-specific pointer file at the
// conventional path that runtime already reads on its own — never a copy
// of context.md's content, never a second source of truth (see
// lib/project-intelligence/agent-integration.js). `init()` runs first,
// idempotently, so `.juntia/config.yml` exists to record the integration
// even on a project that never explicitly ran `juntia init`.
// `silent` (Phase 13A) lets `runSetup()` reuse this exact function — same
// safety checks, same file writes, zero duplicated logic — while printing
// its own, setup-appropriate summary line instead of this command's normal
// standalone output. Default (false) preserves `juntia integrate`'s own
// behavior byte-for-byte.
function runIntegrate(runtimeName, projectRoot = process.cwd(), { silent = false } = {}) {
  const log = silent ? () => {} : (...args) => console.log(...args);

  if (!runtimeName) {
    log(`Usage: juntia integrate <runtime> — supported: ${Object.keys(RUNTIME_PROFILES).join(', ')}`);
    return { ok: false, reason: 'no runtime specified' };
  }

  init(projectRoot);
  const result = integrateRuntime(projectRoot, runtimeName);

  if (!result.ok) {
    log(`Could not integrate: ${result.reason}`);
    return result;
  }

  log(`Created/updated ${result.file}${result.configUpdated ? ' and .juntia/config.yml' : ''}.`);
  log(`${result.file} points to .juntia/context.md — nothing was copied, nothing was sent anywhere.`);
  log(`Safe to delete and regenerate any time with \`juntia integrate ${runtimeName}\`; never hand-edit it.`);
  return result;
}

// --- Setup Orchestrator (Phase 13A) -----------------------------------------
//
// `juntia setup` is the recommended entrypoint for a new user — one command
// that coordinates every existing capability above (init/analyze/explain/
// confirm/context/integrate) into a single, plain-language flow, so a
// developer never needs to learn what a "fact," "interpretation,"
// "decision," or "integration" is just to get started. Those concepts keep
// existing and stay real — `juntia analyze`/`confirm`/`context`/`integrate`
// remain available as advanced, individually-scriptable commands (nothing
// here removes or hides them) — `setup` only adds a coordinating layer on
// top, per this phase's own explicit "no duplicar lógica, solo coordinar."
// Every step below calls the same functions defined earlier in this file or
// in lib/, unmodified in behavior; this function owns only sequencing and
// its own, deliberately shorter, onboarding-appropriate console output.

function configPath(projectRoot) {
  return path.join(projectRoot, '.juntia', 'config.yml');
}

function readConfigText(projectRoot) {
  const p = configPath(projectRoot);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// A short, flat "what was found" list — deliberately less detailed than
// `formatAnalysis()`'s own category-by-category breakdown (dependencies/
// structure/manifests), which stays available via plain `juntia analyze`
// for anyone who wants the full detail. Onboarding wants a quick, legible
// summary, not a technical report.
function formatSetupDetected(result) {
  const names = [
    ...result.identity.languages.map((l) => l.name),
    ...result.identity.technologies.map((t) => t.name),
  ];
  if (names.length === 0) return 'Nothing recognized in this directory yet.';
  return ['Detected:', '', ...names.map((n) => `✓ ${n}`)].join('\n');
}

// Translates a real adapter failure into a plain, actionable sentence
// instead of the raw error a spawned process can produce (this migration's
// own explicit example: never surface a bare "spawn claude ENOENT"). Only
// covers the failure shapes `lib/runtime/claude-cli-adapter.js` actually
// produces — never invents a friendlier story than what really happened.
// Shared by `formatInterpretation()` (plain `analyze --explain`) and
// `runSetup()` — one real failure, one real translation, used everywhere
// a runtime failure can surface (Phase 13B generalized this from a
// setup-only helper once `analyze --explain` also needed it).
function formatRuntimeFailure(synthesis) {
  const reason = synthesis.reason || '';
  if (reason.includes('binary_not_found')) {
    return 'Claude Code is configured but unavailable. Install Claude Code or choose another assistant.';
  }
  if (reason.includes('timeout')) {
    return 'Claude Code took too long to respond, so the interpretation step was skipped this time.';
  }
  if (reason.includes('failed validation')) {
    return 'Claude Code responded, but its answer could not be trusted as-is, so it was discarded.';
  }
  return `AI interpretation skipped (${reason}).`;
}

// Reads .juntia/config.yml's `runtime.provider`, resolves it to a real
// adapter via lib/runtime/provider-registry.js, and never guesses when it
// can't (Phase 13B's own central fix — previously, every caller silently
// defaulted to the Claude CLI adapter regardless of configuration). Returns
// { ok: true, provider, adapter, label } or
// { ok: false, provider: string|null, reason }: `provider` is `null` only
// when nothing is configured at all, distinct from a real but unsupported
// value (a real, if unusable, provider name is still worth reporting back).
function resolveConfiguredAdapter(projectRoot) {
  const configText = readConfigText(projectRoot);
  const provider = configText ? readRuntimeProvider(configText) : null;
  if (!provider) {
    return { ok: false, provider: null, reason: 'no AI assistant configured yet' };
  }
  const resolved = resolveProvider(provider);
  if (!resolved.ok) {
    return { ok: false, provider, reason: resolved.reason };
  }
  return {
    ok: true, provider, adapter: resolved.adapter, label: resolved.label,
  };
}

// The plain, user-facing message for `analyze --explain` when no adapter
// was injected (a real run, not a test) and configuration resolution
// failed — either nothing is configured yet, or what's configured isn't
// something Juntia can use. Distinguishes the two rather than printing one
// generic error, per this phase's own explicit "informar claramente si
// falta configuración."
function formatUnresolvedRuntime(resolution) {
  if (!resolution.provider) {
    return 'No AI assistant configured yet — run `juntia setup` or `juntia integrate <runtime>` first, then try `analyze --explain` again.';
  }
  return `"${resolution.provider}" is configured, but ${resolution.reason}.`;
}

async function promptForAssistant(prompt) {
  console.log('Which AI assistant do you use?');
  const available = Object.entries(RUNTIME_PROFILES).map(([provider, profile], i) => ({
    key: String(i + 1), provider, label: profile.label,
  }));
  for (const choice of available) console.log(`  ${choice.key}. ${choice.label}`);
  for (const planned of PLANNED_PROVIDERS) console.log(`  -  ${planned.label} (coming soon)`);
  console.log('  0. Skip for now');
  const answer = (await prompt('> ')).trim().toLowerCase();
  if (answer === '0' || answer === '') return null;
  const match = available.find((c) => c.key === answer || c.label.toLowerCase() === answer);
  return match ? match.provider : null;
}

// setup(projectRoot, { prompt, adapter, adapterOptions }) -> Promise<{
//   initialized, provider, integrateResult
// }>
// Idempotent by construction: every step it calls (init/saveFacts/
// detectConflicts/synthesizeContext/runConfirm/writeContext/runIntegrate)
// was already idempotent before this phase — running `setup` twice re-runs
// the same safe operations and reports their real, current state, never
// duplicating a file, a decision, or a pending item.
async function runSetup(projectRoot = process.cwd(), { prompt = defaultPrompt, adapter = null, adapterOptions } = {}) {
  console.log('Welcome to Juntia.');
  console.log('');

  // 1-2: init if needed (reuses the exact same scaffolding function
  // `runInit` itself calls — never re-implemented).
  const wasInitialized = fs.existsSync(configPath(projectRoot));
  if (!wasInitialized) {
    console.log('Initializing project...');
    init(projectRoot);
    console.log('✓ Created .juntia');
  } else {
    console.log('✓ Already initialized');
  }
  console.log('');

  // 3-4: analyze -> facts (same scan/persist/diff/conflict-check primitives
  // runAnalyze() itself uses — reused directly, not re-implemented).
  console.log('Analyzing project...');
  const result = scanProject(projectRoot);
  console.log('');
  console.log(formatSetupDetected(result));
  console.log('');

  const facts = factsFromScanResult(result);
  const previous = loadFacts(projectRoot);
  const isFirstAnalyze = !previous.exists;
  let diff = { added: [], removed: [], changed: [] };
  if (previous.exists && !previous.unknown) diff = compareFacts(previous.document.facts, facts);
  saveFacts(projectRoot, facts);

  console.log('Generating project understanding...');
  console.log(isFirstAnalyze ? '✓ Facts generated' : '✓ Facts updated');
  console.log('');

  const { decisions: decisionsBeforeConfirm } = loadDecisions(projectRoot);
  const conflicts = detectConflicts(facts, decisionsBeforeConfirm);
  if (conflicts.length > 0) {
    markConflicted(projectRoot, conflicts);
    console.log('Decisions needing review (evidence they were based on no longer exists — not deleted):');
    for (const c of conflicts) console.log(`  ! "${c.decision.text}" — missing: ${c.missingFacts.join(', ')}`);
    console.log('');
  }

  // 5-6: AI interpretation + confirmation — only when a runtime was already
  // configured by a PREVIOUS `setup`/`integrate` run, checked before step 8
  // below chooses one for the first time. Deliberately never calls AI on a
  // project's very first `setup` run (no runtime is known yet at this
  // point) — matching this migration's unbroken cost principle that an AI
  // call is opt-in, never a side effect of a command whose own purpose
  // (getting started) doesn't itself imply consent to spend anything yet.
  const resolvedRuntime = resolveConfiguredAdapter(projectRoot);
  const configuredProvider = resolvedRuntime.provider;

  if (resolvedRuntime.ok) {
    const runtimeAdapter = adapter || resolvedRuntime.adapter;
    const { synthesizeContext } = require('../lib/project-intelligence/context-synthesis-bridge.js');
    const synthesis = await synthesizeContext(facts, diff, {
      adapter: runtimeAdapter, adapterOptions, decisions: decisionsBeforeConfirm,
    });

    if (synthesis.ok) {
      const id = interpretationId(synthesis.result.basedOn);
      const alreadyDecided = decisionsBeforeConfirm.find((d) => d.id === id);
      if (alreadyDecided) {
        console.log(`✓ Already reflected in a confirmed decision: "${alreadyDecided.text}"`);
        console.log('');
      } else {
        upsertPending(projectRoot, synthesis.result);
        await runConfirm(projectRoot, { prompt });
      }
    } else {
      console.log(formatRuntimeFailure(synthesis));
      console.log('');
    }
  } else if (configuredProvider) {
    console.log(`"${configuredProvider}" is configured, but ${resolvedRuntime.reason} — skipping this step.`);
    console.log('');
  }

  // 7: context — always refreshed from whatever facts/decisions exist now,
  // same generator `juntia context` itself uses.
  const { decisions: currentDecisions } = loadDecisions(projectRoot);
  writeContext(projectRoot, generateContext(facts, currentDecisions));
  console.log('✓ Context refreshed');
  console.log('');

  // 8: ask which assistant — skipped (and reported as already-configured)
  // if a previous run already recorded one; never asked twice.
  let provider = configuredProvider;
  let justSelectedProvider = false;
  if (!provider) {
    provider = await promptForAssistant(prompt);
    console.log('');
    if (provider) {
      justSelectedProvider = true;
      const configText = readConfigText(projectRoot) || '';
      fs.writeFileSync(configPath(projectRoot), withRuntimeProvider(configText, provider));
    } else {
      console.log('No assistant selected — run `juntia integrate <runtime>` any time you\'re ready.');
      console.log('');
    }
  } else {
    console.log(`✓ AI assistant already configured: ${configuredProvider}`);
    console.log('');
  }

  // 9: integrate — reuses runIntegrate() exactly (same safety checks,
  // same file protection for a real, non-Juntia CLAUDE.md), silenced so
  // setup can report its own, idempotency-aware summary line instead of
  // that command's own standalone output.
  let integrateResult = null;
  if (provider) {
    const label = RUNTIME_PROFILES[provider] ? RUNTIME_PROFILES[provider].label : provider;
    console.log(`Configuring ${label}...`);
    integrateResult = runIntegrate(provider, projectRoot, { silent: true });
    if (integrateResult.ok) {
      console.log(`✓ ${integrateResult.file} ${justSelectedProvider ? 'created' : 'already configured'}`);
      console.log('✓ Connected project context');
    } else {
      console.log(`Could not configure ${label}: ${integrateResult.reason}`);
    }
    console.log('');
  }

  // 10: done.
  console.log('Juntia is ready.');

  return { initialized: !wasInitialized, provider, integrateResult };
}

module.exports = {
  init,
  runInit,
  runAnalyze,
  runConfirm,
  runContext,
  runIntegrate,
  runSetup,
  formatAnalysis,
  formatChanges,
  formatInterpretation,
  formatSetupDetected,
  formatRuntimeFailure,
  formatUnresolvedRuntime,
  resolveConfiguredAdapter,
  pkgVersion,
  SCAFFOLD_FILES,
};

// Guarded so this file can be `require()`d by tests without triggering a
// command as a side effect (same convention as claude-toolkit's own bin/claude-toolkit.js).
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'setup') {
    runSetup(process.cwd())
      .catch((err) => { console.error(`setup failed: ${err.message}`); process.exit(1); });
  } else if (command === 'init') runInit();
  else if (command === 'analyze') {
    runAnalyze(process.cwd(), { explain: process.argv.includes('--explain') })
      .catch((err) => { console.error(`analyze failed: ${err.message}`); process.exit(1); });
  } else if (command === 'confirm') {
    runConfirm(process.cwd())
      .catch((err) => { console.error(`confirm failed: ${err.message}`); process.exit(1); });
  } else if (command === 'context') runContext(process.cwd());
  else if (command === 'integrate') runIntegrate(process.argv[3]);
  else if (command === '--version' || command === '-v') console.log(pkgVersion());
  else {
    console.error('Usage: juntia <setup|init|analyze [--explain]|confirm|context|integrate <runtime>>');
    console.error('New to Juntia? Run `juntia setup` — it walks through everything for you.');
    process.exit(1);
  }
}
