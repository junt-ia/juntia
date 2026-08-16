'use strict';

// Phase 15D — cross-module tests for the Agent Consumption Model as a
// whole: the real chain an external agent follows (CLAUDE.md ->
// BOOTSTRAP.md -> route -> task-handoff.md) and the "no duplicated
// information" property the brief requires across that chain. Individual
// modules (`bootstrap.js`, `agent-context.js`) have their own dedicated
// test files; this one verifies the composition.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runAnalyze, runContext, runIntegrate, runRoute } = require('../bin/juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-agent-consumption-test-'));
}

function writeFile(root, relativePath, content) {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function silently(fn) {
  const originalLog = console.log;
  console.log = () => {};
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { console.log = originalLog; });
  }
  console.log = originalLog;
  return result;
}

test('the full chain — CLAUDE.md -> BOOTSTRAP.md -> route -> task-handoff.md — each level points at the next without repeating its content', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));
    silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    const bootstrapMd = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
    const taskHandoffMd = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');

    // CLAUDE.md: a real entry point only — points at BOOTSTRAP.md, contains
    // none of the deeper detail BOOTSTRAP.md or task-handoff.md carry.
    assert.match(claudeMd, /BOOTSTRAP\.md/);
    assert.doesNotMatch(claudeMd, /feature-development/);
    assert.doesNotMatch(claudeMd, /governance\/roles\//);

    // BOOTSTRAP.md: explains navigation, points at route/task-handoff, but
    // never contains this specific request's own resolved workflow name —
    // that's per-request, task-handoff.md's job.
    assert.match(bootstrapMd, /juntia route/);
    assert.match(bootstrapMd, /task-handoff\.md/);
    assert.doesNotMatch(bootstrapMd, /feature-development/, 'BOOTSTRAP.md must stay request-agnostic');

    // task-handoff.md: the one file that actually names this request's real,
    // resolved workflow/roles/skills.
    assert.match(taskHandoffMd, /feature-development/);
    assert.match(taskHandoffMd, /product/i);
  })();
});

test('an external agent can get from CLAUDE.md to a fully-resolved Agent Context without a human explaining the architecture — every step is a real, followable pointer', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    // Step 1: the agent reads CLAUDE.md and finds a real pointer.
    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    const bootstrapMatch = claudeMd.match(/`(\.juntia\/BOOTSTRAP\.md)`/);
    assert.ok(bootstrapMatch, 'CLAUDE.md must name a real, followable path to BOOTSTRAP.md');
    assert.ok(fs.existsSync(path.join(root, bootstrapMatch[1])));

    // Step 2: BOOTSTRAP.md names the real command to run for a specific request.
    const bootstrapMd = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
    assert.match(bootstrapMd, /juntia route "<the request/);

    // Step 3: running it (as the agent would) produces a real, resolved Agent Context.
    const route = silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));
    assert.equal(route.workflow, 'feature-development');
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'task-handoff.md')));
  })();
});

test('the agent receives enough to start working without a full copy of the project — task-handoff.md stays small, pointer-shaped, never a project dump', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  // A large, unrelated source file — must never leak into any generated file.
  writeFile(root, 'src/big-module.js', 'x'.repeat(50000));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));
    silently(() => runRoute('Implementa clientes VIP en el restaurante.', root));

    const taskHandoffMd = fs.readFileSync(path.join(root, '.juntia', 'task-handoff.md'), 'utf8');
    assert.ok(taskHandoffMd.length < 5000, `task-handoff.md should stay small and pointer-shaped, was ${taskHandoffMd.length} bytes`);
    assert.doesNotMatch(taskHandoffMd, /x{100}/, 'must never contain real project source content');
  })();
});
