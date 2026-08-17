'use strict';

// Agent Context Integration — Phase 12L of the Juntia migration.
//
// The first real consumption layer for `.juntia/context.md` (Phase 12K):
// generates a small, runtime-specific POINTER file at the conventional path
// a given AI coding runtime already reads on its own — never a copy of
// `.juntia/context.md`'s content, never a second source of truth. Per this
// phase's own architectural principle ("Juntia no debe convertirse en otro
// agente IA; debe convertirse en la capa de contexto que alimenta agentes
// existentes"), this module makes zero AI calls, sends nothing to any
// external service, and never modifies project source code, facts,
// decisions, or `.juntia/context.md` itself — it only ever reads
// `.juntia/context.md` (to confirm it exists) and writes one small,
// regeneratable file plus one bookkeeping line in `.juntia/config.yml`.
//
// Only `claude-code` is a real, built profile this phase — per the brief's
// own priority order ("1. Claude Code si existe soporte claro... 3. Otros
// agentes como documentación futura") and real, first-party evidence: a
// project this migration already validated against (`app-podcaster`) has
// its own real, human-authored `CLAUDE.md` at the project root, confirming
// that is genuinely where Claude Code looks — not a guess. Codex/Gemini/
// Cursor profiles are architecturally supported (add one entry to
// RUNTIME_PROFILES, nothing else changes) but not added without the same
// kind of real evidence for their own conventions.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's boundary).

const fs = require('fs');
const path = require('path');

const CONTEXT_FILE = path.join('.juntia', 'context.md');
const CONFIG_FILE = path.join('.juntia', 'config.yml');

// Prepended to every generated file so a later `integrate` run — or a
// human — can tell "safe to regenerate" apart from "a real file someone
// else wrote," without guessing from content. Matches docs/
// RUNTIME_INTEGRATION.md's own pre-existing description of a generated
// adaptation as "disposable and regeneratable."
const GENERATED_MARKER = '<!-- juntia:generated -->';

const RUNTIME_PROFILES = {
  'claude-code': { file: 'CLAUDE.md', label: 'Claude Code' },
};

// Named, honest roadmap — never selectable, never implemented this phase.
// Phase 13A's own brief: "preparar arquitectura para... no implementar
// todavía esos proveedores." Listing them (visibly, as unavailable) in
// `juntia setup`'s own assistant prompt is the "prepare the architecture"
// part; a real profile is only ever added once the same kind of real,
// first-party evidence RUNTIME_PROFILES['claude-code'] had (Phase 12L §4)
// exists for one of these.
const PLANNED_PROVIDERS = [
  { provider: 'codex', label: 'OpenAI Codex' },
  { provider: 'gemini-cli', label: 'Gemini CLI' },
  { provider: 'cursor', label: 'Cursor' },
];

function isJuntiaGenerated(content) {
  return content.startsWith(GENERATED_MARKER);
}

