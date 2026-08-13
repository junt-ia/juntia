'use strict';

// Config Detector — Phase 12E of the Juntia migration.
//
// Presence-only, same discipline as manifest-detector.js: reports which
// known config filenames exist at the project root, never reads or
// interprets their content.

const fs = require('fs');
const path = require('path');

const KNOWN_CONFIGS = [
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'tsconfig.json',
  'jest.config.js',
  'babel.config.js',
];

function detectConfigs(projectRoot) {
  const found = [];
  for (const file of KNOWN_CONFIGS) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      found.push({ file, evidence: file });
    }
  }
  return found;
}

module.exports = { detectConfigs, KNOWN_CONFIGS };
