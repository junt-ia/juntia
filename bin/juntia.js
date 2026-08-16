#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { scanProject } = require('../lib/project-intelligence/scanner.js');
const {
  factsFromScanResult, loadFacts, saveFacts, compareFacts,
} = require('../lib/project-intelligence/facts-store.js');
const {
  interpretationId, loadPending, normalizePendingItems, removePending,
} = require('../lib/project-intelligence/pending-store.js');
const {
  loadDecisions, recordDecision, detectConflicts, markConflicted, appendDecisionNarrative,
} = require('../lib/project-intelligence/decisions-store.js');
const { generateContext, writeContext } = require('../lib/project-intelligence/context-generator.js');
const {
  integrateRuntime, RUNTIME_PROFILES, PLANNED_PROVIDERS, readRuntimeProvider, withRuntimeProvider,
} = require('../lib/project-intelligence/agent-integration.js');
const { HANDOFF_FILE, buildHandoffInstructions, writeHandoffInstructions } = require('../lib/project-intelligence/agent-handoff.js');
const { validateProjectInterpretation } = require('../lib/runtime/project-interpretation-validator.js');
const { validateDecisionRequest } = require('../lib/governance/decision-model.js');
const { routeWorkflow } = require('../lib/governance/workflow-router.js');
const { buildAgentContext } = require('../lib/governance/agent-context.js');
const { TASK_HANDOFF_FILE, buildTaskHandoff, writeTaskHandoff } = require('../lib/governance/task-handoff.js');
const { writeBootstrap } = require('../lib/governance/bootstrap.js');

const PACKAGE_ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');

function pkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

