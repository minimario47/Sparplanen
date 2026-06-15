# Phase 2 — Re-time  ·  status: NOT STARTED

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-1.md` (Handoff section)
> first, then verify the ground. Builds directly on Phase 1's interaction +
> projection seams.

**Goal:** drag bar edges / nudge times to change arrival & departure times.

## Todo (tick as completed)
- [ ] `retime` transform in `edit-projection.js` (set `arrTime`/`depTime` from params; params store HH:MM or ms deltas — keep stable across re-render).
- [ ] Edge-resize handles (left = arrival, right = departure) on `.train-bar` in edit mode; drag each edge independently with a `minDuration`-aware feel (but NO hard clamp — see decision #2).
- [ ] Keyboard: `←/→` = ±5 min, `Shift+←/→` = ±1 min, `[`/`]` selects which edge; `Alt` bypasses snap during drag. 5-min snap via `GridCoords.snapTime`.
- [ ] **06:00 rollover:** when a time edit crosses the service-day boundary, recompute `dayOffset` / the `_depNextDay`-style +DAY_MS handling so the bar lands on the right calendar day (see `prepareTrainData` overnight logic ~:244–283 and `day-stitcher`).
- [ ] **Decision #2 — allow negative/zero duration, soft-warn only:** never block. When `depTime ≤ arrTime`, add `.is-inverted` (CSS already defined: warn hatch) and show a chip "negativ varaktighet — kontrollera". The bar stays visible (train-renderer.js:106 clamps width to 40px — confirm still true). Note `_packLanes` can't lane-separate inverted bars (overlap test needs start<end) — accept and warn, don't over-engineer.
- [ ] Delay re-derivation after a time edit: re-run the delay-context lookup with the new times; if the ±5 min `advertisedTime` match breaks, chip "förseningsdata frikopplad / live-koppling uppdaterad".
- [ ] Enable the `retime` palette tool.

## Verification
- Drag arrival/departure edges; confirm times + width update and persist across reload.
- Push a departure before its arrival → inverted visual + warning, bar still visible & grabbable, commit succeeds (no block).
- Edit a bar across 06:00 → lands on correct day; run the midnight-rollover harness (`verify/midnight_rollover.js`).
- Undo/Avbryt revert; reduced-motion OK.

## Handoff (fill in on completion, for Phase 3)
_← write here when done: the inverted-duration visual + warning contract, the dayOffset recompute rule, the delay re-derivation hook, and any gotchas. Flip status to DONE; update PROGRESS._
