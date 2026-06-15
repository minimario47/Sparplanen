# Phase 1 — Re-track + the live truce  ·  status: DONE & verified

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-0-handoff.md` first, then
> verify the ground (git log/status + grep the seams below). Phase 0 already
> shipped the `retrack` op + projection + session + frozen `plannedTrackId`, so
> Phase 1 is mostly UI + the live-feed gate.

**Goal:** drag/keyboard a bar to another track and have it STICK against the 30s
live poll. This is the headline MVP and the highest-risk wiring — land and verify
the live truce before anything else.

## Todo (all complete)
- [x] **Interactions file** `js/components/edit-mode/train-edit-interactions.js` — pointer drag (vertical only → re-track), ghost moved by `transform: translateY()` only, drag-threshold, drop → `EditSession.addOp({op:'retrack', editKey, params, before})`. Shared `retrack(train, params, {commitNow})` used by drag/keyboard/context-menu.
- [x] **Palette wiring** — `select` + `retrack` flipped to `enabled:true`; active-tool state (`.is-active`) + click handlers in `edit-mode-controller.js`; default `select` on enter; exports `window.EditModeController`.
- [x] **Keyboard** — type a track number (digit buffer, 500 ms / 2-digit commit) + `↑/↓` adjacent-track nudge on the selected bar (own keydown in the interactions file, guarded by `isTypingTarget` + `editSession.active` + a selection). WCAG 2.5.7 non-drag path.
- [x] **Context-menu twin** `js/components/edit-mode/edit-mode-context.js` — registers `edits.retrack` (order 250, "⇅ Flytta till spår…") + a 16-track picker popover; commits via `retrack(..., {commitNow:true})` (works outside edit mode).
- [x] **Live truce** in `delay-integration.js#detectTrackChanges` — per-train gate after `let mutated=false`: `editSession.active` OR `train.manualOverride` ⇒ skip clearSplit/recordChange/auto-switch/split-create; compare still runs; `_liveDisagrees` + `suppress()` only for `manualOverride` trains (session-wide truce just freezes everything else — no chip/suppress on untouched bars).
- [x] **Indicator suppression** in `track-changes-store.js` — `suppress/unsuppress/isSuppressed` (a `suppressed` Set), honored in `getActive()` + `isHidden()`.
- [x] **Toast** — custom `.edit-truce-toast` (top-center) on a train's first manual re-track: "Live-spårändringar pausade för tåg X", with "Följ live igen" (removes that train's committed+draft ops + unsuppress) and "Visa inte igen" (localStorage opt-out).
- [x] **Decorator** `js/components/edit-mode/edit-mode-decorator.js` — on `schedule:rendered`, `.is-edited`/`.is-draft` + the `_liveDisagrees` ⚡ chip.
- [x] **Polish** — palette repositioned to a horizontal strip bottom-center (above the action bar); no longer covers the Spår-labels column.

## Verification (done — all green)
- Drag a bar to a new track → `cachedTrains` trackId moved, `plannedTrackId` frozen, key resolves to 1, persists across reload (localStorage). ✔
- **Live truce:** injected a divergent live report (track 8) on an overridden train → bar stayed on the manual track across two polls (no snap-back), `_liveDisagrees=true`, indicator suppressed (`getActive`→null). ✔
- Keyboard (↑/↓ nudge + number jump), context-menu picker, undo (12→9→1), Avbryt/discard all revert. ✔
- **Second edit of the same train resolves** (was the latent key-drift bug — see handoff). ✔
- No console errors; reduced-motion safe (chrome/toast reach visible end-state without animation; ghost `transition:none`). ✔
- Base (unedited) bars unchanged — empty store ⇒ projection is a no-op; board renders 474 trains identically.

## Handoff (for Phase 2)

