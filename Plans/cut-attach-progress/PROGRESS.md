# Cut & Attach editing — build progress index

Running index for the multi-phase board-editing feature. Each phase has a todo
file (`phase-N.md`) you tick through, and a handoff written on completion, so
work resumes cleanly after a context reset.

**Resuming / after a compression? Read `README.md` first** — it has the bootstrap
protocol (load context → verify the ground → continue; re-plan only on a trigger,
not every compression).

**Always-valid background (read these first):**
- Design research (canonical): `Plans/cut-attach-editing-design.md`
- Execution plan (phases, decisions, reuse map): `/Users/mikailyenigun/.claude/plans/perfect-please-plan-the-purring-llama.md`
- Memory: `cut-attach-edit-feature-design` (load-bearing decisions)

**Branch:** all work lives on `feature/cut-attach-editing` (off `main`). Stay on this branch through Phase 5; do not merge to `main` until the feature is done. Phase 0 committed as `6103df48`, Phase 1 as `d4a093ab`.

**Locked decisions:** (1) edits are **device-local only** (localStorage; no Firestore). (2) **No hard blocks — soft-warn only**; negative/zero-duration bars are allowed and must stay visible.

| Phase | Title | Status | Todo / record |
|---|---|---|---|
| 0 | Scaffolding & inert overlay | ✅ done & verified | `phase-0-handoff.md` |
| 1 | Re-track + live truce | ✅ done & verified | `phase-1.md` (Handoff) |
| 2 | Re-time | ✅ done & verified | `phase-2.md` (Handoff) |
| 3 | Cut (sever-turn / time-split) | ✅ done & verified | `phase-3.md` (Handoff) |
| 4 | Attach / couple | ✅ done & verified | `phase-4.md` (Handoff) |
| 5 | Polish & resilience | ⏭️ next | `phase-5.md` |

**Current state:** re-track, re-time, cut, AND attach/couple are live and verified. In edit mode you can:
- **Re-track** a bar to another track by drag (vertical ghost), keyboard (select → type a track number or `↑/↓`), or the context menu ("⇅ Flytta till spår…", works outside edit mode).
- **Re-time** a bar by dragging its **edge handles** (left = arrival, right = departure; 5-min snap, `Alt` = round to the minute), or keyboard (`←/→` = ±5 min, `Shift+←/→` = ±1, `[`/`]` pick the edge). The "Ändra tid" palette tool is enabled.
- **Cut** a bar (Klipp tool; `Enter` = time-split, `Shift+Enter` = sever) — sever a turn (arrival stub + loose departure) or split a dwell into two consecutive same-track occupancies sharing `_splitSibling`.
- **Attach / form a turn** (Koppla tool; `A`/`J`): select an arrival-bearer → `Tab`-cycle the glowing departure candidates → `Enter` (or click source then candidate). The arriving unit adopts that departure (vändning); the provider is consumed. This is the **inverse of cut** — sever a turn, then re-route the loose departure onto a different unit.
- **Couple / decouple** (`K` / `Shift+K`, or the Dela/ihop tool): raise/lower `vehicleCount` (1..6); the bar grows taller — verified `getVehicleSpan` renders an operator-raised count (design open Q#4 resolved). All Phase-4 validations are **soft warnings only** — nothing blocks (decision #2).

Both re-track and re-time stick against the 30s live poll via the `detectTrackChanges` **live-truce gate** (skips mutations for `manualOverride`/in-session trains; ⚡ chip when the feed reports a different track; indicator suppressed; "Följ live igen" / "Visa inte igen" toast). Edits persist across reload and survive repeated edits of the same train. A re-time that pushes departure ≤ arrival is **allowed** (decision #2) — the bar stays visible as a 40px `.is-inverted` hatched stub with a ⚠ warn chip.

**Ground changes to note:**
- Records carry **four frozen planned fields**: `plannedTrackId`, `plannedSubTrackIndex`, **`plannedArrTime`**, **`plannedDepTime`** (set in both builders in `schedule-renderer.js`). Edit keys MUST key off these, never the live fields (re-track/re-time mutate the live ones). See `phase-2.md` Handoff → Gotchas.
- The render **view-window visibility filter** now normalizes the train interval to `[min(arr,dep), max(arr,dep)]` so inverted bars aren't silently dropped. Any future op that can invert a bar must preserve this. See `phase-2.md` Gotcha #1.
- **`applyTrainEdits` now mutates record COUNT.** `cut` appends siblings (collected and pushed AFTER the resolve loop); `attach`'s **consume pass** (after the append) blanks a provider's departure and may **splice** a fully-absorbed loose departure out. Two passes run — committed ops, then draft ops — so a committed cut's loose departure is visible to a draft attach. See `phase-3.md` + `phase-4.md` Handoffs.
- **`isCutDerived()` gates read-only treatment** for cut products AND Phase-4 `_repaired`/`_repairConsumed` records (no handles; retrack/retime/couple refuse). The attach gesture is the one exception — it runs before the guard so a stub can be a SOURCE and a loose departure a TARGET.
- **`_unresolved` / `_consumeUnresolved`** flags are set on ops whose editKey/consumeKey don't resolve to exactly one record. **Inert until the Phase-5 reconcile tray** consumes them.

**Open polish items (non-blocking):** (1) the bottom-center palette + action bar float over the lowest track rows during editing — acceptable, refine later. (2) Delay re-derivation chip ("förseningsdata frikopplad") after a re-time is **deferred to Phase 5** — the truce already protects re-timed bars (rationale in `phase-2.md`). (3) `train.dayOffset` isn't recomputed on a re-time that crosses the service day — only affects tooltip date-hint text on an already-truced bar (`phase-2.md` Gotcha #2).