// Phase 14A/15B: this file used to be the governance INDEX itself — naming
// every real, Juntia-maintained file directly. Phase 15D moves that index
// one level deeper, into `.juntia/BOOTSTRAP.md`
// (`lib/governance/bootstrap.js`), and shrinks this file back to a real
// entry point: per this phase's own explicit brief, an entry point must
// never say "read all these files always" — it must trigger a bootstrap,
// not perform one. `CLAUDE.md` still never copies any real content; it now
// also never enumerates it, only points at the one file that does.
//
// Single Governance Source of Truth phase: two more one-paragraph additions,
// still no file enumeration. First, an explicit statement that
// `.juntia/governance/` — never a legacy `.juntia/agent-rules.md`/
// `workflows.md`/`roles/` a project might still be carrying — is the only
// governance source, so an external agent that happens to see both never
// has to guess which one is authoritative. Second, the blocking-decision
// contract itself, stated once, at the real entry point, instead of only
// three hops away (`BOOTSTRAP.md` -> a skill file) — a real dogfooding
// gap: an agent that never gets that far can still miss it entirely.
function buildPointerContent(profile, runtimeName) {
  const lines = [
    GENERATED_MARKER,
    `# ${profile.label} instructions`,
    '',
    'This project uses Juntia Governance — a deterministic layer that classifies work and points you at',
    'the right process, context, roles, and skills. It never reasons for you and never implements anything.',
    '',
    '`.juntia/governance/` is the single source of truth for how to work in this project — rules, workflows,',
    'roles, skills, and decision triggers. If an older `.juntia/agent-rules.md`, `.juntia/workflows.md`, or',
    '`.juntia/roles/` is still present, it is not authoritative; run `juntia update` to migrate it.',
    '',
    'Load `.juntia/BOOTSTRAP.md` before acting on any request in this project. It explains what to read for',
    'a first session, how to get the workflow/roles/skills that actually apply to a specific request',
    '(`juntia route`), and where everything else lives — you should not need to read the whole Knowledge',
    'Layer up front.',
    '',
    'If a decision surfaces during your work that requires human confirmation: do not silently pick a',
    'default, and do not continue implementing the affected part. Create a decision request through',
    "Juntia's own mechanism, wait for a human to confirm it (`juntia confirm`), and continue only once you",
    'have that confirmation — `.juntia/BOOTSTRAP.md` names the exact procedure.',
    '',
    `Generated by \`juntia integrate ${runtimeName}\` — safe to delete and regenerate any time. Never`,
    'hand-edit it directly: real corrections belong in `.juntia/`, made via `juntia confirm`.',
    '',
  ];
  return lines.join('\n');
}

// Reads the current `integrations:` list from a real config.yml's text,
// tolerating the two shapes this file could realistically be in: the
// empty/short flow style `juntia init` scaffolds (`integrations: []`) and
// the block-list style this module itself writes once at least one
// integration exists. Deliberately narrow, mechanical text handling — not
// a YAML parser — matching decisions-store.js's own appendDecisionNarrative()
// precedent (Phase 12K) rather than adding a new dependency for one field.
function parseIntegrationsBlock(configText) {
  const flow = configText.match(/^integrations:\s*\[([^\]]*)\]\s*$/m);
  if (flow) {
    const inner = flow[1].trim();
    return inner === '' ? [] : inner.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const block = configText.match(/^integrations:\s*\n((?:[ \t]+-[ \t]*\S.*\n?)*)/m);
  if (block) {
    return block[1].split('\n').map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
  }
  return [];
}

// Adds `name` to the integrations list if not already present (idempotent —
// re-running `integrate` for the same runtime never duplicates the entry),
// always rewriting to one canonical block-list shape so every subsequent
// read/write stays predictable regardless of which shape was there before.
function withIntegration(configText, name) {
  const current = parseIntegrationsBlock(configText);
  if (current.includes(name)) return configText;

  const next = [...current, name];
  const replacement = `integrations:\n${next.map((n) => `  - ${n}`).join('\n')}\n`;

  const flowRe = /^integrations:\s*\[[^\]]*\]\s*\n?/m;
  const blockRe = /^integrations:\s*\n(?:[ \t]+-[ \t]*\S.*\n?)*/m;

  if (flowRe.test(configText)) return configText.replace(flowRe, replacement);
  if (blockRe.test(configText)) return configText.replace(blockRe, replacement);

  const sep = configText === '' || configText.endsWith('\n') ? '' : '\n';
  return `${configText}${sep}${replacement}`;
}

