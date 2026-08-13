'use strict';

// Structure Detector — Phase 12E of the Juntia migration.
//
// Lists the project root's own top-level entries only — deliberately
// shallow (not recursive) so this stays a mechanical listing, not a project
// map. Never names or classifies what a directory represents (e.g. never
// says "src/ is application code" or "assets/ is game art") — that's
// interpretation, out of scope for this phase.

const fs = require('fs');
const path = require('path');

// `.juntia` excluded since Phase 12I: once `juntia analyze` starts
// persisting a factual baseline there, the directory it just created would
// otherwise show up as a real "new structure" fact on every subsequent run
// — a false signal from Juntia's own bookkeeping, not a real project
// change. Found via a real, end-to-end two-run test, not assumed.
const SKIP_ENTRIES = new Set(['node_modules', '.git', '.juntia']);

function detectStructure(projectRoot) {
  let entries;
  try {
    entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return { directories: [], files: [] };
  }

  const directories = [];
  const files = [];
  for (const entry of entries) {
    if (SKIP_ENTRIES.has(entry.name)) continue;
    if (entry.isDirectory()) directories.push(entry.name);
    else files.push(entry.name);
  }

  return { directories: directories.sort(), files: files.sort() };
}

module.exports = { detectStructure };
