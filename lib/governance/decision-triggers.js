'use strict';

// Decision Triggers — Phase 15G of the Juntia migration.
//
// Reads `.juntia/governance/rules/decision-triggers.md` — a small, curated
// catalog of situations that commonly signal a real product/architecture
// decision is needed — the same "Knowledge Layer is the only source of
// truth, parse the real file, hardcode nothing about its content" discipline
// `workflow-knowledge.js` already established. The catalog's own content
// (which triggers exist, their reasons, whether each recommends
// confirmation) lives entirely in that markdown file; this module only
// knows how to read it.
//
// ARCHITECTURAL BOUNDARY (deliberate, per this phase's own brief): this
// module never matches a trigger against a request's own text, never
// decides a trigger "fired," and is never wired into `workflow-router.js`/
// `agent-context.js` to influence a route automatically. "Los triggers NO
// deben decidir automáticamente" — a trigger is data an agent (or a skill,
// e.g. `governance-review`) chooses to read and apply its own judgment to,
// not a rule Juntia itself evaluates. Doing the latter would be exactly the
// "IA para detectar decisiones" this phase's own brief explicitly defers.

const fs = require('fs');
const path = require('path');

const DECISION_TRIGGERS_FILE = path.join('.juntia', 'governance', 'rules', 'decision-triggers.md');

const TRIGGER_TYPE_LINE = /^- \*\*Type:\*\*\s*(product|architecture)\s*$/m;
const TRIGGER_CONFIRMATION_LINE = /^- \*\*Requires confirmation:\*\*\s*(yes|no)\s*$/m;

// A field's value can wrap onto indented continuation lines (plain markdown
// prose, same convention every hand-written bullet in this codebase's
// templates already uses) — captured up to the next `- **` bullet or the
// end of the block, then joined into one line. Without this, a wrapped
// `Reason:` would silently truncate at its first physical line.
function extractField(body, label) {
  const pattern = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+(?:\\n(?! *- \\*\\*)[^\\n]*)*)`, 'm');
  const match = pattern.exec(body);
  if (!match) return null;
  return match[1].split('\n').map((line) => line.trim()).join(' ').trim();
}

// parseDecisionTriggers(markdown) -> [{ type, trigger, reason,
// requiresConfirmation }, ...] — the brief's own exact shape. Each `## name`
// heading is one trigger; an entry missing a real `Type`/`Reason` is
// skipped, never guessed at (the same "unreadable is a real, honest result,
// not something to paper over" discipline `workflow-knowledge.js`'s own
// parser already follows).
function parseDecisionTriggers(markdown) {
  const triggers = [];
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const newlineIndex = section.indexOf('\n');
    const trigger = (newlineIndex === -1 ? section : section.slice(0, newlineIndex)).trim();
    const body = newlineIndex === -1 ? '' : section.slice(newlineIndex + 1);

    const typeMatch = TRIGGER_TYPE_LINE.exec(body);
    const reason = extractField(body, 'Reason');
    if (!trigger || !typeMatch || !reason) continue;

    const confirmationMatch = TRIGGER_CONFIRMATION_LINE.exec(body);
    triggers.push({
      trigger,
      type: typeMatch[1],
      reason,
      requiresConfirmation: confirmationMatch ? confirmationMatch[1] === 'yes' : true,
    });
  }
  return triggers;
}

// loadDecisionTriggers(projectRoot) -> { ok: true, triggers } or
// { ok: false, reason }. A missing file (a project that never scaffolded
// the Knowledge Layer, or trimmed this file to nothing) is a real, honest
// "no triggers" — never invented, never crashes.
function loadDecisionTriggers(projectRoot) {
  const filePath = path.join(projectRoot, DECISION_TRIGGERS_FILE);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `${DECISION_TRIGGERS_FILE} not found — run \`juntia init\` to scaffold the Knowledge Layer first` };
  }
  const markdown = fs.readFileSync(filePath, 'utf8');
  return { ok: true, triggers: parseDecisionTriggers(markdown) };
}

module.exports = { DECISION_TRIGGERS_FILE, parseDecisionTriggers, loadDecisionTriggers };