// Files `init` scaffolds into <project>/.juntia/, copied verbatim from
// templates/ — never overwritten if already present, so a second `init` run
// is always safe and never clobbers real project content.
//
// Phase 15B: the Knowledge Layer contract. `governance/roles/*.md` (moved
// here from the old `roles/*.md`, Phase 00-era content unchanged) sits
// alongside four new subdirectories — rules/, workflows/, skills/,
// conventions/ — whose content used to be either generated on every
// `integrate` call from a JS string builder (`agent-governance.js`, now
// removed) or not exist at all. Every file below is now real, static,
// declarative content, copied once like every other scaffold file and never
// regenerated — a project is free to edit its own copy once it exists. See
// phases/15b-knowledge-layer.md for the full audit and rationale.
const SCAFFOLD_FILES = [
  'config.yml',
  'PROJECT_STATE.md',
  'DECISIONS.md',
  'RULES.md',
  'ARCHITECTURE.md',
  path.join('governance', 'roles', 'product.md'),
  path.join('governance', 'roles', 'architect.md'),
  path.join('governance', 'roles', 'engineer.md'),
  path.join('governance', 'roles', 'qa.md'),
  path.join('governance', 'rules', 'agent-rules.md'),
  // Phase 15G: a small, curated catalog of situations that commonly signal
  // a real decision — read, never executed (see decision-triggers.js).
  path.join('governance', 'rules', 'decision-triggers.md'),
  // Governance Level Dynamic: a small, curated catalog of declarable
  // signals that adjust a workflow's governance level up or down — read,
  // never matched against a request's text (see governance-signals.js).
  path.join('governance', 'rules', 'governance-signals.md'),
  path.join('governance', 'workflows', 'feature-development.md'),
  path.join('governance', 'workflows', 'bug-fix.md'),
  path.join('governance', 'workflows', 'investigation.md'),
  path.join('governance', 'workflows', 'refactor.md'),
  path.join('governance', 'skills', 'README.md'),
  path.join('governance', 'skills', 'feature-planning', 'SKILL.md'),
  path.join('governance', 'skills', 'architecture-review', 'SKILL.md'),
  path.join('governance', 'skills', 'implementation', 'SKILL.md'),
  path.join('governance', 'skills', 'testing-strategy', 'SKILL.md'),
  // Phase 15F: real, evidenced additions (see decision-model.js), not a
  // library expansion for its own sake — one per role that actually
  // escalates a decision (product, architect).
  path.join('governance', 'skills', 'product-decision-making', 'SKILL.md'),
  path.join('governance', 'skills', 'architecture-decision-record', 'SKILL.md'),
  // Phase 15G: the real, distinct pre-implementation gate the restaurant-
  // game evidence found missing — see governance-review/SKILL.md's own
  // header for why this isn't redundant with the two skills above.
  path.join('governance', 'skills', 'governance-review', 'SKILL.md'),
  path.join('governance', 'conventions', 'README.md'),
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

// Reports the state of the AI Handoff (Phase 13D) after `analyze --explain`
// refreshes `.juntia/agent-instructions.md` — never an interpretation
// itself, since Juntia does not produce one anymore. Distinguishes three
// real states: pending items already waiting on a human (from a previous
// agent run), none yet (first time, or the agent hasn't responded yet), and
// always names the concrete next action either way.
function formatHandoffStatus(pendingCount) {
  const lines = [
    `Handoff instructions refreshed at ${HANDOFF_FILE}.`,
    'Open your AI assistant (e.g. Claude Code) and ask it to follow those instructions to interpret this project.',
  ];
  if (pendingCount > 0) {
    lines.push(`${pendingCount} pending interpretation(s) already waiting — run \`juntia confirm\` to review them.`);
  } else {
    lines.push('It will write its proposal to .juntia/pending.json; run `juntia confirm` afterward to review it.');
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
// `--explain` (Phase 12J; redefined Phase 13D) never adds a file write
// beyond `.juntia/agent-instructions.md` itself, and never spawns anything:
// Juntia does not execute an AI runtime internally (see phases/13d-ai-
// handoff-implementation.md). It only refreshes the handoff instructions an
// external AI agent reads from the same facts/diff this command already
// computed, and reports how many interpretations are already pending.
// Without it, behavior is byte-for-byte identical to plain `analyze`.
// Returns the handoff markdown when `explain` was requested (undefined
// otherwise) — mainly so tests can inspect what was generated without
// needing to re-read the file from disk.
async function runAnalyze(projectRoot = process.cwd(), { explain = false } = {}) {
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

  const markdown = buildHandoffInstructions(facts, diff, existingDecisions);
  writeHandoffInstructions(projectRoot, markdown);

  const { items: pendingItems } = normalizePendingItems(projectRoot);
  console.log(formatHandoffStatus(pendingItems.length));

  return markdown;
}

// Real, interactive confirmation of one pending interpretation at a time —
// the only code path in this codebase that writes to `.juntia/decisions.json`,
// and it only runs after a real human answers a real question. `prompt` is
// injectable (defaults to a real `readline/promises` prompt over
// stdin/stdout) so tests can drive it without touching a real terminal.
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
  // normalizePendingItems (not plain loadPending): Phase 13D — pending.json
  // can now be written directly by an external AI agent (see
  // agent-handoff.js), so an item's `id` can no longer be assumed present or
  // trustworthy the way a Juntia-only writer always guaranteed.
  const pending = normalizePendingItems(projectRoot);
  if (pending.unknown) {
    console.log(`.juntia/pending.json could not be used (${pending.reason}) — nothing to confirm.`);
    return { confirmed: [], rejected: [], stale: [] };
  }
  if (pending.items.length === 0) {
    console.log('No pending items to confirm.');
    return { confirmed: [], rejected: [], stale: [] };
  }

  const factsDoc = loadFacts(projectRoot);
  const facts = (factsDoc.exists && !factsDoc.unknown) ? factsDoc.document.facts : [];
  const { decisions: existingDecisions } = loadDecisions(projectRoot);
  const decisionIds = new Set(existingDecisions.map((d) => d.id));

  const confirmed = [];
  const rejected = [];
  const stale = [];

  for (const item of pending.items) {
    // Phase 15F: a decision request (type "product"/"architecture") is a
    // structurally different question — "what should this be," never "what
    // does the evidence suggest is true" — and takes a completely separate
    // path: no fact-grounding check applies (there is no fact to ground it
    // in), and the human's own free-text answer, never anything the agent
    // proposed, becomes the decision. This is the one place in this
    // codebase that structurally guarantees "un agente nunca debe
    // autoaprobar sus propias decisiones": `validateDecisionRequest` already
    // rejected any proposal that tried to set its own answer, and the only
    // way this loop ever calls `recordDecision` for one is with `answer`
    // freshly typed by whoever is running `confirm` right now.
    if (item.type === 'product' || item.type === 'architecture') {
      // eslint-disable-next-line no-await-in-loop
      const decisionValidation = validateDecisionRequest(item);
      if (!decisionValidation.valid) {
        console.log('');
        console.log(`Skipping a pending decision request — invalid (${decisionValidation.errors.join('; ')}).`);
        removePending(projectRoot, item.id);
        stale.push(item.id);
        continue;
      }

      console.log('');
      console.log(`[${item.type} decision] ${item.question}`);
      if (item.context) console.log(`  context: ${item.context}`);
      if (Array.isArray(item.options) && item.options.length > 0) console.log(`  options: ${item.options.join(', ')}`);
      // eslint-disable-next-line no-await-in-loop
      const decisionAnswer = (await prompt('Your decision (or "skip"/"reject"): ')).trim();
      const normalizedAnswer = decisionAnswer.toLowerCase();

      if (normalizedAnswer === '' || normalizedAnswer === 'skip') {
        console.log('  Skipped for now — still pending, ask again later with `juntia confirm`.');
        continue;
      }
      if (normalizedAnswer === 'reject') {
        removePending(projectRoot, item.id);
        rejected.push(item.id);
        console.log('  Discarded — no decision recorded.');
        continue;
      }

      const decision = recordDecision(projectRoot, item, decisionAnswer);
      appendDecisionNarrative(projectRoot, decision);
      removePending(projectRoot, item.id);
      confirmed.push(decision.id);
      console.log('  Recorded as a decision.');
      continue;
    }

    // Every pending item is now untrusted input until proven otherwise — it
    // may have come from Juntia's own (retired) internal path, or directly
    // from an external AI agent following .juntia/agent-instructions.md, and
    // this is the FIRST point anything checks its shape or its citations
    // against the CURRENT facts (they can change between when an agent wrote
    // its proposal and this later `confirm`). Malformed shape, a forbidden
    // governance field, or a fact identifier that was never real — all fail
    // the same way: dropped, never asked about, never a decision.
    const validation = validateProjectInterpretation(item, facts);
    if (!validation.valid) {
      console.log('');
      console.log(`Skipping a pending proposal — invalid (${validation.errors.join('; ')}).`);
      console.log('If this came from an AI agent, ask it to re-read `.juntia/agent-instructions.md` and try again.');
      removePending(projectRoot, item.id);
      stale.push(item.id);
      continue;
    }

    // A valid proposal that turns out to cite exactly the same facts as an
    // already-confirmed decision is not asked about again — matching the
    // guarantee this codebase has always given (see decisions-store.js's
    // own dedup-by-basedOn design), now enforced here since Juntia no longer
    // controls whether/when a proposal is written to pending.json.
    const id = interpretationId(validation.result.basedOn);
    const alreadyDecided = existingDecisions.find((d) => d.id === id);
    if (alreadyDecided) {
      console.log('');
      console.log(`"${item.interpretation}" already matches a confirmed decision: "${alreadyDecided.text}" — nothing new to confirm.`);
      removePending(projectRoot, item.id);
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
// Phase 15B: `init()` running first, unconditionally, means the Knowledge
// Layer (`.juntia/governance/`) is scaffolded even when the runtime-specific
// pointer file below is refused (e.g. a real, human-authored CLAUDE.md
// already exists) — a real, positive behavior change from Phase 14A, where
// agent-rules.md/workflows.md were only ever written after a successful
// pointer-file integration, so a project with its own CLAUDE.md could never
// get them at all. Knowledge Layer content is runtime-agnostic; it no longer
// depends on which (if any) runtime-specific integration succeeds.
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

  // Refreshed alongside the pointer file, from whatever facts/decisions
  // already exist — generic, not runtime-specific (any agent reading it can
  // follow the same instructions), so it is regenerated here regardless of
  // which runtime was just integrated (Phase 13D).
  const factsDoc = loadFacts(projectRoot);
  const facts = (factsDoc.exists && !factsDoc.unknown) ? factsDoc.document.facts : [];
  const { decisions } = loadDecisions(projectRoot);
  writeHandoffInstructions(projectRoot, buildHandoffInstructions(facts, undefined, decisions));

  // Phase 15D: `.juntia/BOOTSTRAP.md` — the real navigation index Phase
  // 14A/15B used to bake directly into the runtime pointer file — is now
  // regenerated here instead, same "always current, never hand-edited"
  // policy as the handoff file above, not the Knowledge Layer's own
  // "scaffold once" one.
  writeBootstrap(projectRoot);

  // Phase 15B: agent-rules.md/workflows.md (and roles/skills/conventions)
  // are no longer generated here — `init(projectRoot)` above already
  // scaffolded `.juntia/governance/` from static templates if it didn't
  // exist yet, the same mechanism every other scaffold file already uses.
  // Unlike the handoff file, they are not regenerated on every `integrate`
  // call: they're a project's own editable copy once scaffolded.

  log(`Created/updated ${result.file}${result.configUpdated ? ' and .juntia/config.yml' : ''}.`);
  log(`${result.file} points to .juntia/BOOTSTRAP.md — nothing was copied, nothing was sent anywhere.`);
  log(`Safe to delete and regenerate any time with \`juntia integrate ${runtimeName}\`; never hand-edit it.`);
  return result;
}

// --- Workflow Routing Engine (Phase 15C) ------------------------------------
//
// `juntia route "<request>"` is the real entrypoint for this phase's own
// deliverable: turning a free-text request into the structured work
// framework (intent, confidence, workflow, governance level, roles, skills)
// `lib/governance/workflow-router.js` computes, deterministically, from the
// Knowledge Layer. `init(projectRoot)` runs first, unconditionally and
// silently — same precedent `runIntegrate` already established — so a
// project that never ran `juntia init` still gets a real answer instead of
// an avoidable "Knowledge Layer not found" failure.
//
// Never invents a workflow: when the request is ambiguous or the intent
// couldn't be resolved to a real workflow, no `.juntia/task-handoff.md` is
// written at all — only the printed Agent Context and a plain-language
// nudge to clarify the request.
//
// Phase 15D: what's printed to the console is now the Agent Context (`{
// task, workflow, roles, skills, contextSources }`, `lib/governance/
// agent-context.js`) — the brief's own exact navigation contract — rather
// than `routeWorkflow()`'s flat internal shape. The return value stays the
// flat shape unchanged (`intent`/`workflow`/`governanceLevel`/... at the
// top level) for programmatic/test callers already depending on it; only
// the human/agent-facing presentation changed. `.juntia/BOOTSTRAP.md` is
// refreshed regardless of outcome, so it always reflects whether a task
// handoff currently exists.
//
// Governance Level Dynamic — `signals` is a caller-declared array of signal
// names (see `governance-signals.js`); the CLI's own `--signal <name>` flag
// (repeatable) is how a human or an external agent supplies it. With no
// signals declared, behavior is byte-identical to before this addition.
function runRoute(text, projectRoot = process.cwd(), { signals = [] } = {}) {
  if (!text || !text.trim()) {
    console.log('Usage: juntia route "<what you want to do>" [--signal <name>]...');
    return { ok: false, reason: 'no request text given' };
  }

  init(projectRoot);
  const route = routeWorkflow(text, projectRoot, { signals });
  const agentContext = buildAgentContext(route);
  console.log(JSON.stringify(agentContext, null, 2));

  if (!route.workflow) {
    console.log('');
    console.log(`No workflow selected — ${route.reason || 'not enough signal to classify this request.'}`);
    console.log('Describe what should change, or whether this is a question, a bug, or a refactor, and try again.');
    writeBootstrap(projectRoot);
    return route;
  }

  const markdown = buildTaskHandoff(text, route);
  writeTaskHandoff(projectRoot, markdown);
  writeBootstrap(projectRoot);
  console.log('');
  console.log(`Task handoff written to ${TASK_HANDOFF_FILE} — open your AI assistant and ask it to follow it.`);
  return route;
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

// setup(projectRoot, { prompt }) -> Promise<{ initialized, provider, integrateResult }>
// Idempotent by construction: every step it calls (init/saveFacts/
// detectConflicts/runConfirm/writeContext/runIntegrate) was already
// idempotent before this phase — running `setup` twice re-runs the same
// safe operations and reports their real, current state, never duplicating
// a file, a decision, or a pending item. Phase 13D: no longer calls an AI
// runtime itself — see phases/13d-ai-handoff-implementation.md.
async function runSetup(projectRoot = process.cwd(), { prompt = defaultPrompt } = {}) {
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

  // 5: confirm anything already pending — never generated here (Juntia does
  // not run AI itself), but if a previous AI Handoff already produced
  // proposals sitting in .juntia/pending.json (from an earlier `setup` or
  // `analyze --explain` run, once a human opened their assistant and it
  // wrote its proposal there), this is where they surface for review.
  const { items: pendingBeforeConfirm } = normalizePendingItems(projectRoot);
  if (pendingBeforeConfirm.length > 0) {
    console.log(`${pendingBeforeConfirm.length} pending interpretation(s) from your AI assistant found — reviewing now.`);
    await runConfirm(projectRoot, { prompt });
  }

  // 7: context — always refreshed from whatever facts/decisions exist now,
  // same generator `juntia context` itself uses.
  const { decisions: currentDecisions } = loadDecisions(projectRoot);
  writeContext(projectRoot, generateContext(facts, currentDecisions));
  console.log('✓ Context refreshed');
  console.log('');

  // 8: ask which assistant — skipped (and reported as already-configured)
  // if a previous run already recorded one; never asked twice.
  const configuredText = readConfigText(projectRoot);
  const configuredProvider = configuredText ? readRuntimeProvider(configuredText) : null;
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

  // 10: done. If an assistant is configured, `integrate` (step 9) already
  // wrote a real runtime pointer file (e.g. CLAUDE.md) that itself points at
  // `.juntia/BOOTSTRAP.md` — point the user at opening their assistant, full
  // stop (Phase 15D): the assistant discovers what it needs to do from
  // there on its own, without the user needing to name a specific file.
  console.log('Juntia is ready.');
  if (integrateResult && integrateResult.ok) {
    console.log(`Open ${RUNTIME_PROFILES[provider] ? RUNTIME_PROFILES[provider].label : provider} — it will find ${integrateResult.file} and load Juntia's governance from there.`);
  }

  return { initialized: !wasInitialized, provider, integrateResult };
}

module.exports = {
  init,
  runInit,
  runAnalyze,
  runConfirm,
  runContext,
  runIntegrate,
  runRoute,
  runSetup,
  formatAnalysis,
  formatChanges,
  formatHandoffStatus,
  formatSetupDetected,
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
  else if (command === 'route') {
    const rest = process.argv.slice(3);
    const signals = [];
    const textParts = [];
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--signal') {
        i += 1;
        if (rest[i] !== undefined) signals.push(rest[i]);
      } else {
        textParts.push(rest[i]);
      }
    }
    runRoute(textParts.join(' '), process.cwd(), { signals });
  } else if (command === '--version' || command === '-v') console.log(pkgVersion());
  else {
    console.error('Usage: juntia <setup|init|analyze [--explain]|confirm|context|integrate <runtime>|route "<request>" [--signal <name>]...>');
    console.error('New to Juntia? Run `juntia setup` — it walks through everything for you.');
    process.exit(1);
  }
}
