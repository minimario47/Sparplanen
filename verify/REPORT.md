# Train PDF → Bar Accuracy — 5-Loop Verification Report

## Method (independent ground truth, not parser-vs-itself)
- **Ground truth** = the rendered PDF bars, read visually from high-DPI crops with the PDF's
  own printed time axis (`verify/render_region.py`). Independent of the Python parser.
- **What the app shows** = the app's *real* `day-stitcher.js` run headlessly over the baked
  `trains.js`, mirroring `schedule-renderer.js` time logic (`verify/app_bars.js`). Spot-checked
  against the actual browser via the `?week=…&day=…` QA override.
- **Sampling** = seeded, stratified by the 5 positions requested (start-of-PDF, mid-day,
  end-of-day/overnight, page-edge, week-start), region-based so missing/extra/split bars are
  caught too (`verify/sample.js`). Fresh regions each loop; previously-fixed trains re-checked.

## Results

| loop | fresh bars | + regression | wrong | **% wrong** | new finding |
|---|---|---|---|---|---|
| 1 | 36 | — | 1 | **2.8 %** | 167-class mid-day page-split |
| 2 | 37 | +2 (496,167) | 0 | **0.0 %** | — |
| 3 | 33 | +2 | 0 | **0.0 %** | — |
| 4 | 28 | +2 | 0 | **0.0 %** | — |
| 5 | 29 | +2 | 0 | **0.0 %** | — |

**163 fresh bars** verified across **23 regions, 7 weeks (W17–W24), all weekdays, all PDF
positions.** Accuracy trend after fixes: **2.8 % → 0 %** and held flat for three more loops.

## Bugs found & fixed

### Bug A — overnight park split into 2 bars (the user's 496 example) — FIXED
`496` (W24 torsdag, track 11) arrives 23:50, parks across midnight, departs as a **numberless
"D" depot move** at 00:30. `day-stitcher.js` refused to merge a *numbered* tail with a
*numberless* morning continuation, so it drew two bars (23:50→24:00 and 24:00→00:30+1).
- Fix (`js/modules/day-stitcher.js`): `findPartner` now merges a parked tail with the **single**
  numberless `cfp` morning continuation on its track; `stitch` always consumes the chosen
  partner (previously only same-number partners), so the morning piece can't leak as a phantom
  second bar.
- Effect: corpus overnight merges 290 → 296. Verified in the real browser: one continuous
  `496 … D` bar on Spår 11.

### Bug C — mid-day page-boundary coupled split (found loop 1, train 167) — FIXED
A coupled departure (two units, one number) is drawn as two bars on one 3h page but a single
grouped bar on the next, so the parser's `stitch_across_pages` matched only one unit and left
the other (`167→184`, W19 torsdag track 4) with a departure number but **no departure time** —
a bar with no end. 44 instances corpus-wide.
- Fix (`TrainData/extract_monday.py`, new `repair_coupled_page_splits()`): an orphaned `ctn`
  slot with a departure number but no time borrows the time from its coupled partner — **same
  track, same departure number, different sub-track, sane forward time**. The different-sub-track
  guard avoids un-hiding same-sub-track phantom artifacts (e.g. the "3025 all-day" bar).
- Effect: regenerated `trains.js` = **49 slots repaired** (98 dep-time fills + 98 ctn clears);
  signature 44 → 4; **0 new duplicate bars** (3 pre-existing, unchanged). Verified in the real
  browser: `167` now one bar 14:23→15:37 (74 min).

## Bug B — same-track "phantom lane gap" (the user's 2nd example) — NOT A DEFECT
Traced to `subTrackIndex` values that skip a number (0 and 2). Verified against the PDF (W17
torsdag track 7, the two 08:23 `155` units): the bars sit on genuinely **non-adjacent physical
sub-tracks**, and the skipped sub-track 1 is a real row used by other trains at other times
(`382`, `20352`, `3238`). `train-positioning.js` renders `subTrackIndex` faithfully — the gap
mirrors the PDF's physical track usage, not a bug. **Open display choice:** lanes could be
*visually compacted* to remove empty gaps, but that makes the app diverge from the PDF's
physical sub-track layout — your call.

## Other notes (not changed)
- **Rare pre-existing phantom duplicate**: an "all-day" artifact bar overlapping the real bar
  (e.g. `390` on W24 tis/ons/tors track 8.2) — 3 exact duplicates corpus-wide, **not** caused by
  these fixes. Could be cleaned up similarly to the `3025` suppression if you want.
