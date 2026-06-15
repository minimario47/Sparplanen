# START HERE — bootstrap for any AI resuming the Cut & Attach build

This folder is the **durable, file-based continuity** for the multi-phase board-
editing feature. It survives context compression: each phase has a todo file you
tick through, and a handoff written when it completes. Read this first, every
time you (re)start — including after a compression.

## Post-compression protocol (do this, in order)

1. **Load context, don't re-derive it.** Read, in order:
   - this README
   - `PROGRESS.md` (which phase is active, branch, status)
   - the **previous** phase's handoff (`phase-(N-1)-handoff.md` or the Handoff
     section of `phase-(N-1).md`)
   - **your** phase file (`phase-N.md`) — its checklist is your todo list
   - background only if needed: `Plans/cut-attach-editing-design.md` (canonical
     design) and `/Users/mikailyenigun/.claude/plans/perfect-please-plan-*.md`
     (the execution plan).
2. **Verify the ground (mandatory).** The plan is stable; the *code* is not.
   - `git log --oneline -15` and `git status` — see what already landed.
   - Re-read the specific seams your next checklist item touches (line numbers
     drift — confirm with grep, don't trust the doc's line numbers blindly).
   - Reconcile your phase checklist against reality: tick what's done, untick
     what isn't. A phase can be **half-built** when compression hits — the
     checklist tells you where you are.
3. **Continue executing the existing plan.** Do **not** re-plan the approach or
   re-derive the architecture. The design doc + plan are the source of truth so
   that many context windows produce one coherent feature. Re-planning every
   time causes drift and a patchwork.
4. **Re-plan the phase ONLY on a trigger** (and if you do, record why in
   PROGRESS so the next AI inherits it):
   - the plan/handoff contradicts the actual code or data (a seam moved, a
     weekly regen changed something, a refactor landed);
   - a verification failed in a way the plan didn't anticipate;
   - the user changed a requirement or a locked decision;
   - the phase is unstarted **and** its checklist is too coarse to execute
     safely → a brief refinement (not a full re-plan).
5. **Discipline:** stay on branch `feature/cut-attach-editing`; never merge to
   `main` or commit feature work there until the whole feature is done and the
   user approves. Commit per phase. Keep the checklist + PROGRESS updated as you
   go; write the Handoff section when the phase completes.

## Why not re-plan every compression?
Stability across handoffs is the entire point of this folder. The costly design
work is already done and codified. What changes between sessions is the code
state, not the design — so **verify the ground, then continue**; reserve
re-planning for when the ground actually shifted.

## Locked decisions (do not relitigate without the user)
1. Edits are **device-local only** (localStorage; no Firestore/multi-user).
2. **No hard blocks — soft-warn only.** Negative/zero-duration bars are allowed
   and must stay visible (inverted visual). Never prevent a commit.

## Files
- `PROGRESS.md` — the index/status board (update it as phases move).
- `phase-0-handoff.md` — Phase 0 completed record.
- `phase-1.md` … `phase-5.md` — per-phase todo checklist + (filled on completion)
  a Handoff section the next phase reads.
