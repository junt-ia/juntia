'use strict';

// Confirmation Channel Hardening phase — real, evidenced reproduction of the
// M04 v2 dogfooding finding: `juntia confirm` worked when answered via
// `< file` redirection but failed SILENTLY over a shell pipe
// (`printf "answer" | juntia confirm`). Traced (see bin/juntia.js's own
// `createDefaultPromptSession` header) to two real bugs, both only visible
// once a real, non-injected default prompt reads from a real, non-TTY
// stdin — every other test in this codebase injects a scripted `prompt`
// function and so never exercised the actual code path that broke:
//
//   1. `readline/promises`' `rl.question()` never resolves for a final,
//      unterminated line (no trailing `\n` — `printf` vs. `echo`, which
//      appends one) once the stream reaches EOF.
//   2. A second `readline.Interface` created for a second question, on the
//      same already-flowing non-TTY stdin, silently drops what the first
//      interface had already buffered — the process exits (nothing left to
//      keep the event loop alive) without ever asking, recording, or
//      erroring: a genuinely SILENT failure, not just a hang.
//
// These tests spawn the real CLI binary as a child process — the only way
// to actually exercise `createDefaultPromptSession()` (an injected `prompt`
// test double bypasses it entirely) and the only way to tell "hangs" and
// "fails silently" apart from "works."

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { init } = require('../bin/juntia.js');
const { upsertDecisionRequest } = require('../lib/project-intelligence/pending-store.js');
const { loadDecisions } = require('../lib/project-intelligence/decisions-store.js');
const { loadPending } = require('../lib/project-intelligence/pending-store.js');

const BIN = path.join(__dirname, '..', 'bin', 'juntia.js');
const CHILD_TIMEOUT_MS = 10000;

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'juntia-confirm-io-test-'));
}

// The "pipe" channel: Node's own `spawnSync({ input })` writes the given
// bytes into a real anonymous pipe attached to the child's stdin, then
// closes it — bit-for-bit the same mechanism a shell's `producer | juntia
// confirm` uses. `inputText` is passed through EXACTLY as given — callers
// control the trailing newline themselves, since that is the exact
// difference between the dogfooding report's two cases (`echo` appends one,
// `printf` does not).
function runConfirmViaPipe(root, inputText) {
  return spawnSync(process.execPath, [BIN, 'confirm'], {
    cwd: root, input: inputText, encoding: 'utf8', timeout: CHILD_TIMEOUT_MS,
  });
}

// The "file redirection" channel: a REAL file, opened once, its file
// descriptor handed to the child as fd 0 — bit-for-bit what a shell's
// `juntia confirm < answers.txt` does (never Node's own `input` pipe
// plumbing, which is a different underlying mechanism even though both
// present as "non-TTY stdin" to the child process).
function runConfirmViaFile(root, inputText) {
  const filePath = path.join(root, '..', `${path.basename(root)}-answers.txt`);
  fs.writeFileSync(filePath, inputText);
  const fd = fs.openSync(filePath, 'r');
  try {
    return spawnSync(process.execPath, [BIN, 'confirm'], {
      cwd: root, stdio: [fd, 'pipe', 'pipe'], encoding: 'utf8', timeout: CHILD_TIMEOUT_MS,
    });
  } finally {
    fs.closeSync(fd);
    fs.rmSync(filePath, { force: true });
  }
}

function assertRanToCompletion(result, label) {
  assert.equal(result.error, undefined, `${label}: spawn itself failed — ${result.error && result.error.message}`);
  assert.equal(result.signal, null, `${label}: process was killed (signal ${result.signal}) — this is the hang/timeout failure mode`);
  assert.equal(result.status, 0, `${label}: exited non-zero (stderr: ${result.stderr})`);
}

function seedProduct(root, question, extra = {}) {
  return upsertDecisionRequest(root, { type: 'product', question, options: [], ...extra });
}

// --- Case B from the dogfooding report: `printf "answer" | juntia confirm` -

test('a single decision answered via a pipe with NO trailing newline (printf, not echo) completes — the exact silent-failure case from M04 v2 dogfooding', () => {
  const root = tempProject();
  init(root);
  seedProduct(root, 'What timeout should the wait screen use?');

  const result = runConfirmViaPipe(root, 'respuesta-pipe');
  assertRanToCompletion(result, 'pipe, no trailing newline');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, 'respuesta-pipe');
  assert.equal(decisions[0].source, 'human');
  assert.match(fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8'), /respuesta-pipe/);
});

// --- Case A from the dogfooding report: file redirection ------------------

test('a single decision answered via real file redirection (with a trailing newline, like `echo > file`) completes', () => {
  const root = tempProject();
  init(root);
  seedProduct(root, 'What timeout should the wait screen use?');

  const result = runConfirmViaFile(root, 'respuesta-archivo\n');
  assertRanToCompletion(result, 'file redirection, trailing newline');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].text, 'respuesta-archivo');
});

// --- The second, deeper bug: more than one question over the same non-TTY -
// stdin. Reproduced this codebase's OLD per-question `readline.Interface`
// design silently dropping the second question — see this file's own header.

