# Phase 5 — implementation design (working spec)

> ⚠️ **SUPERSEDED IN PART by an owner scope correction (see `phase-5.md`).**
> Sections **A (orphan-reconcile tray)** and **B (notes/checks carry-across-regen
> retrofit)** were CUT and reverted: they violated the principle that an edit/note
> belongs to one train occurrence and must never carry/rebind to another train.
> What SHIPPED: **C (safe re-editability)**, **C.Lås**, **E (re-time chip)**, plus the
> persistList runtime-flag hygiene. The `_editKeyBase` / two-phase-`applyList`
> mechanism (F1–F5) shipped as designed; the fuzzy resolver / `resolveEditKeyFuzzy`
> / `parseEditKey` (tray-only) were removed from `edit-key.js`.

Concrete design for the six Phase-5 deliverables. Grounded in the real code as of
commit `bed88d9c`. The two risky mechanisms (reconcile resolution + `_editKeyBase`)
are spec'd precisely so they can be adversarially reviewed before coding.

Locked decisions still apply: **device-local only**, **soft-warn never block**.
Scope choice (user-approved): re-editability = "safe ops + anchored re-time".

---

## A. Orphan-reconcile tray  (`js/components/edit-mode/edit-reconcile.js` + CSS)

**Goal:** on each load, re-resolve every *committed* op's `editKey` against the
current week's records and bucket the failures. Never auto-apply when count ≠ 1.

### Clean-base snapshot
`prepareTrainData` (schedule-renderer.js:386) calls `applyTrainEdits(mergedTrains)`
which MUTATES `mergedTrains` in place (cut/attach blank/rewrite numbers). So
**immediately before** that call we capture a shallow snapshot of the pre-edit set:

```js
window.editReconcileBase = mergedTrains.map((t) => Object.assign({}, t));
```

~200 shallow clones; Date fields shared by ref (read-only). This is the current
week's clean base, the correct target for fuzzy "did the train shift" matching.

### Resolution authority = the projection, not an independent pass
The projection's `applyList` already calls `resolveEditKey(op.editKey, trains)` for
every committed op and sets `op._unresolved = count` when count ≠ 1 (deletes it on
bind). It also sets `op._consumeUnresolved` for the attach consume side. **These
flags are the authority for "did the op bind"**, because they are computed in the
real sequential/append/consume context — so a sever→attach chain (whose attach key
targets an appended product) is correctly reported as bound, with no false orphan.

The reconcile module reads these flags on `schedule:rendered` (fires after the
render that ran the projection, so flags are fresh). It uses the clean-base
snapshot ONLY to (a) refine an unbound op into shifted/ambiguous/orphaned and
(b) fetch candidate records for the picker.

### Per-op classification (committed ops only)
```
if op._unresolved === undefined:
    primary bound. (count it as "applied"; no primary row.)
    if op.op === 'attach' && op._consumeUnresolved != null:
        consume issue → consume-ambiguous (>1) or consume-orphaned (0)
else if op._unresolved > 1:
    ambiguous; candidates = resolveEditKey(op.editKey, base).matches
else:  // op._unresolved === 0
    fuzzy = resolveEditKeyFuzzy(op.editKey, base, 5)
    fuzzy.count === 1 → shifted (candidate = fuzzy.matches[0])
    fuzzy.count  >  1 → ambiguous (candidates = fuzzy.matches)
    fuzzy.count === 0 → orphaned
```

