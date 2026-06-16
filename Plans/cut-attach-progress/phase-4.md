# Phase 4 — Attach / couple  ·  status: DONE & verified

> Resuming? Read `README.md` → `PROGRESS.md` → `phase-3.md` (Handoff) first, then
> verify the ground. This is the "attach to others" half — re-pair turns and
> strengthen/weaken units. It is the **inverse of Phase 3's cut**.

**Goal:** attach a loose leg to another train (form a turn) and couple/split
units. Couple (`K`) and turn (`A`/`J`) are kept as DISTINCT verbs — different math.

## Todo (all complete)
- [x] Link tool (palette `A` "Koppla"); keyboard target-pick: select source → `A`/`J`
  enters target-pick → `Tab`/`Shift+Tab` cycles valid candidates (ranked by departure-
  to-arrival proximity, highlighted) → `Enter` commits / `Esc` cancels. Pointer path:
  Koppla tool → press source → press a glowing candidate. `K` = couple, `Shift+K` =
  decouple (also the Dela/ihop tool: a press couples +1). Valid targets glow; everything
  else dims via `body[data-edit-attach="picking"]`.
- [x] `attach` (form-turn) transform: writes the chosen departure's number/label/time
  onto the arriving SOURCE record (re-pair → `through`); the provider is consumed
  separately (see contract). `couple` transform: sets absolute `vehicleCount`/
  `trainSet.count`. **Decouple/split = the same `couple` op with a lower count** (no
  separate `split` op needed — count is absolute, last-write-wins).
- [x] **Soft validation only (decision #2) — warn, never block:** vehicle-category
  mismatch (`Fordonstyperna (A/B) kan kanske inte kopplas`), turnaround floor
  (`Vändningstid N min (under 10)`), departure-before-arrival (`Avgång före ankomst`),
  `canBeMultiple:false` couple (`X kan normalt inte multipelkopplas — tillåts ändå`),
  count floor/ceiling (1..6). All `notify()` toasts; the commit always proceeds.
- [x] Live-coupling re-derivation chip: a re-paired bar gets `.is-reattached` + a 🔗
  chip titled *"Vändning ändrad — förseningsdata omkopplad till nytt avgångsnummer."*
  (The truce already protects the bar; the chip explains the delay-match change.)
- [x] Enable the `attach` ("Koppla") + `unit` ("Dela/ihop") palette tools.

## The renderer-count finding (design open question #4 — RESOLVED)
**An operator-raised `trainSet.count`/`vehicleCount` DOES render as a taller multi-unit
bar — no follow-up needed.** `train-positioning.js#getVehicleSpan` reads
`vehicleCount ?? trainSet.count` (clamped 1..6) into `laneSpan`, and the renderer draws
the span. Verified: couple 250 from 2→3 grew its bar 30px → 46px live.

## Verification (done — all green, in-browser, 0 edit-mode console errors)
- Couple/decouple: count 2→3 (taller bar), 3→2→1, floor refuses below 1 (returns false),
  ceiling at 6; discard restores base count. ✔
- Form-a-turn (base bars): source 327 re-paired to depart 3582 (adopted from 330);
  provider 330 consumed → arrival-only, dep blanked; count conserved, no duplicate
  departure; `.is-reattached` + 🔗 chip + 0 resize handles (read-only). ✔
- Inverse-of-cut re-route: committed sever → attached the loose departure onto a
  DIFFERENT arriving unit (325); loose departure consumed & dropped; 327 stub terminates.
  Verified in BOTH forms: cross-pass (committed cut + draft attach) and same-pass
  (both committed) — survives reload, neither op `_unresolved`. ✔
- Keyboard target-pick: `A` opens (toast), `Tab` cycles, `Enter` commits, `Esc` cancels
  the pick WITHOUT discarding the session (controller defers Escape to `isAttachPicking`). ✔
- Soft validations warn but never block. ✔  Undo reverts both source & provider. ✔
- Commit + reload persistence: committed attach re-resolves against fresh base. ✔
- Post-review fixes re-verified (see Handoff): mid-pick re-render keeps candidate
  highlight; tool-switch cancels the pick; couple/decouple regression green. ✔

## Handoff (for Phase 5)

### Op contracts (what Phase 5 / future ops must honour)
- **`couple`** — `params:{count}` ABSOLUTE (1..6). Sets `train.vehicleCount` AND
  `train.trainSet.count` (fresh object, never mutates a shared base trainSet). Idempotent,
  last-write-per-editKey wins. `_coupled` flag (count>1) drives `.is-coupled`.
- **`attach`** — `params:{ departureTrainNumber, departureLabel, depOffsetMin, consumeKey }`.
  `editKey` = the SOURCE arrival-bearer (frozen-planned key, stable). `depOffsetMin` =
  minutes from the source's **frozen plannedArrTime** to the adopted departure (midnight-
  safe, rides along if the source is re-timed). The transform writes the departure leg +
  `movementKind='through'` + `_repaired`, and soft-warns `_inverted` if the adopted
  departure ≤ arrival. **It does NOT touch the provider** — that's the consume pass:
- **The consume pass** (`applyList`, after `appended` is merged): resolves each attach op's
  `consumeKey` and blanks that provider's departure (`_repairConsumed`); if the provider then
  has no arrival either, it's **spliced out** (a loose departure fully absorbed). Running
  after the append means a **committed cut's loose departure is visible** to a draft attach
  (cross-pass) and to a same-pass committed attach. On `count!=1` it sets
  `op._consumeUnresolved` (mirrors `_unresolved`) instead of silently leaving a duplicate.

### Validation-as-warning catalogue (all soft, Swedish, never block)
`Fordonstyperna (A/B) kan kanske inte kopplas` · `Vändningstid N min (under 10)` ·
`Avgång före ankomst` · `X kan normalt inte multipelkopplas — tillåts ändå` ·
`Max 6 enheter` / `Redan minst en enhet`. Helpers: `vehDef()` (→ `getVehicleDefinition`),
`unitCount()`, `warnAttach()`.

### Post-review fixes (an adversarial diff review found 4 real issues — all fixed)
1. **Pick state is held by ID, never object reference** (`attachSourceId`/`attachCandidateIds`).
   `prepareTrainData` rebuilds `cachedTrains` every render (a live poll can fire mid-pick),
   so object refs would go stale → `commitAttach` re-resolves by id to read the CURRENT
   departure time (was: stale `depOffsetMin`).
2. **`paintAttach` re-runs on `schedule:rendered`.** Without it, a mid-pick re-render
   stripped the `edit-attach-*` classes while `body[data-edit-attach="picking"]` persisted →
   the `:not(.candidate):not(.source)` dim rule matched EVERY bar (whole board greyed out).
3. **`setActiveTool` cancels an open pick** (`cancelAttachPick` exported). The palette lives
   outside `#timeline-canvas`, so a palette click never hit the canvas cancel path → a
   tool-switch mid-pick left a stuck dimmed/picking state.
4. **Consume flags `op._consumeUnresolved` on `count!=1`** rather than a silent `return`.

### Gotchas (read before Phase 5)
1. **Re-paired / consumed records are read-only** — `isCutDerived()` was broadened to include
   `_repaired`/`_repairConsumed` (no resize handles; retrack/retime/couple refuse). The one
   exception is the attach gesture itself, which runs BEFORE that guard so a severed stub can
   be a re-pair SOURCE and a loose departure a TARGET. Re-editing a re-paired bar (re-time its
   adopted departure, re-couple it) is a **Phase-5 item** — would need a segment-aware key.
2. **Multi-op-same-train where one is a cut/attach is still unsupported** (phase-3 gotcha #2
   stands). An attach captures its source key from the POST-cut stub (resolves live), so
   sever→attach chains work; but an op keyed on the PRE-edit identity resolves to 0.
3. **`_consumeUnresolved` and `_unresolved` are inert today** — the **Phase-5 reconcile tray**
   is their first consumer. When you build it, surface BOTH (primary editKey + consumeKey).
4. **Couple correctness rides on `getVehicleSpan`** reading `vehicleCount ?? trainSet.count`.
   Keep both set on any new count-changing op, or the bar height won't track.
5. **Candidate ranking is by |dep − arr|** within [−2h, +6h], top 12. It can pick a 0-minute
   turnaround (→ soft-warn inverted); fine by decision #2, but a Phase-5 polish could prefer
   `dep ≥ arr`. The växling (shunting) connector on a cross-track re-pair is still optional/deferred.
