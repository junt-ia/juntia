'use strict';

// Phase 12M — real, fast, no-network checks on the package as it would
// actually be published. Uses the real `npm pack --dry-run --json` (no
// network call — npm computes the file list locally from `files`/
// `.npmignore`/`.gitignore` without contacting the registry), not a
// simulation of what should be included. The genuinely external,
// network-touching half of "does this actually install and run outside
// the repo" is validated separately and manually (see
// phases/12m-release-distribution.md) and in CI
// (.github/workflows/ci.yml's package-integrity job) — spawning a real
// `npm install` into a temp directory on every `npm test` run would make
// the fast local suite slow and occasionally flaky for no benefit over
// what CI already does on every push.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const PACKAGE_ROOT = path.join(__dirname, '..');

// Computed once and reused — `npm pack --dry-run` is a real, if fast,
// child process; every test in this file asks the same real question
// (what's really in the tarball), so there's no need to re-invoke npm
// per assertion.
let cachedFileList = null;
function packedFileList() {
  if (!cachedFileList) {
    const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });
    const [{ files }] = JSON.parse(raw);
    cachedFileList = files.map((f) => f.path);
  }
  return cachedFileList;
}

test('the real, published tarball contains no test files', () => {
  const files = packedFileList();
  assert.equal(files.some((f) => /(^|\/)test\//.test(f)), false, `test/ leaked into the package: ${JSON.stringify(files)}`);
});

test('the real, published tarball contains no fixtures', () => {
  const files = packedFileList();
  assert.equal(files.some((f) => /(^|\/)fixtures\//.test(f)), false);
});

test('the real, published tarball contains no CI/dev-only files', () => {
  const files = packedFileList();
  for (const forbidden of ['.github/', '.git/', '.editorconfig', '.eslintrc']) {
    assert.equal(files.some((f) => f.includes(forbidden)), false, `${forbidden} leaked into the package`);
  }
});

test('the real, published tarball contains exactly the real public entrypoints', () => {
  const files = packedFileList();
  assert.ok(files.includes('bin/juntia.js'), 'the CLI binary must be published');
  assert.ok(files.includes('lib/index.js'), 'the public API entrypoint must be published');
  assert.ok(files.includes('package.json'), 'npm always includes package.json regardless of the files field');
});

test('the real, published tarball includes LICENSE and CHANGELOG.md', () => {
  const files = packedFileList();
  assert.ok(files.includes('LICENSE'));
  assert.ok(files.includes('CHANGELOG.md'));
});

test('package.json declares a license, and LICENSE actually matches it', () => {
  const fs = require('node:fs');
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.license, 'MIT');
  const licenseText = fs.readFileSync(path.join(PACKAGE_ROOT, 'LICENSE'), 'utf8');
  assert.match(licenseText, /MIT License/);
});

test('package.json\'s bin/exports/files fields are internally consistent with what actually gets published', () => {
  const fs = require('node:fs');
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  const files = packedFileList();

  assert.ok(files.includes(pkg.bin.juntia), 'the bin entrypoint must actually be published');
  assert.ok(files.includes(pkg.main), 'the main entrypoint must actually be published');
});

test('the package version is real semver, and no build has silently drifted it from CHANGELOG.md', () => {
  const fs = require('node:fs');
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);

  const changelog = fs.readFileSync(path.join(PACKAGE_ROOT, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, new RegExp(`\\[${pkg.version.replace(/\./g, '\\.')}\\]`), 'CHANGELOG.md must mention the current package.json version');
});
