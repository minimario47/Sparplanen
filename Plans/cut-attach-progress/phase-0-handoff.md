# Phase 0 handoff — Scaffolding & inert overlay

**Status: complete and verified in-browser.** Zero console errors/warnings. Board renders identically with an empty store (474 bars). The whole overlay pipeline (commit op → projection → frozen plannedTrackId → draft/undo/redo/discard) was exercised via console and behaves correctly.

## What shipped

### New files — `js/components/edit-mode/`
- **`train-edits-store.js`** → `window.TrainEditsStore`. Clone of `UserTrainsStore`. Append-only **op log** in localStorage (`sparplannen-train-edits` + `-next-id`, negative ids). Op record: `{ id, op, editKey, params, before, after, scope:{week,day,anchorStr}, createdAt }`. API: `getAll, get, add, addMany, update, remove, clear, subscribe, OPS`. Dispatches `CustomEvent('train-edits-changed')`. `before/after` are **audit-only** — never read by undo.
- **`edit-key.js`** → `window.EditKey`. `buildEditKey(train)` = `week|day|plannedTrackId|subTrackIndex|arrPart|depPart`, where each leg part prefers number (`3593@00:19`), falls back to label (`L:MVH@00:34`), then time-only. Uses `window.currentScheduleSelection` for week/day and the **frozen `plannedTrackId`** (never live `trackId`). `resolveEditKey(key, trains)` → `{matches, count}`. `hhmm(date)`.
- **`edit-projection.js`** → `window.applyTrainEdits(trains)` + `window.EditProjection.registerTransform(op, fn)`. Replays committed store ops then active session draft ops over the projected copy. Each op resolves its key; `count !== 1` is flagged `op._unresolved` and **not applied** (Phase 5 tray). Applied trains get `_edited=true`, `manualOverride=true`, `_editOps[]`, and `_draft=true` if from the session. **`TRANSFORMS` registry** currently has `retrack` only — **add a case here per phase**.
- **`edit-session.js`** → `window.EditSession` (alias `window.editSession`). In-memory draft op log + redo stack. API: `active`, `start()`, `commit()`, `discard()`, `addOp({op,editKey,params,before?,after?})`, `undo()`, `redo()`, `canUndo()`, `canRedo()`, `getOps()`, `pendingCount()`, `subscribe(cb)`. Every change dispatches `train-edits-changed` (→ re-render). `commit()` flattens drafts into `TrainEditsStore.addMany(...)` with `scope`; sets `active=false` **before** persisting so the post-commit render shows committed (not draft) styling.
- **`edit-mode-controller.js`** → pen toggle wiring, builds the palette + action bar DOM (appended to `body`), keyboard (`E` toggle, `Esc`/`⌘Z`/`⌘⇧Z`). `TOOLS[].enabled` flips on per phase. Avbryt/Esc confirm when `pendingCount() > 0`.
- **`styles/components/edit-mode.css`** → palette + action bar (shown only on `body.is-editing`), pen-active state, and the **bar-state classes ready for later phases**: `.train-bar.is-draft` (dashed outline), `.is-edited` (left accent rail), `.is-conflict` (red outline), `.is-inverted` (warn hatch — for the allowed negative-duration bars). All static; motion behind `prefers-reduced-motion: no-preference`.

### Modified files
- **`index.html`**: `<link>` edit-mode.css (after onskemal-modal.css, ~:111); pen toggle `#edit-mode-toggle` in header-right (after `#onskemal-btn`); script block "9e. Edit mode" (5 files, after grid-context-menu-actions, ~:989) in dependency order store→key→projection→session→controller.
- **`js/modules/schedule-renderer.js`**: `applyTrainEdits(mergedTrains)` call **immediately after the merge at the `mergedTrains = trainData.concat(...)` line** (was :363; now ~:369, before `assignConnectionGroups`). New `train-edits-changed` listener in `initializeSchedule` next to the `user-trains-changed` one (~:68). Both call `prepareTrainData()` + `renderFullSchedule()`.

## How to drive it
Click the pen (top-right, key `E`) → `is-editing` on, palette + action bar appear, no relayout. Tools are disabled (Phase 1+). Avbryt/Esc exits (confirm if pending). `applyTrainEdits` runs on every `prepareTrainData`.

## Verification done
Console-injected a committed `retrack` op → bar moved track 1→9, `plannedTrackId` stayed 1, key still resolved to exactly 1 train. Draft op → `_draft` set, `pendingCount` 1; undo → reverted, `canRedo` true; discard → `is-editing` off, draft gone. `clear()` → back to base. UI: toggle on/off shows/hides chrome correctly; no errors.

## What Phase 1 must do (next, concrete)
Goal: **re-track via UI + the live-feed truce.** The `retrack` op + projection already exist — Phase 1 is mostly UI + the live gate.
1. **Interactions** (`js/components/edit-mode/train-edit-interactions.js`, new): vertical drag of a `.train-bar` (identity via `dataset.trainId` → `cachedTrains.find`; coords via `window.GridCoords.fromEvent(e)` → `{trackId, subTrackIndex, snappedTime}`; move the ghost with `transform` only — never `left/top` (transition-storm risk)). On drop, call `EditSession.addOp({op:'retrack', editKey: EditKey.buildEditKey(train), params:{trackId, subTrackIndex}, before:{...}})`. Add number-key track-jump (`1`–`9`, `0`+digit), `↑/↓` lane nudge. Enable the `select`/`retrack` palette tools.
2. **Context-menu twin** "Flytta till spår…" via `TrainContextMenu.register({id, order, build(train, ctx)})` + `createItem(label, action, {icon})` (see `train-context-menu-actions.js:23`).
3. **Live truce** in `js/delay/delay-integration.js#detectTrackChanges` (~:262, right after `let mutated = false;`): if `window.editSession.active` **or** the train is under manual override (carry the persistent flag onto the train in the projection — `train.manualOverride` already set), **skip the mutation branches** (`clearSplit` :273, `recordChange` :295, auto-switch :317-324, split-create :340-358) but keep the API-vs-`planned` compare; on divergence-from-manual set `train._liveDisagrees` for a chip. Poll runs every 30s.
4. **Indicator suppression**: add `suppress(trainId)/unsuppress(trainId)/isSuppressed(trainId)` to `track-changes-store.js` (a `suppressed` Set keyed by trainId), honored in `getActive()` (~:99) and `isHidden()` (~:145). Toast via `window.showNotification(msg, type)` with a "Följ live igen" relink.
5. Draft/committed visuals already exist in CSS — just ensure the decorator/renderer adds `.is-draft`/`.is-edited` classes to bars carrying `_draft`/`_edited` (a tiny decorator on `schedule:rendered`, mirror `train-notes-decorator.js`).

**Polish:** reposition the palette so it doesn't overlap the leftmost track labels (Spår 1–4).

**Seams confirmed (from Explore agents, in the plan's reuse table):** `GridCoords.fromEvent` is scroll-aware on `#timeline-canvas`; bar identity is `dataset.trainId`; `train-renderer.js:106` clamps negative-duration width to 40px (so inverted bars stay visible — Phase 2); `detectTrackChanges` insertion confirmed at ~:262; `track-changes-store.hide()` is a no-op on a clean train, so `suppress()` is the robust primitive.