### What shipped
**New files** (`js/components/edit-mode/`):
- `train-edit-interactions.js` → `window.EditModeInteractions = { retrack, select, clearSelection, getSelectedId, followLiveAgain }`. Owns: pointer drag (canvas capture-phase `pointerdown`; ghost = `cloneNode(true)` moved by `translateY` only, rAF-batched, `setPointerCapture` so other bars stop firing hover/tooltip mid-drag), click-select (`.edit-selected`, re-applied on `schedule:rendered`), keyboard (number/arrow), the shared `retrack()`, and the truce toast.
- `edit-mode-context.js` → context-menu entry `edits.retrack` (order 250) + the track-picker popover.
- `edit-mode-decorator.js` → `.is-edited`/`.is-draft` + the `_liveDisagrees` ⚡ chip on `schedule:rendered`.

**Modified:**
- `edit-projection.js` — `retrack` transform now also clears `train.splitTracks` (a manual placement is single-track).
- `edit-session.js` — added `removeByKey(editKey)` (drops a train's draft ops; used by the relink).
- `edit-key.js` — `buildEditKey` now keys off **frozen `plannedSubTrackIndex`**, not live `subTrackIndex` (see gotcha).
- `schedule-renderer.js` — added `plannedSubTrackIndex` to BOTH record builders (base map ~:344 + `serviceLikeToTrain` ~:462), parallel to `plannedTrackId`.
- `delay-integration.js#detectTrackChanges` — the live-truce gate.
- `track-changes-store.js` — suppression API.
- `edit-mode-controller.js` — enabled tools + active-tool state + `window.EditModeController`.
- `edit-mode.css` — palette → horizontal bottom-center; `.edit-selected`, `.edit-ghost` (`transition:none !important` + `will-change:transform`), `.train-bar__live-chip`, `.edit-truce-toast` (top-center), `.edit-track-picker`.
- `index.html` — 3 new scripts after the controller (interactions → context → decorator).

### Gate behaviour as landed
**Skip-all-mutations, compare-still-runs.** When `editSession.active` OR `train.manualOverride`: return before clearSplit/recordChange/auto-switch/split-create. The API-vs-track compare still runs, but `_liveDisagrees` (chip) and `suppress()` are applied **only for `manualOverride` trains** — a session-wide truce must not light up / suppress bars the controller never touched.

### Suppression flag lifecycle
`suppress(trainId)` is in-memory (per session). It's (re)applied on every retrack and on every poll for overridden trains, so the indicator stays hidden across reloads even though `suppressed` resets — the durable signal is `manualOverride`, re-derived from the op-log each render. `followLiveAgain` removes the train's committed+draft ops AND unsuppresses.

### The seam Phase 2 extends
Phase 2 (re-time) reuses the same pointer infra in `train-edit-interactions.js` but on the **X axis**: add edge-resize handles (left=arrival, right=departure), keep `transform`-only ghosting (or direct edge drag) and the same `transition:none` discipline. Mirror the shared `retrack()` with a `retime()` apply; register a `retime` transform in `edit-projection.js`; add `←/→` / `[`/`]` keyboard. The gate already truces edited trains, so a re-timed bar is protected for free.

### Gotchas (read before Phase 2)
1. **Edit keys MUST key off frozen planned fields.** A re-track mutates live `trackId`/`subTrackIndex`; `buildEditKey` reads `plannedTrackId` + `plannedSubTrackIndex` so a *second* edit of the same train still resolves. Any new op type that changes an identity-bearing field must follow this rule (re-time changes arr/dep times, which ARE in the key — if a future op re-times, freeze a planned-time too, or the key drifts).
2. **The ghost must stay `transition:none`.** `.train-bar` carries `transition: transform 0.2s` (trains.css:16); a cloned ghost inherits it and *chases* the cursor → the "laggy/shaky" drag the user hit. Killed via `.train-bar.edit-ghost { transition:none !important }` + rAF + pointer-capture. (See memory `transition-all-recalc-storm`.)
3. **Grab bars AFTER entering edit mode** — `EditSession.start()` re-renders and replaces every `.train-bar` node.
4. **Context-menu retrack commits directly** (`commitNow:true`) — it's a complete action and works with no open session.