### Fuzzy resolver  (`EditKey.resolveEditKeyFuzzy(key, trains, tolMin)`)
Parse both the search key and each candidate's `buildEditKey`. A candidate matches
iff: same `week|day|track|sub`; identical movement shape (both have arr-leg / both
don't, same for dep); for each present leg the **id (number/label) is identical**
and the **time is within ±tolMin** (minute-of-day, circular near midnight). This
catches a pure time-shift with stable number (the dominant regen case) and refuses
a renumber (→ orphaned, the safe call: never silently rebind to a wrong bar).
Add `EditKey.parseEditKey(key)` returning `{week,day,track,sub,arr:{id,time},dep}`.

### Tray UI (rows, all Swedish)
Card, top-center, in the banner stack (below the update banner). Re-appears each
load while issues remain; per-session dismiss collapses it.
- **shifted** — "Tåg N — schemat flyttat ~Δ min. Binda om?" → [Bekräfta] rebind ·
  [Släpp] drop · [Behåll] keep(ack).
- **ambiguous** — "Tåg N — matchar M tåg." → radio list of candidates · [Binda] ·
  [Släpp] · [Behåll].
- **orphaned** — "Tåg N — finns inte i nya schemat." → [Behåll mina] ack · [Släpp].
- **consume-*** (attach) — "Koppling N — kunde inte frikoppla avgångsgivaren." →
  pick provider [Binda] / [OK accept] / [Släpp koppling].

### Actions (mutate the store → re-render → tray re-evaluates; no loop)
- rebind: `TrainEditsStore.update(opId, { editKey: buildEditKey(chosen) })`
- consume-rebind: `update(opId, { params: {...op.params, consumeKey: buildEditKey(chosen)} })`
- drop: `TrainEditsStore.remove(opId)`
- keep/ack: opId → ack Set persisted in `localStorage['sparplannen-reconcile-ack']`;
  acked rows hidden until they stop being an issue. Prune ack on drop.

`describe(op)` + a parsed-key train number give each row its label.

---

## B. Resolver retrofit onto notes/checks stores

Both stores key by `String(train.id)`, which renumbers every weekly regen → silent
orphan. Fix WITHOUT a modal refactor, never deleting:

Add a shared util `js/components/edit-mode/store-reconcile.js`:
`reconcileIdKeyedStore(cache, trains)` → mutates `cache` in place, returns changed.
Per entry (id-keyed `{...meta, editKey?}`):
- has `editKey`: if current `trains[id]` still has that key → ok. Else
  `resolveEditKey(editKey, trains)`; count 1 → **re-key** entry to the match's id
  (keep editKey); count ≠ 1 → leave (don't guess).
- no `editKey` (legacy): if `trains[id]` exists → **backfill** `editKey =
  buildEditKey(that train)` (makes it migratable next regen). Else leave.

`TrainNotesStore.reconcile(trains)` / `TrainChecksStore.reconcile(trains)` call the
util with their cache + persist + notify if changed. Invoked once after the first
`schedule:rendered`, against `window.editReconcileBase`. New writes also store
`editKey` when the caller passes the train (immediacy); backfill covers the rest.

---

## C. Lås look-only toggle  (`js/components/edit-mode/edit-lock.js`)

A persisted per-device "look-only" valve that gates the EDIT feature (not notes/
checks). Header button `#edit-lock-toggle` (🔒), `localStorage['sparplannen-edit-locked']`.
When locked: `document.body.classList.add('is-locked')`; the pen `enter()`/`toggle()`
refuse (consult `window.EditLock.isLocked()`), pen button shows disabled; the
context-menu "Flytta till spår…" twin is hidden. Engaging the lock while a session
is open first exits it (discard with the existing confirm if pending). Inverse of a
mode gate — cheap second safety valve (design §4.x / feature table).

---

## D. Reduced-motion audit

Every Phase 1–4 affordance already uses static CSS with a visible end-state
(edit-mode.css: draft outline, edited rail, inverted hatch, selection ring, ghost,
handles, cut guide/seam, chips, truce toast, attach states). Motion is opt-in via
`@media (prefers-reduced-motion: no-preference)`. Audit = confirm + add reduced-
motion guards to NEW Phase-5 chrome (tray slide-in keyframe, any Lås transition),
verify the notify() toast (notifications.css) stays visible under reduce. Record
findings in the handoff.

---

## E. Deferred delay-decoupled chip for re-time

Projection `retime` transform sets `train._retimed = true`. Decorator adds a small
`⏱` chip (class `train-bar__retime-chip`, blue) titled "Tid ändrad — förseningsdata
frikopplad (matchas mot nytt schemaläge)." Shown when `_retimed` and NOT `_inverted`
(inverted already warns). Mirrors the always-on 🔗 reattach chip pattern.

---

## F. Safe re-editability of cut/re-paired products

### F1. `_editKeyBase` handle  (edit-key.js)
`buildEditKey(train)`: if `typeof train._editKeyBase === 'string' && train._editKeyBase`
→ return it; else compute as today. Products carry a stable key so a re-edit op
binds to them; in-place cut/attach mutate numbers, which would otherwise drift the
computed key (root cause of phase-3/4 gotcha #2).

### F2. Projection stamps `_editKeyBase`  (edit-projection.js)
- sever: stub (in place) `= op.editKey`; looseDep (appended) `= op.editKey + '|dep'`.
- split: firstHalf (in place) `= op.editKey + '|a'`; b (appended) `= op.editKey + '|b'`.
- attach: repaired source (in place) `= op.editKey`.
- consume: provider (in place) `= op.params.consumeKey`.
The PARENT op still keys on the unsuffixed `op.editKey` and resolves against the
clean base each render (no `_editKeyBase` there) → unchanged behavior.

### F3. Two-phase resolution in `applyList`  (additive; phase-1 == today)
- Phase 1: resolve+apply every op against current `trains`; collect appends; count
  1 → apply + `delete _unresolved`; count > 1 → `_unresolved = count` (ambiguous,
  not retried); count 0 → hold for retry.
- `trains.push(...appended)`.
- Phase 2: re-resolve the held count-0 ops against the bigger `trains`; count 1 →
  apply + `delete _unresolved`; else `_unresolved = count`. (Re-edit ops never
  append, so one retry pass suffices.) Then the existing consume pass.
No reordering hazard: two ops on one record are both count-1 (phase 1, in order);
a phase-2 op targets an appended product that had no phase-1 counterpart.

### F4. Per-edge `retimeableEdges(train)` → {start, end}
- normal base: start if arrTime, end if depTime (today's behavior).
- `_cutSevered` stub: start only (planned arr real; no dep).
- `_cutLooseDeparture`: end only (planned dep real; no arr).
- split firstHalf (`editDerived && depSynthetic`): start only (right = synthetic cut boundary).
- split b (`editDerived && arrSynthetic`): end only (left = synthetic boundary).
- `_repaired`: start only (departure is adopted, not planned → right deferred).
- `_repairConsumed`: start only (became arrival-only).
Exported on `EditModeInteractions`; the decorator injects handles from it.

### F5. Enable ops on products
- retrack: allow on all products (absolute; keys via `_editKeyBase`). Drop the
  `isCutDerived` block.
- couple: allow on all products (absolute). Drop the block + notify.
- retime: allow only on `retimeableEdges`; drag is naturally constrained (handles
  only on those edges); keyboard nudge + `effectiveEdge` consult `retimeableEdges`.
- onPointerDown: remove the derived early-return so products drag (track) + handle-
  drag (retime). cut tool stays blocked by `canCut` (products aren't `through`).
- keyboard: allow numbers/↑↓ (retrack) + K (couple) on products; ←/→ retime gated
  by retimeableEdges; Enter cut stays gated by canCut.

### F6. Tray interaction
A committed re-edit op keyed on a `|dep`/`|a`/`|b` suffix never resolves against the
clean base, but if its parent binds it binds in phase 2 → `_unresolved` undefined →
NOT shown. If the parent orphans, the re-edit op is `_unresolved=0` → fuzzy 0 →
orphaned → controller drops it. Consistent.

### Known deferred (documented, not shipped)
re-paired/consumed RIGHT-edge re-time and split-boundary re-time (need a segment-
relative delta base, not frozen-planned). Command palette / multi-select / batch.
Firestore sync (locked out, decision #1).

---

## Review-adjusted decisions (adversarial design review, GO-WITH-FIXES)

A 3-reviewer + synthesis pass against the real code returned GO-WITH-FIXES. All
folded in:

1. **(BLOCKER) Notes/checks reconcile is week/day-provenance-gated.** The stores key
   by raw positional `id` against ONE global map with no week scope. Backfilling
   `editKey` from `trains[id]` across weeks would bind a badge to the WRONG train.
   → Stamp `week`/`day` provenance on every entry at write. Backfill `editKey` only
   for **same-week** entries (id still valid). Re-key only **cross-week** entries via
   a stored `editKey` that resolves count-1 AND carries a real numeric id. No
   provenance → leave id-keyed (a missing badge is fine; a misattributed one is not).
2. Sever **stub** key is `op.editKey + '|stub'` (not unsuffixed) so `followLiveAgain`/
   `removeByKey` equality doesn't collapse stub/cut/attach edits under one key.
   looseDep `|dep`, split `|a`/`|b`. **Invariant:** a CLONE product (looseDep, split-b)
   must always carry a suffixed key; only an in-place mutation may carry a base-derived
   key, and even then the stub is suffixed for revert-distinctness.
3. `retimeableEdges(train)` is the single gate; `effectiveEdge`, `nudgeEdge`, and the
   selection-handle paint all consult it. Landed in the SAME change that drops the
   `isCutDerived` retime block (a split first-half has a real `depTime=cutTime`
   synthetic boundary that must never be nudged).
4. `retime` transform sets `train._retimed = true` (Section E chip depends on it).
5. F3 (two-phase `applyList`) lands before/with Section A (A reads the post-F3 flags).
6. `edit-reconcile.js` self-evaluates once in `init()` AND on events (the sole
   `schedule:rendered` dispatch fires before the edit-mode block loads on first paint).
7. Tray recompute is gated on committed-op-set / `editReconcileBase` identity change,
   not every `schedule:rendered` (scroll/zoom/closures re-render without re-projection).
8. `train-edits-store.js` `persistList` strips underscore-prefixed runtime flags via a
   `JSON.stringify` replacer (don't leak `_unresolved` to localStorage).
9. Fuzzy "shifted" auto-rebind (tray + notes re-key) requires a real numeric leg id;
   label-only/time-only keys route to manual confirm (ambiguous), never auto-rebind.
10. Notes/checks write path keeps its signature; provenance + same-week backfill make
    the immediacy edit-key unnecessary.
11. Lås hides the context-menu retrack twin by returning `null` from `build()` (the
    only `commitNow` path), not via CSS; all drag/keyboard gestures already gate on
    `!isEditing()`, which lock forces false.
