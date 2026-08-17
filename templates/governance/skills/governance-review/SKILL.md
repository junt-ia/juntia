---
name: governance-review
description: The moment a real, workflow-declared decision area becomes concretely relevant to the specific piece of work in front of you, check whether it's already resolved, and escalate it right then — not a single pass done once before implementation starts.
role: any — Product, Architect, Engineer, or QA, whichever is actually doing the work when the decision becomes concrete.
when_to_use: Any time, during any step of a workflow, a decision area that workflow declares (see its own "Decisions this workflow may require" section, or `workflow.decisionAreas` in the Agent Context / task handoff) stops being abstract and starts being a real, specific unknown blocking the piece of work in front of you. This can happen during product reasoning, architecture reasoning, implementation, or QA — and can happen more than once in the same task, as different areas become concrete at different points. Never a single review pass done once, before starting, for the whole feature at once.
inputs:
  - the specific decision area that just became concrete (not the workflow's full declared list — only the one in front of you right now)
  - .juntia/pending.json (anything already awaiting a human answer)
  - .juntia/DECISIONS.md (anything already decided)
  - .juntia/governance/rules/decision-triggers.md (optional — common situations worth recognizing, and whether each is BLOCKING or non-blocking; see below)
process:
  - Recognize the specific decision area in front of you right now — not the workflow's whole declared list, just the one this exact piece of work needs answered to proceed correctly.
  - Check .juntia/DECISIONS.md first — do not treat an already-decided area as still open.
  - Check .juntia/pending.json — do not create a duplicate request for something already awaiting a human answer.
  - Decide BLOCKING vs. non-blocking using `.juntia/governance/rules/decision-triggers.md`'s own declared `Requires confirmation` field for whichever situation matches — never your own inference from how important the question feels. `yes` is blocking; `no` is non-blocking; a real, applicable situation not in that catalog at all still needs your own judgment, the same as always.
  - If non-blocking, use your own reasonable judgment and continue — optionally noting the choice, without waiting for a human.
  - If blocking, escalate it as a decision request (`product-decision-making` or `architecture-decision-record`, depending on type) right now — do not keep working on the specific piece of work that depends on the answer.
  - Pause only that piece of work. An independent part of the same task that doesn't depend on this answer can continue.
  - Once a human answers via `juntia confirm`, `.juntia/task-handoff.md` is refreshed automatically with the confirmed decision — re-read its "Confirmed decisions" section and resume the paused work from there, using the real confirmed answer.
expected_output: Either a short confirmation that this specific decision area is already resolved or genuinely not blocking, or one new decision request in .juntia/pending.json for it, written the moment it became concrete — never predicted in advance for the whole feature, never deferred until the feature otherwise looks finished.
constraints:
  - Does not decide any area itself — only recognizes and escalates.
  - Does not try to enumerate and resolve every decision area a workflow declares before starting — that's exactly the failure mode this skill exists to avoid (see below).
  - Does not treat every listed area as automatically blocking — most requests resolve most areas from their own stated content or an existing decision; only decision-triggers.md's own declared field (or clear, applicable precedent) marks one BLOCKING.
  - Does not re-ask about an area a confirmed decision or an existing pending item already covers.
  - Does not infer "blocking" from how the question reads — that determination comes from the declarative catalog, or explicit human-set project convention, never free-text judgment about importance.
---

Grounded in two real, evidenced gaps, from two separate dogfooding sessions, not designed speculatively:

**Phase 15G** found that `product-decision-making`/`architecture-decision-record` are real, correct procedures
for recognizing and escalating a decision — but both activate reactively, once an agent already notices it's
guessing. The `restaurant-game` failure mode was an agent never pausing to check *before* writing a value into
code at all. This skill was built as that pause.

**Phase 16B** found that the first version of this skill fixed that gap by creating a new one: framing the
pause as a single, discrete step — "immediately before implementation" — taught agents to treat it as one
checklist pass done once, early, rather than a standing capability. In practice, a real feature's decisions
didn't all become concrete before implementation started; some only became real partway through, and by then
the agent had already moved past the one point where it had been taught to check. Two of four decisions in
that session reached the game's code as silent, unconfirmed guesses specifically because the agent had
"already done governance-review" earlier and had no cue to invoke it again.

This version fixes that: `when_to_use` names a recurring trigger condition — the moment a decision area
becomes concrete — not a fixed point in the workflow's sequence. The same escalation mechanism
(`product-decision-making`/`architecture-decision-record` writing to `.juntia/pending.json`, a human
confirming via `juntia confirm`) is unchanged; what changed is when this skill tells you to reach for it. It
is never invoked automatically by Juntia — an agent still notices, judges, and chooses to invoke it, the same
"AI interprets, Juntia governs" boundary every skill in this Knowledge Layer already respects. What Juntia
governs is the declarative BLOCKING/non-blocking rule (`decision-triggers.md`'s own `Requires confirmation`
field) an agent applies once it has already decided a real situation is in front of it — never whether the
situation itself is real.
