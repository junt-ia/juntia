'use strict';

// Agent Governance — Phase 14A of the Juntia migration.
//
// Phase 13D gave a connected agent memory (facts, decisions, context, and a
// handoff for producing a new interpretation). This module gives it
// behavior: `.juntia/agent-rules.md` (how it should work in a
// Juntia-governed project) and `.juntia/workflows.md` (the recommended
// sequence for a new feature or a bug fix). Per this phase's own explicit
// "las reglas deben ser generadas por Juntia y no inventadas por Claude,"
// both are fixed, deterministic content — the same for every project, no AI
// involved, no per-project derivation — Juntia's own standing policy for
// how any connected agent should operate, not a summary of this specific
// project (that's `context.md`'s job) and not a log of what's already been
// decided (that's `DECISIONS.md`'s job).
//
// Deliberately NOT named `.juntia/rules.md`/`RULES.md`: `.juntia/RULES.md`
// already exists (scaffolded by `init`, Phase 00-era) as a human-authored,
// project-specific CONSTRAINTS file (see templates/RULES.md) — genuinely
// different content, different author, different update cadence from what
// this phase generates. Reusing that name would mean either overwriting a
// real human file or bolting new protection logic onto a file that was
// never designed for it. `agent-rules.md` keeps each file's responsibility
// unambiguous, per this phase's own "cada archivo debe tener una
// responsabilidad clara" — see phases/14a-claude-agent-governance.md §3 for
// the full reasoning.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's boundary).

const fs = require('fs');
const path = require('path');

const AGENT_RULES_FILE = path.join('.juntia', 'agent-rules.md');
const WORKFLOWS_FILE = path.join('.juntia', 'workflows.md');
const GENERATED_MARKER = '<!-- juntia:generated -->';

function buildAgentRules() {
  return [
    GENERATED_MARKER,
    '# Agent Rules',
    '',
    "Juntia's own standing rules for how a connected AI agent should operate in this project — the same",
    'rules for every Juntia-governed project, not derived from this project specifically. Distinct from',
    '`.juntia/RULES.md`, if present, which holds this project\'s own human-authored constraints instead.',
    '',
    '- **Analyze before modifying.** Read `.juntia/context.md` (confirmed facts and decisions) before',
    '  proposing or making a change — do not re-derive what Juntia has already established.',
    '- **Respect confirmed decisions.** A decision in `.juntia/DECISIONS.md` was made deliberately by a',
    "  human. Don't silently work around, contradict, or re-litigate one — if a change requires it, say so",
    '  explicitly and ask.',
    '- **Never introduce a dependency without stating why.** A new dependency is a real, lasting cost —',
    '  name the concrete reason it is needed as part of proposing the change, not after the fact.',
    '- **Ask when a request conflicts with an existing decision or constraint.** Do not silently choose one',
    '  side — surface the conflict and let the human decide, the same way Juntia itself never resolves a',
    '  conflicted decision on its own (see `.juntia/context.md`\'s own "Conflicts needing review" section).',
    '- **Validate changes before considering them done.** Run the project\'s own real tests/build, not just a',
    '  visual read of the diff.',
    '- **Never write directly to `.juntia/decisions.json`.** Only a human, via `juntia confirm`, creates a',
    '  decision. If you are proposing a project interpretation (not implementing a change), follow',
    '  `.juntia/agent-instructions.md` instead.',
    '',
    'These rules describe what improves consistency and reduces contradictory or context-losing work across',
    'sessions — not a guarantee of correctness. A model can still make mistakes; the point is to reduce how',
    'often they come from missing context this project already has.',
    '',
  ].join('\n');
}

function buildWorkflows() {
  return [
    GENERATED_MARKER,
    '# Workflows',
    '',
    "Juntia's own recommended sequence for common kinds of work in a Juntia-governed project — the same",
    'recommendation for every project, not derived from this one specifically.',
    '',
    '## New feature',
    '',
    '1. Analyze the impact — what existing components, decisions, or constraints does this touch?',
    '2. Review the existing architecture (`.juntia/context.md`, `.juntia/ARCHITECTURE.md` if present) before',
    '   proposing a new one.',
    '3. Propose a solution, naming any tradeoff.',
    '4. If the proposal affects or conflicts with an existing confirmed decision, wait for confirmation',
    '   before implementing — do not proceed on an assumption.',
    '5. Implement.',
    '6. Validate — run the real tests/build, not just a visual read.',
    '',
    '## Bug fix',
    '',
    '1. Reproduce the bug for real before changing anything.',
    '2. Investigate the real cause — do not guess at a fix for a symptom.',
    '3. Modify.',
    '4. Validate — confirm the original reproduction no longer fails, and nothing else regressed.',
    '',
  ].join('\n');
}

function writeAgentGovernance(projectRoot) {
  const rulesPath = path.join(projectRoot, AGENT_RULES_FILE);
  const workflowsPath = path.join(projectRoot, WORKFLOWS_FILE);
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, buildAgentRules());
  fs.writeFileSync(workflowsPath, buildWorkflows());
  return { rulesPath, workflowsPath };
}

module.exports = {
  AGENT_RULES_FILE, WORKFLOWS_FILE, buildAgentRules, buildWorkflows, writeAgentGovernance,
};
