'use strict';

// Workflow Knowledge — Phase 15C of the Juntia migration.
//
// Reads `.juntia/governance/workflows/*.md` (Phase 15B's Knowledge Layer,
// scaffolded once by `init()`) and resolves the real, declared roles,
// skills, and governance level for a given intent — the Knowledge Layer is
// the only source of truth here. Per this phase's own explicit requirement
// ("No hardcodear workflows completos dentro de JavaScript"), nothing about
// a workflow's roles, skills, or governance level is duplicated in this
// file: every one of those fields is parsed, at call time, from the real
// markdown a project actually has on disk.
//
// The one thing this module does hardcode, deliberately and narrowly: the
// correspondence between an intent name and which workflow *file* answers
// it — a small, honest naming table (the same kind of thing
// `agent-integration.js`'s own `RUNTIME_PROFILES` already is for runtime
// names), not a duplication of workflow content.
//
// Parses the same structural sections `test/knowledge-layer.test.js` already
// requires every workflow file to have (`## Roles involved`,
// `## Skills recommended`, `## Recommended governance level`) — this module
// depends on that structure, not on any new frontmatter or format change,
// per this phase's own explicit "Mantener compatibilidad... No hacer una
// migración destructiva." No template file is modified by this phase.

const fs = require('fs');
const path = require('path');

const { isValidGovernanceLevel } = require('./governance-levels.js');

const INTENT_WORKFLOW_FILE = {
  feature: 'feature-development.md',
  bug: 'bug-fix.md',
  investigation: 'investigation.md',
  refactor: 'refactor.md',
};

const ROLE_LINE = /^- \*\*([A-Za-z][A-Za-z ]*)\*\*/gm;
const SKILL_LINE = /^- `([a-z0-9-]+)`/gm;
const LEVEL_PATTERN = /\*\*(LIGHT|STANDARD|STRICT)\*\*/;
const DECISION_TYPE_LINE = /^- \*\*(Product decision|Architecture decision)\*\*/gm;
const DECISION_TYPE_LABELS = { 'Product decision': 'product', 'Architecture decision': 'architecture' };
const DECISION_TYPE_BLOCK_SPLIT = /(?=^- \*\*(?:Product decision|Architecture decision)\*\*)/m;
const DECISION_AREA_LINE = /^ {2}- `([a-z0-9_]+)`/gm;

// Slices out the body of a `## <heading>` section, up to (but not
// including) the next `## ` heading or the end of the file — mechanical
// text handling, not a markdown parser, matching this codebase's own
// standing precedent (`agent-integration.js`'s `parseIntegrationsBlock`).
function extractSection(markdown, heading) {
  const headingPattern = new RegExp(`^## ${heading}\\s*$`, 'm');
  const match = headingPattern.exec(markdown);
  if (!match) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const nextHeading = /^## /m.exec(rest);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

function extractRoles(section) {
  if (!section) return [];
  const roles = [];
  let m;
  const re = new RegExp(ROLE_LINE);
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(section))) {
    const slug = m[1].trim().toLowerCase().replace(/\s+/g, '-');
    if (!roles.includes(slug)) roles.push(slug);
  }
  return roles;
}

function extractSkills(section) {
  if (!section) return [];
  const skills = [];
  let m;
  const re = new RegExp(SKILL_LINE);
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(section))) {
    if (!skills.includes(m[1])) skills.push(m[1]);
  }
  return skills;
}

// First bolded LIGHT/STANDARD/STRICT token inside the governance section is
// always, in every real workflow file this phase read, the workflow's own
// default/recommended level — escalation language later in the same section
// ("Escalates to **STRICT** if...") never appears first.
function extractGovernanceLevel(section) {
  if (!section) return null;
  const match = LEVEL_PATTERN.exec(section);
  if (!match) return null;
  const level = match[1].toLowerCase();
  return isValidGovernanceLevel(level) ? level : null;
}

// Phase 15F: which decision type(s) — "product", "architecture" — this
// workflow names as something it may require a human to settle. A workflow
// with no such section (or one that only says "None, by design" in prose,
// e.g. `investigation.md`) parses to an empty array — never invented,
// exactly the same "absence is a real signal" discipline every other
// extractor in this file already follows.
function extractDecisionTypes(section) {
  if (!section) return [];
  const types = [];
  let m;
  const re = new RegExp(DECISION_TYPE_LINE);
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(section))) {
    const type = DECISION_TYPE_LABELS[m[1]];
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
}

