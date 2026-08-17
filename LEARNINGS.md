# Learnings

Real, evidenced lessons from building Juntia — kept so a later phase doesn't relearn them the hard way.
Append-only, newest first within each entry's own topic.

## A validator's "optional field" check needs to agree with what the trusted normalizer actually writes for "absent"

`validateDecisionRequest` checked `parsed.context !== undefined` to mean "the field is present" — but
`pending-store.js#upsertDecisionRequest`, the trusted function that actually builds a stored item, writes
`context: request.context || null` for an omitted field: `null`, not `undefined`. The mismatch was latent for
`context` because every existing test always supplied one; adding a new optional field (`reason`) with the
exact same default pattern hit it immediately — every decision request omitting the new field failed
validation with a confusing "reason, if present, must be a string," even though it wasn't present at all, only
`null`. **Next time:** when a validator and a normalizer disagree about what "absent" looks like on the wire,
the bug is invisible until a test finally omits the field — write that test, or check the normalizer's own
default value directly, before trusting a validator's `!== undefined` check on a field a trusted writer might
null-default.

## A real conflict-resolution rule only becomes obvious once there's a real second copy to compare against

`docs/CLI.md` left `juntia update` unbuilt for phases specifically because "no evidence yet dictates the right
conflict-resolution rule" for a scaffolded file a developer might have edited. The rule that finally worked —
compare the new location's current content to the stock template; identical means safe to overwrite, different
means a real conflict — didn't require anything clever, but it did require a second, real thing to diff
against (the actual template file on disk) that a purely `fs.existsSync` check (what `init()`'s own
"never overwrite" rule already used) can't provide. Recognizing that content, not existence, was the real
diffing key was the whole design. **Next time:** when a "does this need updating" question has stalled on "no
right rule yet," check whether the real blocker is that no real second copy of the content exists yet to
compare against — the rule can be almost mechanical once one does.

## A documented example that's missing the wrapper IS the contract, as far as an agent is concerned

`agent-rules.md` showed a decision request as a single bare object — `{ "type": "product", ... }` — and never
once showed the actual document `pending.json` needs to be. It was technically true (that IS the shape of one
request) and practically wrong (nothing told an agent what to do with more than one, or how to wrap it), and a
real agent, needing to write more than one request, produced exactly the plausible-but-rejected shape: a bare
JSON array. The fix wasn't just widening what Core accepts — the documentation itself had never stated the
complete contract, only a fragment of it. **Next time:** when documentation shows an example of "one of," show
the real container it lives inside too, at least once, completely — a technically-accurate fragment is not
the same as a complete contract, and an agent will fill the gap with whatever's most plausible, not necessarily
what Core actually validates.

## A single-pass "before X" instruction teaches "check once," even when the mechanism it points to is reusable

`governance-review`'s first version (Phase 15G) built a real, correct escalation mechanism and then told
agents to invoke it at exactly one point: "immediately before implementation." The mechanism itself never
stopped being usable more than once — but the instruction taught a stronger lesson than its own words:
"do this, then move on," not "do this whenever it applies." A later dogfooding session found agents treating
it as satisfied after one pass, silently guessing at decisions that only became concrete afterward — the exact
failure the mechanism was built to prevent, reintroduced by how its own trigger condition was worded. Fixing it
required no new mechanism, only rewording `when_to_use` from a fixed point in a sequence to a recurring
condition, everywhere that sequence was described (workflow files, role files, generated prose). **Next time:**
when writing a trigger condition for a reusable capability, check whether the wording itself implies "once" —
timing language leaks into behavior at least as much as the mechanism's own correctness does.

## Regenerating the summary file is not the same as regenerating the file the agent is actually reading

`juntia confirm` refreshed `.juntia/context.md` correctly from Phase 12K onward — that was never the bug. The
real gap a live Snake dogfooding session found was one level over: `.juntia/task-handoff.md`, the file an agent
is actually mid-task against once work has started, was written once by `route` and never touched again. A
downstream, "always current" file being correct is not the same claim as "the file the agent will next open is
current" — those can silently diverge the moment an agent moves from orientation (read once, at session start)
into an active task (reads a narrower, task-scoped file instead). **Next time:** when adding a state change
that needs to reach an agent, name the SPECIFIC file the agent reads at the point it needs the information, not
just "a file that has the right data somewhere in the project."

