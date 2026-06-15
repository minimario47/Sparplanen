# Phase 3 — Cut (sever turn / time-split)  ·  status: NOT STARTED

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-2.md` (Handoff) first, then
> verify the ground. This is the literal "cut"; the riskiest data change is the
> same-track split that changes record COUNT.

**Goal:** cut a bar — either sever the turn (decouple arrival from departure) or
split one dwell into two consecutive occupancies.

## Todo (tick as completed)
- [ ] Scissors tool (palette `C`); live vertical cut-guide snapped to 5 min. **Cut time & zone computed from the record's `arrTime`/`depTime` Dates (inverse of the time→x formula), NEVER `rect.width`/`style.left`** — bars are edge-clamped so pixels lie near canvas edges/overnight.
- [ ] Zone inference (left-third / middle / right-third) → cut variant (sever-turn vs time-split) per design §2.2; long-press/right-click disambiguates the ambiguous case.
- [ ] `cut` op transforms in `edit-projection.js`. Sever-turn → arrival-only stub + loose departure-only segment. Time-split → two consecutive same-lane records.
- [ ] **Same-track split → two records sharing a `_splitSibling`/`editDerived` flag**, and teach every count-sensitive consumer to treat the pair as ONE logical occupancy:
  - [ ] `conflict-detector.js` — skip sibling self-overlap (exclude by shared flag).
  - [ ] `train-positioning.js#_packLanes` — treat the pair as one occupant (no double lane).
  - [ ] `workload-aggregator.js` — count once (mirror the `!arrSynthetic`/`!depSynthetic` guards at :79/:89).
  - [ ] `delay-integration.js#getDelayContextsForTrain` — run once for the shared movement.
- [ ] Generalize `schedule-renderer.js#expandSplitTrains` (~:566) to honor `editSplit || splitTracks` for a different-track cut; flag manual so the live poll's split logic skips it.
- [ ] Guards: disable the scissors on synthetic endpoints (`arrSynthetic`/`depSynthetic`), on page-split flags (`continuesFromPrevPage`/`ToNextPage`), and resolve `stitchedOvernight` bars to the post-stitch span first (persist against the underlying day-record, not the `d1-` runtime id).

## Verification
- Sever a turn → arrival stub + free departure; time-split → two adjacent bars.
- Same-track split: confirm NO phantom conflict, NO double lane, workload counts once — run `verify/workload_counts.js`.
- Synthetic/page/overnight bars refuse or resolve correctly.
- Base bars unchanged (`verify/` harness); undo/Avbryt revert.

## Handoff (fill in on completion, for Phase 4)
_← write here when done: the `_splitSibling` contract + every aggregator taught about it, the expandSplitTrains generalization, the guard list, gotchas. Flip status to DONE; update PROGRESS._