// Phase 15G: which specific AREA(S) within a decision type this workflow
// names — e.g. `product: [behavior, scope]`, not just "this workflow may
// need a product decision." Real, evidenced restraint, not a checklist:
// only the areas a real workflow file actually lists are ever returned; a
// type bullet with no indented sub-bullets under it (none of the four real
// workflow files have this case today, but a hand-edited one could)
// contributes no entry for that type at all, rather than an empty array —
// "no areas named" and "named as an empty list" are different, real
// signals, and this parser preserves the distinction instead of collapsing
// it. Sub-bullets are attributed to the nearest preceding top-level
// Product/Architecture decision bullet within the same section — never
// nested under the wrong type by accident, verified directly by test
// against every real template file.
function extractDecisionAreas(section) {
  if (!section) return {};
  const areas = {};
  const blocks = section.split(DECISION_TYPE_BLOCK_SPLIT);
  for (const block of blocks) {
    const typeMatch = /^- \*\*(Product decision|Architecture decision)\*\*/.exec(block);
    if (!typeMatch) continue;
    const type = DECISION_TYPE_LABELS[typeMatch[1]];
    const found = [];
    let m;
    const re = new RegExp(DECISION_AREA_LINE);
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(block))) {
      if (!found.includes(m[1])) found.push(m[1]);
    }
    if (found.length > 0) areas[type] = found;
  }
  return areas;
}

// parseWorkflowMarkdown(markdown, name) -> { name, roles, skills,
// governanceLevel, decisionTypes, decisionAreas } or null when none of
// roles/skills/governanceLevel could be read — e.g. a hand-edited file with
// a genuinely different shape. `decisionTypes`/`decisionAreas` alone are
// never enough to make a workflow file "readable" (a workflow with a real
// Roles/Skills/Governance section but no Decisions section — every workflow
// scaffolded before Phase 15F — is still a perfectly valid, resolvable
// workflow); they are optional metadata, not required sections. Never
// invents a partial or default result; the caller decides what "unreadable"
// means.
function parseWorkflowMarkdown(markdown, name) {
  const roles = extractRoles(extractSection(markdown, 'Roles involved'));
  const skills = extractSkills(extractSection(markdown, 'Skills recommended'));
  const governanceLevel = extractGovernanceLevel(extractSection(markdown, 'Recommended governance level'));
  const decisionsSection = extractSection(markdown, 'Decisions this workflow may require');
  const decisionTypes = extractDecisionTypes(decisionsSection);
  const decisionAreas = extractDecisionAreas(decisionsSection);
  if (roles.length === 0 && skills.length === 0 && !governanceLevel) return null;
  return {
    name, roles, skills, governanceLevel, decisionTypes, decisionAreas,
  };
}

// resolveWorkflowForIntent(projectRoot, intent) -> { ok: true, workflow } or
// { ok: false, reason }. Every failure — an intent with no mapped workflow,
// a project that never scaffolded the Knowledge Layer, or a workflow file
// this parser can't structurally read — fails the same honest way: no
// workflow is ever guessed or synthesized.
function resolveWorkflowForIntent(projectRoot, intent) {
  const filename = INTENT_WORKFLOW_FILE[intent];
  if (!filename) {
    return { ok: false, reason: `no workflow is mapped to intent "${intent}"` };
  }

  const relativePath = path.join('.juntia', 'governance', 'workflows', filename);
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      reason: `${relativePath} not found — run \`juntia init\` to scaffold the Knowledge Layer first`,
    };
  }

  const markdown = fs.readFileSync(filePath, 'utf8');
  const name = filename.replace(/\.md$/, '');
  const parsed = parseWorkflowMarkdown(markdown, name);
  if (!parsed) {
    return {
      ok: false,
      reason: `${relativePath} exists but its Roles/Skills/Governance sections could not be read — it may have been hand-edited into an unrecognized shape`,
    };
  }

  return { ok: true, workflow: parsed };
}

module.exports = {
  INTENT_WORKFLOW_FILE,
  parseWorkflowMarkdown,
  resolveWorkflowForIntent,
};