## Recovering state from an already-embedded structured block avoids duplicating it

`refreshTaskHandoffDecisions` needs to regenerate `task-handoff.md` without re-classifying the request (the
workflow/roles/skills don't change just because a decision was confirmed) and without blowing the file's own
pre-existing, tested 5000-byte budget. The first design duplicated the full `route` object into a second,
separate JSON comment for round-tripping; the actual fix was recovering it from the Agent Context JSON block
the file already embeds for the agent's own use, via a small, lossless inverse of the function that built it.
**Next time:** before adding a second copy of structured state to a generated file "just for internal
round-tripping," check whether the file already carries an equivalent, human-facing copy that can be parsed
back instead.

## "Applied" is a claim about code Juntia cannot verify — don't persist it as if it could

Distinguishing pending/confirmed/applied decision states was tempting to build as a fourth persisted status,
settable by an agent once it believes it finished. Rejected: Juntia never patches source code, so it has no way
to check whether an "applied" flag is actually true — a self-reported one would let a decision look resolved
without being resolved. Scoping "new" to the current task's own lifetime (a fresh `route` call resets the
baseline) gives the same practical signal — has this decision had a chance to be acted on yet — without ever
asserting something about code state Juntia did not check. **Next time:** when a status would require trusting
an agent's own self-report about code correctness, look for a structural proxy (like task boundaries here)
before adding the status.

## "Kept for compatibility" needs an exit condition, not just a label

The legacy reasoning layer sat in the codebase for five phases (15A through this one) marked "legacy, unwired,
not removed yet" with no concrete condition for when removal would actually happen — only "no eliminar
todavía" repeated phase after phase. It was real, evidenced logic worth double-checking before deleting, but
the label alone didn't force a decision; it took an explicit new phase, requested from outside the migration's
own step-by-step momentum, to actually close it out. **Next time:** when marking something "kept, not
removed, for now," name the actual condition that would justify removing it — not just restate that it hasn't
been removed yet.

## Deleting a module and re-running the full suite immediately is what catches a real, hidden dependency

`lib/runtime/validator.js` looked, from its own consumer list, like it was only ever used by the (also being
deleted) `intent-runtime-bridge.js`. It wasn't: `lib/runtime/project-interpretation-validator.js` — the
*active* AI Handoff validator, unrelated in domain — imported two shared constants from it
(`FORBIDDEN_GOVERNANCE_KEYS`, `ALLOWED_CONFIDENCE`). A `grep` for direct requires caught the file path but a
prose comment ("the intent-domain validator this file is deliberately modeled on, reusing its constants") was
what actually explained *why* the coupling existed — running `npm test` right after the deletion is what
surfaced the failure concretely, not the grep alone. **Next time:** treat "nothing else requires this file" as
a hypothesis to verify with a full test run, not a grep result to trust on its own.

## A signal-based mechanism can escalate AND de-escalate with one rule, if the "no signals declared" case is the only one that reads the base level

The dynamic governance level design initially risked conflating two different needs — escalating a request
above its workflow's default, and letting a genuinely trivial one resolve below it — into two different
mechanisms. One rule turned out to cover both: with no declared signals, use the base; with any declared and
recognized, use the highest level among *only* those signals (never blended with the base). This is also why
the design stayed backward-compatible for free — every existing caller that never passes `signals` gets
byte-identical output, because the "no signals" branch is exactly the old behavior. **Next time:** when a new
optional input can move a value in either direction, check whether "ignore the old default entirely once the
new input is present" is simpler than trying to blend old and new — it was here.

## A "static default + declarative override" shape recurs in this codebase — worth naming as a pattern

`governance-levels.js`'s per-workflow default, `decision-triggers.js`'s catalog of situations an agent applies
judgment to, and now `governance-signals.js`'s catalog of declarable overrides are the same underlying shape:
a small, curated, human-editable Knowledge Layer file; a Core module that reads it and does one deterministic
computation; and an explicit refusal to ever match it against free text automatically. Worth reusing
deliberately, not reinventing, the next time Juntia needs "a project can extend/override a small fixed
catalog of named things."
