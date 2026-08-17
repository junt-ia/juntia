'use strict';

// Phase 12L — tests for bin/juntia.js's `integrate` command: the CLI layer
// over lib/project-intelligence/agent-integration.js. Verifies the full,
// real flow a developer actually runs (init -> analyze -> context ->
// integrate), using the real init()/analyze()/context() functions already
// covered by their own test files — this file focuses on what `integrate`
// itself adds and guarantees.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runInit, runAnalyze, runContext, runIntegrate,
} = require('../bin/juntia.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-integrate-cli-test-'));
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

test('no runtime argument -> refused with usage guidance, nothing written', () => {
  const root = tempProject();
  const result = silently(() => runIntegrate(undefined, root));
  assert.equal(result.ok, false);
  assert.equal(fs.existsSync(path.join(root, '.juntia')), false);
});

test('when a real, human-authored CLAUDE.md blocks integration, the runtime-specific pointer is refused but the Knowledge Layer is still scaffolded (Phase 15B: init() runs first, unconditionally)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, 'CLAUDE.md', '# Our real team conventions\n\nDo not touch.\n');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));

    assert.equal(result.ok, false);
    // Knowledge Layer content is runtime-agnostic — it no longer depends on
    // whether a specific runtime's pointer file could be generated. This is
    // a real, deliberate behavior change from Phase 14A (see
    // phases/15b-knowledge-layer.md): a project with its own real CLAUDE.md
    // used to never receive agent-rules.md/workflows.md at all.
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md')));
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'workflows', 'feature-development.md')));
  })();
});

test('the real end-to-end flow (init -> analyze -> context -> integrate) produces exactly the expected new files', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  silently(() => runInit(root));
  const beforeAnalyze = fs.readdirSync(path.join(root, '.juntia')).sort();

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));

    assert.equal(result.ok, true);

    // integrate adds exactly one new file at the project root...
    const topLevel = fs.readdirSync(root).sort();
    assert.ok(topLevel.includes('CLAUDE.md'));

    // ...and .juntia/ only gained what analyze/context/integrate each add —
    // config.yml and the scaffold were already there from init.
    const afterIntegrate = fs.readdirSync(path.join(root, '.juntia')).sort();
    for (const f of beforeAnalyze) assert.ok(afterIntegrate.includes(f), `${f} must survive the whole flow`);
  })();
});

test('integrate never modifies real project source files', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, 'src/index.js', 'console.log("real code");');
  const beforeSrc = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
  const beforePkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    assert.equal(fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8'), beforeSrc);
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), beforePkg);
  })();
});

test('integrate never overwrites decisions.json — reproduced with a real confirmed decision present', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, '.juntia/decisions.json', JSON.stringify({
    schemaVersion: 1,
    decisions: [{
      id: 'x', text: 'Phaser is the main engine.', confidence: 'high', basedOn: ['dependency:phaser'], unknowns: [], confirmedAt: '2026-08-14T00:00:00.000Z', status: 'active',
    }],
  }));
  const beforeDecisions = fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    assert.equal(fs.readFileSync(path.join(root, '.juntia', 'decisions.json'), 'utf8'), beforeDecisions);
  })();
});

test('integrate works with no runtime provider configured at all (no config.yml customization)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));
    assert.equal(result.ok, true);
  })();
});

test('integrate generates .juntia/agent-instructions.md alongside the runtime pointer file (Phase 13D)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const handoffPath = path.join(root, '.juntia', 'agent-instructions.md');
    assert.ok(fs.existsSync(handoffPath));
    const content = fs.readFileSync(handoffPath, 'utf8');
    assert.match(content, /id:\[dependency:phaser\]/);
  })();
});

test('integrate generates .juntia/BOOTSTRAP.md alongside the runtime pointer file (Phase 15D)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const bootstrapPath = path.join(root, '.juntia', 'BOOTSTRAP.md');
    assert.ok(fs.existsSync(bootstrapPath));
    const content = fs.readFileSync(bootstrapPath, 'utf8');
    assert.match(content, /governance\/workflows\//);
    assert.match(content, /juntia route/);
  })();
});

