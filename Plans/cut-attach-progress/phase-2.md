# Phase 2 — Re-time  ·  status: DONE & verified

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-1.md` (Handoff section)
> first, then verify the ground. Builds directly on Phase 1's interaction +
> projection seams.

**Goal:** drag bar edges / nudge times to change arrival & departure times.

## Todo (all complete)
- [x] `retime` transform in `edit-projection.js`. Params are **minute deltas from the FROZEN planned time** per edge (`{arrDeltaMin?, depDeltaMin?}`), not absolute clock values — so replays are order-independent and last-write-per-edge wins (each op is absolute-from-planned). Reassigns to fresh Dates (never in-place mutate) so the planned times stay intact. Sets `_inverted` when `depTime ≤ arrTime`.
- [x] Edge-resize handles (left = arrival, right = departure) injected by the **decorator** in edit mode on bars that have the matching time; horizontal drag in `train-edit-interactions.js` (mode `'arr'`/`'dep'`); ghost resized in px, snapped to 5 min on drop. NO hard clamp (decision #2) — only the ghost's *visual* width is floored at 2px.
- [x] Keyboard: `←/→` = ±5 min, `Shift+←/→` = ±1 min, `[`/`]` selects which edge; `Alt` (held at drop) bypasses snap → round to the minute. Active edge highlighted via `.is-active-edge` on the handle.
- [x] **06:00 rollover:** handled by **absolute-Date arithmetic** — `new Date(planned + delta*60000)` crosses midnight natively and `left=(time−timelineStart)` stays correct, so a re-timed bar lands at the right wall-clock position with NO explicit dayOffset math. Verified: dep 21:00 Mon → 00:00 Tue (+3h), day advanced, geometry in-canvas, key stable. (`train.dayOffset` is NOT recomputed — see gotcha #2.)
- [x] **Decision #2 — negative/zero duration, soft-warn only:** never blocks. `_inverted` → `.is-inverted` hatch + a `.train-bar__warn-chip` (⚠, "Negativ varaktighet — avgång före ankomst. Kontrollera."). The bar stays visible as the 40px stub (train-renderer.js:107 clamps `Math.max(calcWidth, minWidthPx)` — confirmed). **Plus a required fix** — see gotcha #1.
- [~] Delay re-derivation chip — **DEFERRED** (intentional, not done). Rationale: a re-time sets `manualOverride`, so the Phase-1 live-truce gate already freezes delay-driven mutation for the bar, and the ⚡ live-chip already covers track-divergence. A separate "förseningsdata frikopplad" chip is informational polish; deferred to Phase 5 to avoid chip noise. (Pick up in `phase-5.md` if wanted.)
- [x] Enable the `retime` palette tool (`enabled:true` in `edit-mode-controller.js`).

## Verification (done — all green, in-browser, 0 console errors)
- Re-time data pipeline: dep +15 (edge isolated), then arr −5 (other edge) → both compose, planned frozen, key stable, op re-resolves identically across 3 forced re-renders, 0 unresolved. ✔
- Drag (synthetic pointer on the end handle): dep 19:42 → 20:00 (5-min snap, depDeltaMin 18), edited/manualOverride set. ✔
- Keyboard: `]` + `→`×2 = +10 (last-wins deltas), `Shift+←` = −1; key stable. ✔
- Inverted (centered train): dep pushed before arr → bar STAYS visible as 40px `.is-inverted` stub + ⚠ chip, data `depTime<arrTime`. ✔
- Undo reverts the time AND clears `_inverted`; Avbryt/discard revert. ✔
- Commit persists to localStorage; **survives reload** — resolved via the frozen-time editKey (`3578@19:42` while live dep is 20:00), `_edited` true / `_draft` false. ✔
- 06:00/midnight rollover: +3h across midnight → day advances, geometry valid. ✔
- Restored pristine baseline (0 edits, 474 trains, board renders identically).

## Handoff (for Phase 3)

### What shipped
**Modified:**
- `edit-projection.js` — `retime` transform (delta-from-planned, sets `_inverted`).
- `train-edit-interactions.js` — `retime()` + `nudgeEdge()` shared entries; the drag engine now branches on `drag.mode` (`'track'` = vertical re-track from the bar body, `'arr'`/`'dep'` = horizontal re-time from an edge handle); keyboard `←/→`/`[`/`]`; `activeEdge` state painted onto the selected bar's handle.
- `edit-mode-decorator.js` — injects/removes the two `.edit-resize-handle` elements in edit mode; `.is-inverted` + the ⚠ warn chip.
- `edit-mode-controller.js` — `retime` tool enabled.
- `edit-key.js` + `schedule-renderer.js` — **frozen `plannedArrTime`/`plannedDepTime`** added to BOTH record builders; `buildEditKey` reads them (the key embeds HH:MM, so a re-time would drift it otherwise).
- `schedule-renderer.js#renderFullSchedule` — the **view-window visibility filter** now normalizes the interval to `[min,max]` (gotcha #1).
- `edit-mode.css` — `.edit-resize-handle` (+ `--start`/`--end`, `::after` grip, `.is-active-edge`), `.train-bar__warn-chip`.

### Gotchas (read before Phase 3)
1. **Inverted bars were being filtered OUT of the render.** The view-window
   filter (`schedule-renderer.js`, ~the `visibleTrains` filter) used a raw
   `arr < end && dep >= start` overlap test, which false-negatives when arr > dep
   (an inverted re-time). Fixed by normalizing to `[min(arr,dep), max(arr,dep)]`
   before the overlap test. **Any future op that can invert a bar (cut, attach)
   must keep this invariant** — a degenerate interval must still test as present
   across its footprint, or decision #2 (always visible) breaks silently. NOTE: a
   bar genuinely scrolled off the view edge is still (correctly) filtered.
2. **`dayOffset` is NOT recomputed on re-time.** Rendering is correct (absolute
   ms), but `train.dayOffset` keeps its base value. It only feeds the tooltip
   date-hint and the delay date-match — both moot for a truced `manualOverride`
   bar. If a later phase needs the *service-day attribution* to follow the edited
   time (not just the pixel position), recompute it in the transform (needs the
   06:00 service-day base, which the projection doesn't currently receive).
3. **The edit key now freezes FOUR planned fields** (track, sub, arr, dep). The
   rule from Phase 1 holds and widened: any op that mutates an identity-bearing
   field must key off a frozen `planned*` twin. Cut/attach change leg
   composition (numbers/labels) — if those enter the key, freeze them too.
4. **Re-time params are deltas-from-planned, NOT absolute or incremental.** The
   projection composes them as `planned + delta` per edge (last write per edge
   wins). Editing code must convert any absolute target or relative nudge to a
   delta-from-planned before calling `retime()` (`retimeEdgeAbsolute`/`nudgeEdge`
   already do this). Storing an incremental delta would compound wrongly on undo.
