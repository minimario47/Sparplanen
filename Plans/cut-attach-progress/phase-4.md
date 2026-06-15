# Phase 4 — Attach / couple  ·  status: NOT STARTED

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-3.md` (Handoff) first, then
> verify the ground. This is the "attach to others" half — re-pair turns and
> strengthen/weaken units.

**Goal:** attach a loose leg to another train (form a turn) and couple/split
units. Keep couple (K) and turn (J) as DISTINCT verbs — different data math.

## Todo (tick as completed)
- [ ] Link tool (palette `A`); drag a loose leg onto a target, or keyboard: select source → `J` enters target-pick → `Tab`/`Shift+Tab` cycles valid candidates (ranked by proximity, highlighted) → `Enter`. `K` = couple. Valid targets light up, everything else dims.
- [ ] `attach` (form-turn) transform: write the target's departure number/label/time onto the arriving record (re-pair). `couple` transform: raise `trainSet.count`; `split` lowers it (Phase 3 may already cover split — reuse).
- [ ] **Soft validation only (decision #2) — warn, never block:** vehicle compatibility via `vehicleTypes.js` (`canBeMultiple`, `category`), min-turnaround / vändningstid, no-unit-in-two-places, count conservation. Surface Swedish warnings ("Vändningstid under X min", "Fordonstyperna kan inte multipelkopplas") but always allow the commit. Disable-couple-for-`canBeMultiple:false` is a *warning*, not a hard gate.
- [ ] Live-coupling re-derivation chip after a re-pair (the new departure number changes the delay match — re-derive and explain).
- [ ] Enable the `attach` + `unit` palette tools.

## Verification
- Form a turn (re-pair) → arriving unit departs as the chosen number; couple → `trainSet.count` rises and the renderer draws the longer multi-unit bar (TEST this — `count` has only ever come from the extractor; if the renderer needs an explicit multi-unit model, scope a follow-up).
- Validations warn but never block; a "no alternative" violation still commits.
- Base bars unchanged; undo/Avbryt revert.

## Handoff (fill in on completion, for Phase 5)
_← write here when done: the re-pair/couple op contracts, the validation-as-warning catalogue, the renderer-count finding, gotchas. Flip status to DONE; update PROGRESS._
