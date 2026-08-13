'use strict';

// Claude Code CLI runtime adapter — Phase 11C of the Juntia migration.
//
// The ONLY file in this codebase allowed to know runtime-specific details
// (binary resolution, CLI flags, output envelope shape). Juntia's core code
// (lib/intent-runtime-bridge.js) never imports this module directly — it
// receives an adapter as a parameter, so this file could be swapped for a
// Codex/Gemini/API adapter without lib/intent-runtime-bridge.js changing at
// all. See phases/11c-runtime-provider-bridge.md's "Architectural test"
// section for what was actually found when this claim was checked.
//
// Uses the SAME authenticated session already running Claude Code itself —
// no ANTHROPIC_API_KEY, no new credential, no new billing account. Verified
// directly (phase doc §"No API key"): invoked without --bare, so OAuth/
// keychain auth is used exactly as it would be for an interactive session.
//
// Safety: requestText is passed as a single argv element via execFile (no
// shell), never interpolated into a shell string — untrusted free text can
// never be interpreted as a shell command this way. --tools "" disables all
// tool access for the spawned process (pure text-in, text-out completion,
// no file/bash/edit capability at all — the runtime is an interpreter,
// nothing more, enforced structurally, not just by instruction).

const { execFile } = require('node:child_process');
const { SYSTEM_PROMPT, OUTPUT_SCHEMA } = require('./reasoning-guideline.js');

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MODEL = 'haiku';

// CLAUDE_CODE_EXECPATH is set by the running session when Claude Code
// itself launched this process (confirmed present in this environment via
// the VS Code extension) — falls back to a bare `claude` on PATH for
// environments where the CLI was installed independently.
function resolveClaudeBinary() {
  return process.env.CLAUDE_CODE_EXECPATH || 'claude';
}

function buildArgs(requestText, model, systemPrompt, schema) {
  return [
    '-p', `Request to interpret: ${JSON.stringify(requestText)}`,
    '--system-prompt', systemPrompt,
    '--json-schema', JSON.stringify(schema),
    '--output-format', 'json',
    '--tools', '',
    '--no-session-persistence',
    '--model', model,
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
  ];
}

// interpret(requestText, options) -> Promise<RuntimeResponse>
// RuntimeResponse: { ok: true, raw, durationMs, costUsd, usage }
//               or { ok: false, error, message, durationMs }
// Never throws — every failure mode (timeout, missing binary, non-zero
// exit, malformed envelope, runtime-reported error) resolves to `ok: false`
// so the caller (lib/intent-runtime-bridge.js) can fail safely without a
// try/catch at every call site.
//
// `systemPrompt`/`schema` default to the original intent-interpretation
// guideline (Phase 11C) so every existing caller keeps working unmodified.
// Phase 12J generalized this from a hardcoded pair to an optional
// parameter — reusing this one adapter for a second interpretation domain
// (project facts -> interpretation) rather than duplicating the whole
// exec/timeout/envelope-parsing machinery in a second adapter file. The
// adapter itself still knows nothing about either domain's meaning; it only
// transports whatever guideline it's given to the same authenticated CLI
// session, exactly as before.
function interpret(requestText, {
  timeoutMs = DEFAULT_TIMEOUT_MS, model = DEFAULT_MODEL,
  systemPrompt = SYSTEM_PROMPT, schema = OUTPUT_SCHEMA,
} = {}) {
  return new Promise((resolve) => {
    const bin = resolveClaudeBinary();
    const args = buildArgs(requestText, model, systemPrompt, schema);
    const start = Date.now();

    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      const durationMs = Date.now() - start;

      if (err) {
        resolve({
          ok: false,
          error: err.killed ? 'timeout' : (err.code === 'ENOENT' ? 'binary_not_found' : 'runtime_error'),
          message: err.message,
          durationMs,
        });
        return;
      }

      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch (e) {
        resolve({ ok: false, error: 'malformed_envelope', message: e.message, durationMs });
        return;
      }

      if (!envelope || envelope.is_error || envelope.subtype !== 'success') {
        resolve({
          ok: false,
          error: 'runtime_reported_error',
          message: (envelope && envelope.result) || 'unknown runtime error',
          durationMs,
        });
        return;
      }

      if (typeof envelope.result !== 'string' || envelope.result.trim() === '') {
        resolve({ ok: false, error: 'empty_response', message: 'runtime returned no result text', durationMs });
        return;
      }

      resolve({
        ok: true,
        raw: envelope.result,
        durationMs,
        costUsd: typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : null,
        usage: envelope.usage || null,
      });
    });
  });
}

module.exports = { interpret, resolveClaudeBinary, DEFAULT_TIMEOUT_MS, DEFAULT_MODEL };
