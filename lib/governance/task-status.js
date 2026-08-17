'use strict';

// Task Status — Governance In-Flow phase.
//
// Real, evidenced gap (Phase 16B / restaurant-game M04): Juntia already
// detected a decision correctly, but nothing told the agent — in a form it
// could act on deterministically, without depending on conversational
// memory — that the specific piece of work depending on that decision
// should stop. `agent-context.js`/`task-handoff.js` already carried a
// "Confirmed decisions" section (Decision Continuity), but no explicit
// signal for "you are currently blocked" versus "you were blocked, now
// you're clear" versus "nothing is blocking you."
//
// Deliberately a pure, computed value — never a fourth persisted decision
// status. A pending decision request already IS "blocking" by construction:
// `governance-review`/`decision-triggers.md`'s own BLOCKING/non-blocking
// rule is applied by the agent BEFORE it ever writes to `.juntia/pending.json`
// — a non-blocking situation is never escalated at all (the agent just uses
// its own judgment and continues). So anything actually sitting in
// `pending.json`, unconfirmed, of type "product"/"architecture", is a real
// blocking decision by definition; this module does not re-derive or
// second-guess that judgment, only reads its result.
//
// ACTIVE / WAITING_HUMAN_CONFIRMATION / READY_TO_CONTINUE are the only three
// states — no "applied": Juntia cannot verify a code change actually
// implements a decision without patching source itself, which it must not
// do (same reasoning Decision Continuity already established). Whether a
// task is done is the agent's own judgment; this module only ever answers
// "is there a real, outstanding, human-owed answer blocking this task right
// now."

const TASK_STATUSES = ['ACTIVE', 'WAITING_HUMAN_CONFIRMATION', 'READY_TO_CONTINUE'];

// computeTaskStatus({ blockingPending, decisions, generatedAt }) -> status
//
// `blockingPending` — the project's currently pending, valid, product/
// architecture decision requests (never interpretation-type items, which are
// a different, lower-stakes mechanism — a pending fact interpretation does
// not block implementation the way an unanswered product/architecture
// decision does). Any non-empty list means WAITING_HUMAN_CONFIRMATION,
// unconditionally — Juntia never weighs pending items against each other or
// decides some are "more blocking" than others.
//
// `decisions`/`generatedAt` — the same "confirmed since this task started"
// comparison `task-handoff.js#buildConfirmedDecisionsSection` already makes;
// reused here, not recomputed differently, so the two can never disagree
// about which decisions are "new" to this task. A non-empty "since started"
// set with nothing currently pending means READY_TO_CONTINUE: something the
// task was (or could have been) waiting on just got answered.
//
// Otherwise: ACTIVE.
function computeTaskStatus({ blockingPending = [], decisions = [], generatedAt } = {}) {
  if (blockingPending.length > 0) return 'WAITING_HUMAN_CONFIRMATION';
  if (generatedAt && decisions.some((d) => d.confirmedAt >= generatedAt)) return 'READY_TO_CONTINUE';
  return 'ACTIVE';
}

module.exports = { TASK_STATUSES, computeTaskStatus };