// Reads/writes `.juntia/config.yml`'s OTHER, separate runtime-related
// field: `runtime.provider` — which AI assistant the user said they use,
// distinct from `integrations:` (which runtimes have a generated pointer
// file). Phase 12L deliberately left this field untouched ("la
// configuración no debe controlar el modelo todavía"); Phase 13A's own
// brief explicitly asks `juntia setup` to record the user's stated
// preference here. Recording it is NOT the same as consuming it: nothing
// in this codebase reads `runtime.provider` back to select an adapter for
// `analyze --explain`'s own AI calls — that remains exactly as unbuilt as
// Phase 12C left it (see docs/RUNTIME_INTEGRATION.md). This is a real,
// honest record of a stated preference, not a routing mechanism.
//
// Same narrow, mechanical text-editing discipline as parseIntegrationsBlock/
// withIntegration above — not a YAML parser.
function readRuntimeProvider(configText) {
  const block = configText.match(/^runtime:[ \t]*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return null;
  const providerLine = block[1].match(/^[ \t]*provider:[ \t]*(.*)$/m);
  if (!providerLine) return null;
  const raw = providerLine[1].trim().replace(/^["']|["']$/g, '');
  return (raw === '' || raw === 'null') ? null : raw;
}

function withRuntimeProvider(configText, provider) {
  const blockRe = /^runtime:[ \t]*\n((?:[ \t]+.*\n?)*)/m;
  const match = configText.match(blockRe);

  if (!match) {
    const sep = configText === '' || configText.endsWith('\n') ? '' : '\n';
    return `${configText}${sep}runtime:\n  provider: ${provider}\n`;
  }

  const bodyLines = match[1].replace(/\n$/, '').split('\n');
  let replaced = false;
  const newBodyLines = bodyLines.map((line) => {
    if (/^[ \t]*provider:/.test(line)) {
      replaced = true;
      return `  provider: ${provider}`;
    }
    return line;
  });
  if (!replaced) newBodyLines.unshift(`  provider: ${provider}`);

  const newBlock = `runtime:\n${newBodyLines.join('\n')}\n`;
  return configText.slice(0, match.index) + newBlock + configText.slice(match.index + match[0].length);
}

// integrateRuntime(projectRoot, runtimeName) -> {
//   ok: boolean, reason?: string, file?: string, configUpdated?: boolean
// }
// Never throws, never guesses, never overwrites a real (non-Juntia-
// generated) file. Assumes `.juntia/config.yml` already exists — the
// caller (bin/juntia.js's runIntegrate) ensures that via the existing,
// idempotent `init()` before calling this, rather than this module
// duplicating scaffold-creation logic.
function integrateRuntime(projectRoot, runtimeName) {
  const profile = RUNTIME_PROFILES[runtimeName];
  if (!profile) {
    return {
      ok: false,
      reason: `unsupported runtime "${runtimeName}" — supported: ${Object.keys(RUNTIME_PROFILES).join(', ')}`,
    };
  }

  const contextPath = path.join(projectRoot, CONTEXT_FILE);
  if (!fs.existsSync(contextPath)) {
    return {
      ok: false,
      reason: 'no .juntia/context.md yet — run `juntia analyze` and `juntia context` (or `juntia confirm`) first',
    };
  }

  const targetPath = path.join(projectRoot, profile.file);
  if (fs.existsSync(targetPath) && !isJuntiaGenerated(fs.readFileSync(targetPath, 'utf8'))) {
    return {
      ok: false,
      reason: `${profile.file} already exists and wasn't generated by Juntia — not overwriting it. Move it aside first if you want Juntia to generate one.`,
    };
  }

  fs.writeFileSync(targetPath, buildPointerContent(profile, runtimeName));

  const configPath = path.join(projectRoot, CONFIG_FILE);
  const configText = fs.readFileSync(configPath, 'utf8');
  const updatedConfig = withIntegration(configText, runtimeName);
  const configUpdated = updatedConfig !== configText;
  if (configUpdated) fs.writeFileSync(configPath, updatedConfig);

  return { ok: true, file: profile.file, configUpdated };
}

module.exports = {
  RUNTIME_PROFILES,
  PLANNED_PROVIDERS,
  GENERATED_MARKER,
  isJuntiaGenerated,
  buildPointerContent,
  parseIntegrationsBlock,
  withIntegration,
  readRuntimeProvider,
  withRuntimeProvider,
  integrateRuntime,
};
