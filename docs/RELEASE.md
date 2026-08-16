# Release process

How `@juntia/juntia` gets from a commit on `main` to something a developer can `npm install` in a real
project — and the decisions behind why it works this way. Phase 12M built this; Phase 12M.5 made the first
real publish. See [`CHANGELOG.md`](../CHANGELOG.md) for exactly which versions are live on npm.

## The two workflows

- **`.github/workflows/ci.yml`** — runs on every push/PR to `main`. Two jobs: the real test suite across
  Node 18/20/22 (this package's own `engines.node` floor through two newer majors), and a package-integrity
  job that builds the real publishable tarball, asserts it contains no `test/`/`fixtures/`/`.github/` files,
  and installs that tarball into a genuinely external directory (a fresh `mktemp -d`, unrelated to the
  checkout) to confirm `juntia --version`/`init`/`analyze` actually work from there — the same real,
  copy-not-symlink distinction Phase 12F's own manual validation first established (`npm install
  /local/path` can silently symlink; only a tarball install proves independence).
- **`.github/workflows/release.yml`** — publishes to npm. Triggered *only* by a real GitHub Release being
  published against a `v*` tag (or an explicitly-confirmed manual re-run), never by an ordinary push. Runs
  the full test suite again, verifies the tag's version matches `package.json`, verifies that exact version
  isn't already on npm (refuses to silently no-op or clobber), then `npm publish --provenance --access
  public` using `NPM_TOKEN` from repository secrets — read only via the standard `NODE_AUTH_TOKEN`
  environment variable, never echoed, logged, or written to a file.

**Why a Release, not a bare tag push, triggers publishing**: a tag can be pushed as a side effect of a
script or a mistake; creating a GitHub Release is a deliberate, visible, human action in the GitHub UI (or an
explicit `gh release create`) — matching this migration's own standing discipline that a hard-to-reverse
public action (publishing a package for the first time, or any time) needs a deliberate trigger, not an
automatic one following from routine work.

## Versioning while 0.x

Following the common, real-world convention for pre-1.0 packages (not npm's own enforced rule — semver
itself leaves 0.x meaning up to the project):

- **PATCH** (`0.1.x`) — a real fix, doc correction, or internal change with no effect on documented CLI
  commands or the public `require('@juntia/juntia')` API.
- **MINOR** (`0.x.0`) — a new capability (a new command, a new field in an existing output) — **may include a
  breaking change** while still in 0.x, since the public surface is still stabilizing and this migration's
  own practice has been to revise a previous guarantee transparently rather than freeze prematurely (e.g.
  Phase 12I's `analyze` write-guarantee revision, Phase 12K's own EXISTING CONTEXT fix). Every such change is
  documented in `CHANGELOG.md`, never silent.
- **MAJOR** (`1.0.0`) — reserved for the first real stability commitment: a version where the CLI surface and
  public API are considered settled enough that a breaking change would require a new major, not a minor.
  No phase has proposed cutting `1.0.0` yet, and none should until real, sustained external usage (not just
  this migration's own validation runs) justifies it.

## Installing Juntia: local vs. global, evaluated

Brief-required evaluation, not a default preference:

| | `npm install -D @juntia/juntia` (local) | `npm install -g @juntia/juntia` (global) |
|---|---|---|
| First-run UX | `npx juntia <command>` (or a `package.json` script) — one extra word | `juntia <command>` directly — marginally simpler |
| Version consistency | Pinned in `package.json`/lockfile — every teammate and CI run uses the exact same version | Whatever happens to be globally installed on each machine — can silently drift between teammates |
| CI | Already covered by the project's normal `npm install` step — no extra CI configuration | Needs its own explicit global-install step; CI runners are ephemeral, so "global" buys nothing there |
| Matches ecosystem convention | Yes — the same pattern real projects already use for `eslint`/`prettier`/`vitest`/etc. | Common for quick, single-machine exploration, uncommon for project-pinned dev tooling |

**Recommended default: local (`-D`)**, for the same reason the rest of the JS ecosystem defaults project dev
tools to local — reproducibility across a team and CI is worth the one extra `npx`. Global install remains a
legitimate, simpler choice for a single developer quickly trying Juntia out on one machine, not for a real
team project. Real validation of the local path: see `phases/12m-release-distribution.md`'s installation
against a real external project.

## Cutting a real release (once npm publish is actually decided)

1. Update `CHANGELOG.md`: move `[Unreleased]` entries under a new `[x.y.z] - YYYY-MM-DD` heading.
2. Bump `package.json`'s `version` to match, per the versioning rules above.
3. Commit, push to `main`.
4. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. Create a GitHub Release from that tag (`gh release create vX.Y.Z --notes-from-tag` or via the UI) — this
   is the step that actually triggers `release.yml` and publishes to npm.

No step in this process runs automatically from routine development — every real publish starts with an
explicit, visible human action (step 5).