- **Minor, uncounted**: a parked train whose arrival is a depot move shows the arrival *number*
  copied from the departure (e.g. `319/319` where the PDF arrival is just "D"); and `cfp`
  continuation bars don't show the previous-day arrival number. Cosmetic, train identity correct.
- The odd-looking 5-digit numbers (`17399`, `93224`, `59823`, `93528`…) are **real printed
  numbers** in the PDFs, not parser artifacts — confirmed visually.

## Reusable harness (kept under `verify/`)
- `render_region.py <week> <day> --page P --tracks a-b` → annotated ground-truth PNG crop
- `app_bars.js <week> <day> [--num N|--track T|--around HH:MM]` → headless app bars
- `sample.js --seed K [--exclude …]` → stratified region worklist + crop commands
- `score.js loop-K` → % wrong + ledger; `scan_lane_gaps.js` → Bug-B signature scan
- Local regen reproduces committed `trains.js` byte-for-byte, so parser fixes are diff-auditable.

## Round 2 — deep fixes (whole-class, not just the examples)

After the 5-loop audit the user asked to fix the two remaining items *deeply* — for the
whole corpus, not just the named example trains — and to deploy.

### 390-class phantom duplicate — FIXED at the parser (whole class)
The "all-day artifact" is a parked train whose mid-park page-fragments the parser missed, so
`stitch_across_pages` couldn't bridge the gap and the page-0 fragment survived as a slot
touching BOTH page edges (`continuesFromPrevPage && continuesToNextPage`) with **no times** —
rendered as a full-window bar shadowing the real park. The existing day-stitcher suppressor
(`isPhantomDuplicate`, the 3025 case) only matched a *timed, non-cfp* sibling, so it never
caught these (their real sibling is itself a morning park: cfp, no arrival).
- Fix (`TrainData/extract_monday.py`, new `drop_redundant_park_artifacts()`): drop a
  cfp&&ctn&&no-time fragment when a same-track, same-sub, same-departure-number sibling already
  carries a real departure time and touches the left edge (it already renders 00:00→dep, fully
  covering the artifact). Conservative: keeps the fragment when no such sibling exists.
- Effect: corpus all-day artifacts **5 → 0** (386 ×1, 390 ×4). Whole-corpus rendered-bar diff:
  exactly the 5 artifacts removed + 3 W24 evening parks correctly extended from a midnight
  truncation (`21:45-24:00`) to a faithful overnight park (`21:45-06:00+1`) — 0 other changes.

### Bug B lane gaps — FIXED at the renderer (whole class), user chose full compaction
`train-positioning.js` already *tried* to compact toward the top but did it with buggy
preferred-lane anchoring + clamp/fallback, stranding e.g. a sub-2 unit on lane 2 and a sub-3
unit on lane 0 with an empty lane 1 between them (train 3028 splitting into 3183+3033).
- New `_packLanes()`: greedy lane assignment that places each train (by start, sub, id) on the
  free lane **closest to the lanes its time-overlap neighbours already hold** (lowest on a tie).
  Normally that lowest lane is 0, so a track compacts to the top; when an earlier bar is stuck
  high from a since-cleared busy moment, the newcomer snaps adjacent instead of dropping to 0
  and stranding a lane. `calculateTrackLayouts` derives the track height from the same packed
  count, so labels/grid/bars stay aligned and tracks never get taller.
- **User decision:** with two trains on non-adjacent delspår (e.g. Spår 16 delspår 1 & 3, real
  delspår 2 momentarily empty), keep the gap (faithful) or pull them together. User chose
  **compact fully — never show a gap**; exact delspår stays on the bar/tooltip.
- Effect (measured by `verify/gap_audit.js`, which runs the real positioning engine corpus-wide):
  true phantom lane gaps **343 → 0**, with **0** two-trains-on-one-lane overlaps and max 5 lanes.
  Browser-verified: 3028 split flush (lanes 0,1), Spår 16 pair flush, no console errors.

Bug A (496) and Bug C (167) re-verified after the regen: still one continuous bar each.

## Commit status
Round 1 was kept local. Round 2 (this section) plus all prior fixes were **committed and
deployed** at the user's request: `TrainData/extract_monday.py` (Bug C + 390-class),
`js/modules/day-stitcher.js` (Bug A), `js/modules/train-positioning.js` (Bug B), regenerated
`trains.js`, and the `verify/` harness (crops excluded). GitHub Pages auto-deploys from `main`.
