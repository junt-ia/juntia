'use strict';

// Juntia Bootstrap — Phase 15D of the Juntia migration.
//
// The real navigation entry point an external agent lands on after
// following a runtime-specific pointer (`CLAUDE.md`, today). Phase 14A/15B
// grew that pointer file into a full governance index (every file named,
// every subdirectory listed) — useful, but exactly what this phase's own
// brief says an entry point must NOT be: a place that says "read all these
// files always." This module carries that index instead, one level deeper,
// so `CLAUDE.md` itself can shrink back to a single, real bootstrap trigger
// (see `agent-integration.js`'s Phase 15D-updated `buildPointerContent`).
//
// ARCHITECTURAL BOUNDARY: this module explains WHERE to find context,
// workflow, roles, skills, and rules, and HOW to ask for a task-specific
// subset of them (`juntia route`) — it never explains WHAT to build or HOW.
// Deterministic, no AI call, same discipline every generated file in this
// codebase already follows.
//
// Regenerated (not scaffolded once): unlike `.juntia/governance/`'s own
// content, this file has no reason to become a project's own hand-edited
// artifact — it only ever describes real, current filesystem state (does
// RULES.md exist, does a task-handoff already exist), so it follows
// `agent-instructions.md`'s/`CLAUDE.md`'s own "always regenerated, never
// hand-edited" contract, not the Knowledge Layer's "scaffold once" one.

const fs = require('fs');
const path = require('path');

const GENERATED_MARKER = '<!-- juntia:generated -->';

const BOOTSTRAP_FILE = path.join('.juntia', 'BOOTSTRAP.md');
const RULES_FILE = path.join('.juntia', 'RULES.md');
const TASK_HANDOFF_PATH = path.join('.juntia', 'task-handoff.md');

// buildBootstrap(projectRoot) -> markdown string. Reads only real, current
// filesystem existence (never content) to decide which optional lines to
// include — the same "never claim a file exists that doesn't" discipline
// `agent-integration.js`'s own `hasProjectRules` check already established.
function buildBootstrap(projectRoot) {
  const hasProjectRules = fs.existsSync(path.join(projectRoot, RULES_FILE));
  const hasActiveTaskHandoff = fs.existsSync(path.join(projectRoot, TASK_HANDOFF_PATH));

  const lines = [
    GENERATED_MARKER,
    '# Juntia Bootstrap',
    '',
    'You are working in a project governed by Juntia — a deterministic governance layer, not an agent.',
    'Juntia classifies work and points you at the right process, context, roles, and skills. It never',
    'reasons for you, never decides a technical solution, and never implements anything — that stays',
    'entirely yours.',
    '',
    '## Orienting for the first time in this project',
    '',
    'Read once per session, before anything else:',
    '',
    '- `.juntia/context.md` — what this project is: confirmed facts, technologies, structure.',
    '- `.juntia/PROJECT_STATE.md` — current state, if a human has filled it in.',
    '- `.juntia/DECISIONS.md` — what has already been decided, and why.',
  ];

  if (hasProjectRules) {
    lines.push("- `.juntia/RULES.md` — this project's own real constraints, if any are recorded.");
  }

  lines.push(
    '',
    '## Working on a specific request',
    '',
    "Don't read the whole Knowledge Layer up front. Instead:",
    '',
    '1. Run `juntia route "<the request, in your own words>"`.',
    '2. It prints a structured Agent Context — intent, confidence, workflow, governance level, roles,',
    '   skills, and `contextSources` — and, only when a real workflow was resolved, refreshes',
    '   `.juntia/task-handoff.md` with the same information plus direct pointers to the files that',
    '   actually apply to this request.',
    '3. Read only what `task-handoff.md`/the Agent Context points you at: the resolved workflow file, the',
    '   listed role files, the listed skill files. Everything else under `.juntia/governance/` is real and',
    '   available, but not required reading for this specific request.',
    '',
    "If the request is ambiguous, `route` reports `needsClarification: true` and no `workflow` — ask the",
    "human what they mean; never guess a workflow to fill the gap.",
  );

  if (hasActiveTaskHandoff) {
    lines.push(
      '',
      'A task handoff already exists at `.juntia/task-handoff.md` from a previous request — read it first;',
      "it may already answer what you're about to ask `route` for. Run `route` again for a new request.",
    );
  }

  lines.push(
    '',
    '## What else is here',
    '',
    '- `.juntia/governance/rules/agent-rules.md` — how to behave in this project, always applicable.',
    '- `.juntia/governance/rules/decision-triggers.md` — a few common, real situations worth recognizing as a',
    '  possible product/architecture decision — read it, never something Juntia evaluates automatically.',
    '- `.juntia/governance/workflows/` — the recommended process per kind of work.',
    '- `.juntia/governance/roles/` — the perspective to reason from for a given piece of work.',
    '- `.juntia/governance/skills/` — specialized procedures for a given task.',
    '- `.juntia/governance/conventions/` — project conventions, if any are recorded.',
    '- `.juntia/agent-instructions.md` — a different job from working a request: if asked to interpret this',
    "  project's own facts for Juntia, follow this instead.",
    '',
    'Juntia does not control what you do — it defines the environment you work in. You reason within it.',
    '',
  );

  return lines.join('\n');
}

function writeBootstrap(projectRoot) {
  const targetPath = path.join(projectRoot, BOOTSTRAP_FILE);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buildBootstrap(projectRoot));
  return targetPath;
}

module.exports = { BOOTSTRAP_FILE, buildBootstrap, writeBootstrap };