test('two decisions answered via a pipe both get recorded, in order — the real second-question bug, independent of trailing newlines', () => {
  const root = tempProject();
  init(root);
  seedProduct(root, 'Q1: how many lives?');
  seedProduct(root, 'Q2: how many points per item?');

  const result = runConfirmViaPipe(root, 'three\nten');
  assertRanToCompletion(result, 'pipe, two questions');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);
  const byQuestion = Object.fromEntries(decisions.map((d) => [d.question, d.text]));
  assert.equal(byQuestion['Q1: how many lives?'], 'three');
  assert.equal(byQuestion['Q2: how many points per item?'], 'ten');
});

test('two decisions answered via real file redirection both get recorded, in order', () => {
  const root = tempProject();
  init(root);
  seedProduct(root, 'Q1: how many lives?');
  seedProduct(root, 'Q2: how many points per item?');

  const result = runConfirmViaFile(root, 'three\nten\n');
  assertRanToCompletion(result, 'file redirection, two questions');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 2);
  const byQuestion = Object.fromEntries(decisions.map((d) => [d.question, d.text]));
  assert.equal(byQuestion['Q1: how many lives?'], 'three');
  assert.equal(byQuestion['Q2: how many points per item?'], 'ten');
});

// --- A confirm session asked more questions than the input answered must --
// never hang — it must resolve the exhausted questions as "no answer yet"
// (the same semantics a blank interactive answer already has: still
// pending) rather than block forever waiting for bytes that will never
// arrive.

test('running out of piped answers mid-session never hangs — the unanswered item stays genuinely pending, not lost and not silently confirmed', () => {
  const root = tempProject();
  init(root);
  seedProduct(root, 'Q1: answered');
  seedProduct(root, 'Q2: never answered');

  const result = runConfirmViaPipe(root, 'first-answer');
  assertRanToCompletion(result, 'pipe, fewer answers than questions');

  const { decisions } = loadDecisions(root);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].question, 'Q1: answered');

  const { items } = loadPending(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].question, 'Q2: never answered');
  assert.equal(items[0].status, 'pending');
});

// --- Parity: interactive-simulated, pipe, and file must reach the exact ---
// same final state for the exact same answer — the real requirement behind
// this whole phase ("no caminos diferentes según el origen del input").

function stripVolatile(decisions) {
  return decisions.map(({ confirmedAt, ...rest }) => rest);
}

test('interactive (scripted prompt), pipe, and file redirection all produce the identical decisions.json content (modulo confirmedAt) for the identical answer', async () => {
  const { runConfirm } = require('../bin/juntia.js');
  const question = 'What timeout should the wait screen use?';

  const interactiveRoot = tempProject();
  init(interactiveRoot);
  seedProduct(interactiveRoot, question);
  const originalLog = console.log;
  console.log = () => {};
  try {
    await runConfirm(interactiveRoot, { prompt: async () => 'same-answer' });
  } finally {
    console.log = originalLog;
  }

  const pipeRoot = tempProject();
  init(pipeRoot);
  seedProduct(pipeRoot, question);
  assertRanToCompletion(runConfirmViaPipe(pipeRoot, 'same-answer'), 'parity: pipe');

  const fileRoot = tempProject();
  init(fileRoot);
  seedProduct(fileRoot, question);
  assertRanToCompletion(runConfirmViaFile(fileRoot, 'same-answer\n'), 'parity: file');

  const interactiveDecisions = stripVolatile(loadDecisions(interactiveRoot).decisions);
  const pipeDecisions = stripVolatile(loadDecisions(pipeRoot).decisions);
  const fileDecisions = stripVolatile(loadDecisions(fileRoot).decisions);

  assert.deepEqual(pipeDecisions, interactiveDecisions, 'pipe must match interactive exactly, aside from confirmedAt');
  assert.deepEqual(fileDecisions, interactiveDecisions, 'file redirection must match interactive exactly, aside from confirmedAt');

  // DECISIONS.md/context.md embed only a day-granularity date, so within a
  // single test run they should be byte-identical across all three channels.
  const decisionsMd = (root) => fs.readFileSync(path.join(root, '.juntia', 'DECISIONS.md'), 'utf8');
  const contextMd = (root) => fs.readFileSync(path.join(root, '.juntia', 'context.md'), 'utf8');
  assert.equal(decisionsMd(pipeRoot), decisionsMd(interactiveRoot));
  assert.equal(decisionsMd(fileRoot), decisionsMd(interactiveRoot));
  assert.equal(contextMd(pipeRoot), contextMd(interactiveRoot));
  assert.equal(contextMd(fileRoot), contextMd(interactiveRoot));
});

// --- `source: 'human'` is recorded identically regardless of channel — the
// value describes which CHANNEL the confirmation went through, not who was
// physically at the keyboard (see decisions-store.js's own updated header
// and docs/CONTEXT_SYNTHESIS.md for the honesty rewrite this phase makes).

test('source: "human" is recorded the same way whether the answer arrived via pipe or file redirection', () => {
  const pipeRoot = tempProject();
  init(pipeRoot);
  seedProduct(pipeRoot, 'Q?');
  assertRanToCompletion(runConfirmViaPipe(pipeRoot, 'a'), 'source field via pipe');
  assert.equal(loadDecisions(pipeRoot).decisions[0].source, 'human');

  const fileRoot = tempProject();
  init(fileRoot);
  seedProduct(fileRoot, 'Q?');
  assertRanToCompletion(runConfirmViaFile(fileRoot, 'a\n'), 'source field via file');
  assert.equal(loadDecisions(fileRoot).decisions[0].source, 'human');
});
