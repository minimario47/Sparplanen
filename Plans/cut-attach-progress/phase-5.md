# Phase 5 — Polish & resilience  ·  status: NOT STARTED

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-4.md` (Handoff) first, then
> verify the ground. Final phase: durability across weekly regens + finishing
> touches. After this, propose merge to `main` (only with the user's approval).

**Goal:** make edits durable across the weekly trains.js regeneration and polish
the experience.

## Todo (tick as completed)
- [ ] **Orphan-reconcile tray** hung off the existing "Ladda om" banner (`schedule-update-checker.js` / `schedule-staleness-banner.js`). On each load, re-resolve every committed op's `editKey` via `resolveEditKey` → `{matches, count}` and bucket: matched (count 1, exact) apply; shifted (count 1, fuzzy ±5 min) one-click confirm; ambiguous (count > 1) manual pick; orphaned (count 0) keep-mine/drop. **Never auto-apply when count ≠ 1.**
- [ ] Retrofit the shared `resolveEditKey()` resolver onto the notes/checks stores (they orphan silently every week today).
- [ ] "🔒 Lås" look-only toggle (per-controller, inverse of edit mode — a second safety valve).
- [ ] Full reduced-motion audit of every affordance added across phases 1–4.
- [ ] (Optional, only if asked) command palette / multi-select / batch.
- [ ] **Out of scope (decision #1):** Firestore / multi-user sync, per-field CRDT merge. Do NOT build these.

## Verification
- Simulate a weekly regen (renumbered ids / shifted times) and confirm edits land in the right buckets; nothing auto-applies to a wrong/ambiguous bar.
- Lås blocks edits; reduced-motion clean; `verify/` harness green.

## Handoff / wrap-up (fill in on completion)
_← final state, known limitations, deferred items. Then ask the user before merging `feature/cut-attach-editing` → `main`._
