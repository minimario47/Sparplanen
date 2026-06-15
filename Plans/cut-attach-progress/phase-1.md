# Phase 1 — Re-track + the live truce  ·  status: NOT STARTED

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-0-handoff.md` first, then
> verify the ground (git log/status + grep the seams below). Phase 0 already
> shipped the `retrack` op + projection + session + frozen `plannedTrackId`, so
> Phase 1 is mostly UI + the live-feed gate.

**Goal:** drag/keyboard a bar to another track and have it STICK against the 30s
live poll. This is the headline MVP and the highest-risk wiring — land and verify
the live truce before anything else.

## Todo (tick as completed; this is the durable list)
- [ ] **Interactions file** `js/components/edit-mode/train-edit-interactions.js` (new; add `<script>` after edit-mode-controller in index.html). Pointer Events with `setPointerCapture`; hit-test `.train-bar` → `dataset.trainId` → `cachedTrains.find`. Coords via `window.GridCoords.fromEvent(e)` → `{trackId, subTrackIndex, snappedTime}` / `resolveTrack(y)`. Move the ghost with `transform: translate()` ONLY (never left/top — transition-storm risk). On drop → `EditSession.addOp({op:'retrack', editKey: EditKey.buildEditKey(train), params:{trackId, subTrackIndex}, before:{trackId, subTrackIndex}})`. Add a small drag-threshold so a stray click never nudges.
- [ ] **Palette wiring**: flip `TOOLS` `select` + `retrack` to `enabled:true` in edit-mode-controller.js; add active-tool state (class `is-active`) and click handlers.
- [ ] **Keyboard**: number-key track-jump (`1`–`9`, `0`+digit → 10–16) and `↑/↓` lane nudge on the selected bar (add to the controller's keydown, guard against typing targets). This is also the WCAG 2.5.7 non-drag path.
- [ ] **Context-menu twin** "Flytta till spår…": `TrainContextMenu.register({id:'edits.retrack', order:~250, build(train,ctx)})` + `createItem(label, action, {icon})` (pattern at `train-context-menu-actions.js:23`). Opens a small track picker → adds the retrack op.
- [ ] **Live truce** in `js/delay/delay-integration.js#detectTrackChanges`: insert a gate right after `let mutated = false;` (verify line — was ~:262). If `window.editSession.active` OR the train carries `manualOverride` (the projection already sets `train.manualOverride=true` on edited bars), **skip the mutation branches** (`clearSplit`, `recordChange`, the auto-switch `train.trackId=...`, split-create) but STILL run the API-vs-`planned` compare; on divergence from the manual track, set `train._liveDisagrees=true`. Do NOT early-return before the compare.
- [ ] **Indicator suppression** in `js/components/track-changes/track-changes-store.js`: add `suppress(trainId)/unsuppress(trainId)/isSuppressed(trainId)` (a `suppressed` Set keyed by trainId), honored in `getActive()` (~:99) and `isHidden()` (~:145). Export in the public API.
- [ ] **Toast**: on first manual re-track of a train, `window.showNotification('Live spårändringar avstängda för tåg X — ...', 'info')` with a "Följ live igen" relink (clears manualOverride + unsuppress). "Don't show again" lives on the toast only.
- [ ] **Decorator** `js/components/edit-mode/edit-mode-decorator.js` (new; mirror `train-notes-decorator.js`): on `schedule:rendered`, add `.is-draft` to bars with `_draft` and `.is-edited` to bars with `_edited` (CSS already defined in edit-mode.css). Add the `_liveDisagrees` chip.
- [ ] **Polish**: reposition the palette so it doesn't overlap the leftmost track labels (Spår 1–4).

## Verification (don't skip — this phase is the risk)
- Enter edit mode, drag a bar to a new track; confirm `cachedTrains` trackId moved, `plannedTrackId` frozen, key resolves to 1. Reload → edit persists (localStorage).
- **Live truce:** inject a fake track change for the edited train via the console fake-delay-feed trick (memory `split-bar-feature-and-deploy`); wait past one 30s poll; confirm the bar does NOT snap back and the toast/relink works.
- Undo (`⌘Z`) and Avbryt revert cleanly; number-key + arrow paths work; reduced-motion shows all affordances.
- `verify/` PDF-bar-accuracy harness: base (unedited) bars unchanged.

## Handoff (fill in on completion, for Phase 2)
_← write here when done: what shipped (files+anchors), the gate behavior as landed (skip-all vs compare-still-runs), the suppression flag lifecycle, the drag/keyboard interaction seam Phase 2 extends, gotchas, and verification results. Then flip the status line at top to DONE and update PROGRESS.md._
