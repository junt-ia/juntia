'use strict';

// Project Intelligence Scanner — Phase 12E of the Juntia migration.
//
// Deterministic-only project inventory: detects observable facts (files,
// manifests, dependencies) and always keeps them traceable to evidence
// (a file path, a manifest key). Never interprets what those facts mean —
// no project "type" is ever computed or reported, per this phase's own
// explicit boundary (`phases/12e-deterministic-project-intelligence.md`):
// finding a `phaser` dependency is a fact; concluding "this is a video
// game" is an INFERRED interpretation that belongs to a future AI-assisted
// layer, not this one.
//
// Internal-only: not re-exported from lib/index.js (Phase 12C's Public
// API / internal engine boundary) — `bin/juntia.js`'s `analyze` command is
// the sanctioned entrypoint to this capability.

const { detectManifests } = require('./detectors/manifest-detector.js');
const { detectLanguages } = require('./detectors/language-detector.js');
const { detectDependencies } = require('./detectors/dependency-detector.js');
const { detectStructure } = require('./detectors/structure-detector.js');
const { detectConfigs } = require('./detectors/config-detector.js');

function scanProject(projectRoot) {
  const manifests = detectManifests(projectRoot);
  const configs = detectConfigs(projectRoot);
  const { dependencies, technologies: dependencyTechnologies } = detectDependencies(projectRoot);
  const languages = detectLanguages(projectRoot);
  const structure = detectStructure(projectRoot);

  // A config filename like `vite.config.js` is evidence of the same tool a
  // `dependencies` entry named `vite` already reports — mechanical string
  // extraction (strip `.config.js`/`.config.ts`), not semantic inference.
  // Skipped when it would just duplicate a dependency-derived technology
  // already found; kept as the literal filename otherwise (e.g.
  // `tsconfig.json`, which names no separate tool).
  const dependencyTechNames = new Set(dependencyTechnologies.map((t) => t.name.toLowerCase()));
  const configTechnologies = configs
    .filter((c) => {
      const match = c.file.match(/^([a-z0-9-]+)\.config\.(js|ts)$/i);
      return !(match && dependencyTechNames.has(match[1].toLowerCase()));
    })
    .map((c) => ({ name: c.file, source: 'config file', evidence: [c.evidence] }));

  const technologies = [...dependencyTechnologies, ...configTechnologies];

  // Every fact this scanner reports is duplicated here as a flat, ordered
  // observation log — useful for a caller that wants "everything found,
  // in one list" without walking identity/structure/dependencies
  // separately. Deliberately not the only place evidence lives (each fact
  // also carries its own `evidence` field) — two views of the same,
  // non-invented data, not two sources of truth.
  const evidence = [
    ...manifests.map((m) => ({ type: 'manifest', detail: m.file, source: m.evidence })),
    ...configs.map((c) => ({ type: 'config', detail: c.file, source: c.evidence })),
    ...languages.flatMap((l) => l.evidence.map((path) => ({ type: 'language', detail: l.name, source: path }))),
    ...dependencies.map((d) => ({ type: 'dependency', detail: d.name, source: d.source })),
  ];

  return {
    identity: {
      languages: languages.map(({ name, fileCount, evidence: langEvidence }) => ({
        name, fileCount, evidence: langEvidence,
      })),
      technologies,
    },
    structure,
    dependencies,
    manifests: manifests.map((m) => m.file),
    evidence,
  };
}

module.exports = { scanProject };
