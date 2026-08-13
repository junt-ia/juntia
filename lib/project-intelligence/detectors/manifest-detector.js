'use strict';

// Manifest Detector — Phase 12E of the Juntia migration.
//
// Presence-only: reports which known manifest/lockfiles exist at the
// project root. Never interprets what a manifest means beyond "it exists" —
// dependency-detector.js is the only detector that reads package.json's
// content.

const fs = require('fs');
const path = require('path');

const KNOWN_MANIFESTS = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'requirements.txt',
  'pyproject.toml',
];

function detectManifests(projectRoot) {
  const found = [];
  for (const file of KNOWN_MANIFESTS) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      found.push({ file, evidence: file });
    }
  }
  return found;
}

module.exports = { detectManifests, KNOWN_MANIFESTS };
