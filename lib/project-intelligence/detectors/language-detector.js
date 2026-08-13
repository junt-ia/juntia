'use strict';

// Language Detector — Phase 12E of the Juntia migration.
//
// Counts files by extension, bounded — never claims a language "dominates"
// or infers a project type from the counts. Skips common vendor/build
// directories and dotfiles/dotdirs so scanning a real repo doesn't walk
// node_modules or .git. A hard entry cap (MAX_ENTRIES_SCANNED) bounds
// traversal cost on large repositories rather than trying to be exhaustive.

const fs = require('fs');
const path = require('path');

const EXTENSION_LANGUAGES = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.cs': 'C#',
  '.java': 'Java',
};

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.venv', 'venv', '__pycache__', '.next', 'coverage',
]);

const MAX_ENTRIES_SCANNED = 5000;
const MAX_EVIDENCE_PER_LANGUAGE = 5;

function detectLanguages(projectRoot) {
  const counts = new Map(); // language -> { count, evidence: [] }
  let scanned = 0;

  function walk(dir) {
    if (scanned >= MAX_ENTRIES_SCANNED) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= MAX_ENTRIES_SCANNED) return;
      scanned += 1;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      const language = EXTENSION_LANGUAGES[path.extname(entry.name)];
      if (!language) continue;
      if (!counts.has(language)) counts.set(language, { count: 0, evidence: [] });
      const info = counts.get(language);
      info.count += 1;
      if (info.evidence.length < MAX_EVIDENCE_PER_LANGUAGE) {
        info.evidence.push(path.relative(projectRoot, path.join(dir, entry.name)));
      }
    }
  }

  walk(projectRoot);

  return [...counts.entries()]
    .map(([name, info]) => ({ name, fileCount: info.count, evidence: info.evidence }))
    .sort((a, b) => b.fileCount - a.fileCount);
}

module.exports = { detectLanguages, EXTENSION_LANGUAGES };
