# Phase 3 — Cut (sever turn / time-split)  ·  status: DONE & verified

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-2.md` (Handoff) first, then
> verify the ground. This is the literal "cut"; the riskiest data change is the
> same-track split that changes record COUNT.

**Goal:** cut a bar — either sever the turn (decouple arrival from departure) or
split one dwell into two consecutive occupancies.

## Todo (all complete)
- [x] Scissors tool (palette `C`); live vertical cut-guide snapped to 5 min, tinted by zone. Cut time & zone computed from `arrTime`/`depTime` Dates via `GridCoords` (never pixels).
- [x] Zone inference (left/right third → sever, middle → time-split) in `cutZone()`. (Long-press/right-click disambiguation **deferred** — zone inference + keyboard `Enter`/`Shift+Enter` cover it; see Gotchas.)
- [x] `cut` op transform in `edit-projection.js` — sever-turn (arrival stub + loose departure record) + time-split (two consecutive same-track records). The transform RETURNS the extra record(s); the projection layer appends them (the one op that changes record count).
- [x] **Same-track split → two records sharing `_splitSibling` + `editDerived`**, consumers handle the pair as ONE occupancy:
  - [x] `conflict-detector.js` — skip same-`_splitSibling` pairs (after the same-track check).
  - [x] `train-positioning.js#_packLanes` — exclude same-`_splitSibling` from the active-overlap set (they're consecutive so they naturally share a lane).
  - [x] `workload-aggregator.js` — **no edit needed**: the cut boundary times are marked `depSynthetic`/`arrSynthetic`, so the existing :79/:89 synthetic guards skip them → each real leg counted once (verified 750/155 identical).
  - [x] `delay-integration.js#getDelayContextsForTrain` — **no edit needed**: the boundary-side number is blanked, so each record only looks up its own real leg.
- [~] `expandSplitTrains` generalization — **not needed for Phase 3** (sever + time-split are BOTH same-track; expandSplitTrains is the different-track torn renderer). Deferred to whenever a different-track cut is wanted.
- [x] Guards: refuse `arrSynthetic`/`depSynthetic`, `continuesFromPrevPage`/`ToNextPage`, **`stitchedOvernight`** (refused for now, not resolved — safe subset), non-`through`, inverted/zero dwell, and split when dwell < 10 min.

## Verification (done — all green, in-browser, 0 console errors)
- Time-split: through 250 (3563 17:37→3572 18:23) → A[17:37→18:00 dep-synthetic, 3563] + B[18:00→18:23 arr-synthetic, 3572], shared sibling, both render. ✔
- Same lane (both top 17px), NO phantom conflict, NO double lane, workload identical with/without (750/155). ✔
- Sever: stub[arr 17:37, no dep] + loose departure[dep 18:23, no arr], workload unchanged. ✔
- Guards refuse synthetic + non-through + stitched (canCut + cut return false). ✔
- Undo reverts; commit persists; survives reload (cut op re-resolves against the fresh base through-record, re-projects the pair). ✔
- No resize handles on cut-derived records. Restored pristine.

## Handoff (for Phase 4)

### What shipped
- `edit-projection.js` — `cut` transform (sever/split). `applyOne` now RETURNS extra records; `applyList` appends them AFTER the resolve loop (so an op never resolves against a sibling a prior op produced).
- `train-edit-interactions.js` — `cut()` / `canCut()` / `cutZone()` shared entries; scissors branch in `onPointerDown` (zone from Dates); keyboard `Enter`=split / `Shift+Enter`=sever on the selected bar; the hover `.edit-cut-guide`. Exports `cut`, `canCut`.
- `conflict-detector.js` + `train-positioning.js#_packLanes` — `_splitSibling` guards.
- `edit-mode-decorator.js` — `.is-edit-cut` seam (`data-cut-seam` left/right) + suppresses resize handles on cut-derived records.
- `edit-mode-controller.js` — cut tool enabled + `body[data-edit-tool]`.
- `edit-mode.css` — scissors cursor, `.edit-cut-guide`, violet `.is-edit-cut` seam.

### The contract Phase 4 (attach) inverts
- A **time-split** is two records sharing `_splitSibling` (= String(original id)); the boundary times are synthetic and the boundary-side numbers blanked. **Attach "stitch time-segments" is the inverse**: drop the second half back to re-join → remove the cut op (op-log pop), no new transform needed if it's the same session; cross-session needs a `stitch` op that clears the split.
- A **sever** produces a loose departure record `id '<orig>::dep'` (and an arrival stub keeping the orig id). **Attach "form a turn" (re-pair)** writes a new departure number/time onto an arrival → it will need to target the stub and consume a loose departure.

### Gotchas (read before Phase 4)
1. **Cut-derived records are NOT yet re-editable** — enforced at three layers (an adversarial review pass hardened this): the decorator suppresses resize handles, `onPointerDown`/`onKeydown` treat a cut product as read-only (select only, no drag/keyboard mutation via `isCutDerived`), and `retrack()`/`retime()` early-return on `isCutDerived`. Phase 4 ops that target cut products must key off the ORIGINAL through bar + a segment selector, not the product's own (blanked) key. A declined transform returns `false` so `applyOne` does NOT mark the train edited.
2. **Multi-op-same-train where one is a cut is unsupported.** Within one applyList pass, the cut mutates the matched record's key, so a *later* op in the same log targeting that same original train resolves to 0. Acceptable for now (a cut is normally the last op on a train); Phase 4/5 should add a segment-aware key if needed.
3. **`stitchedOvernight` cut is refused, not resolved.** Design §8 wants it resolved to the post-stitch span and persisted against both underlying day-records. Refusing is the safe subset; implement the resolve when a controller needs it.
4. **Workload/delay correctness rides on the synthetic-boundary trick**, not on teaching those consumers about `_splitSibling`. If a future change stops blanking the boundary number or stops marking it synthetic, those consumers WILL double-count — keep both (synthetic flag + blanked number) on any new split-like op.
5. **`_splitSibling` is `String(id)`**; the guards compare by it. Keep appended-record ids unique (`::b`/`::dep` suffix) so the DOM `data-train-id` and the sibling key never collide with a real id.