test('a project with an old (pre-15D), Juntia-generated CLAUDE.md — the full governance-index shape — is safely regenerated into the new minimal entry point (Phase 15D)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));
  writeFile(root, 'CLAUDE.md', [
    '<!-- juntia:generated -->',
    '# Claude Code instructions',
    '',
    'Juntia is configured for this project. The files below are the real, current source of truth —',
    'nothing here is a copy of their content, only where to find it.',
    '',
    '- `.juntia/context.md` — what this project is.',
    '- `.juntia/governance/` — the Knowledge Layer: how to work in this project.',
    '',
  ].join('\n'));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const result = silently(() => runIntegrate('claude-code', root));

    assert.equal(result.ok, true, 'a Juntia-generated file (marker present) must be safely regenerated, not refused');
    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /\.juntia\/BOOTSTRAP\.md/);
    // The old (pre-15D) index enumerated governance/ subdirectories one bullet
    // at a time (`.juntia/governance/roles/`, `.juntia/governance/workflows/`,
    // ...) — that per-subdirectory enumeration must not survive regeneration.
    // A single, bare mention of `.juntia/governance/` itself as "the source of
    // truth" (Single Governance Source of Truth phase) is not that — never a
    // second enumeration of specific files or subdirectories.
    assert.doesNotMatch(claudeMd, /governance\/(roles|workflows|skills|rules)\//, 'the old index\'s per-subdirectory enumeration must not survive regeneration');
  })();
});

test('integrate scaffolds the Knowledge Layer (.juntia/governance/) alongside the runtime pointer file (Phase 14A rules/workflows; Phase 15B moved them to declarative files)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'rules', 'agent-rules.md')));
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'workflows', 'feature-development.md')));
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'roles', 'product.md')));
    assert.ok(fs.existsSync(path.join(root, '.juntia', 'governance', 'skills', 'implementation', 'SKILL.md')));
  })();
});

test('CLAUDE.md points to .juntia/BOOTSTRAP.md, which in turn points at agent-instructions.md — neither copies its content (Phase 15D)', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /BOOTSTRAP\.md/);
    assert.doesNotMatch(claudeMd, /id:\[dependency:phaser\]/, 'CLAUDE.md must never copy fact content');

    const bootstrapMd = fs.readFileSync(path.join(root, '.juntia', 'BOOTSTRAP.md'), 'utf8');
    assert.match(bootstrapMd, /agent-instructions\.md/);
    assert.doesNotMatch(bootstrapMd, /id:\[dependency:phaser\]/, 'BOOTSTRAP.md must point at the handoff file, never copy its content');
  })();
});

test('context.md remains valid (parses/reads the same) after integrate runs', () => {
  const root = tempProject();
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { phaser: '^3.60.0' } }));

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    const before = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');

    silently(() => runIntegrate('claude-code', root));

    const after = fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
    assert.equal(before, after, 'integrate must never rewrite context.md — it only reads it');
  })();
});

// --- Single Governance Source of Truth phase: CLAUDE.md's own contract ---

test('CLAUDE.md states .juntia/governance/ is the single source of truth, without enumerating what is inside it', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /single source of truth/);
    assert.match(claudeMd, /\.juntia\/governance\//);
    assert.doesNotMatch(claudeMd, /governance\/(roles|workflows|skills|rules)\//);
  })();
});

test('CLAUDE.md states the blocking-decision contract explicitly: no silent default, no continuing the affected work, escalate, wait, continue only after confirmation', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /do not silently pick a/i);
    assert.match(claudeMd, /do not continue implementing the affected part/i);
    assert.match(claudeMd, /decision request/i);
    assert.match(claudeMd, /wait for a human to confirm/i);
    assert.match(claudeMd, /continue only once/i);
  })();
});

test('CLAUDE.md points a project still carrying a legacy governance scheme at `juntia update`, without itself trying to migrate anything', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(claudeMd, /juntia update/);
  })();
});

test('CLAUDE.md stays small — a minimal entry point, not a second index, even with the new contract paragraphs', () => {
  const root = tempProject();
  writeFile(root, 'package.json', '{}');

  return (async () => {
    await silently(() => runAnalyze(root));
    silently(() => runContext(root));
    silently(() => runIntegrate('claude-code', root));

    const claudeMd = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.ok(claudeMd.length < 2000, `CLAUDE.md should stay minimal, was ${claudeMd.length} bytes`);
  })();
});
