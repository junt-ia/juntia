# Project Intelligence benchmark

Phase 12G. Measures the real Deterministic tier (`lib/project-intelligence/`) against real, external
repositories — not detector improvement. See [`report.md`](report.md) for the actual results and findings;
this file is methodology only.

## What's here

```
benchmark/
  repos.json          which real repos are in the benchmark, and why
  run-benchmark.js     runs the real scanner 3x per repo, writes results/<name>.json
  score-benchmark.js   compares results/ against expected/, writes scores.json
  expected/<name>.json  hand-verified ground truth per repo
  results/<name>.json   real scanner output, captured
  report.md             the actual findings
```

None of this ships in the published package (`package.json`'s `files` field doesn't list `benchmark/`).

## Reproducing

1. Get a local checkout of each repo named in `repos.json` (three are real, personal repositories not
   bundled with this package — one of them, `restaurant-game`, is private).
2. Run, from this package's root:

   ```
   JUNTIA_BENCH_JUNTIA_PATH=/path/to/juntia \
   JUNTIA_BENCH_CLAUDE_TOOLKIT_PATH=/path/to/claude-toolkit \
   JUNTIA_BENCH_RESTAURANT_GAME_PATH=/path/to/restaurant-game \
   JUNTIA_BENCH_APP_PODCASTER_PATH=/path/to/app-podcaster \
   node benchmark/run-benchmark.js
   ```

   Any repo whose environment variable isn't set is skipped, not failed — the benchmark degrades to
   whichever repos are actually available rather than requiring all four.

3. `node benchmark/score-benchmark.js` — compares the just-written `results/` against the committed
   `expected/` ground truth and prints coverage/false-positive/evidence-quality/stability per repo.

## How `expected/*.json` was built

Direct inspection, not guessing: each repo's real `package.json` was read in full, `ls -a` was run at each
repo's root, and file counts by extension were independently verified with `find` (excluding the same
directories the real detectors exclude). Where the independent count and the tool's own count disagreed
once (`app-podcaster`'s JavaScript count), the discrepancy was traced to a bug in the verification `find`
command itself, not the tool — see `report.md` for the full account.

Ground truth is scoped to the scanner's own known vocabulary (5 languages, 9 technologies, 6 config
filenames, 6 manifest filenames — the literal lists in `lib/project-intelligence/detectors/`), plus an exact,
exhaustive comparison of every real dependency and every real top-level structure entry. This measures
**how well the scanner detects what it claims to detect**, not "everything a human might find interesting
about a project" — real gaps outside that vocabulary (e.g. `pnpm-workspace.yaml`) are recorded explicitly
in each `expected/*.json`'s own `knownGaps` field and in `report.md`, not folded into the coverage score,
because scoring against an undeclared vocabulary would measure something the tool never claimed to do.
