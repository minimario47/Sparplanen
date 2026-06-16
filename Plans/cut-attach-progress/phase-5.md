# Phase 5 — Polish & resilience  ·  status: DONE (re-scoped by owner)

> Final phase. The owner re-scoped it mid-build (see **Scope correction** below):
> the orphan-reconcile tray and the notes/checks "carry across regen" retrofit
> were CUT, because they violated the load-bearing principle that **an edit/note
> belongs to ONE train occurrence and must never carry or rebind to another train**
> (a repeating train number on another day/week is a *different* train).

## Scope correction (owner, authoritative)
> "The changes should apply only to that train on that specific time. No change
> should persist to another train (even though train numbers repeat themselves
> every day, they are not the same!)"

The `editKey` already encodes this — `week|day|track|sub|arrNum@arrTime|depNum@depTime`
— so an op only applies to the exact occurrence it was made on, and across a new
week/day it simply does not resolve (no auto-apply, no misattribution). That is the
desired behaviour; there is therefore **nothing to "reconcile"**, and trying to
rebind an orphan to a same-numbered train elsewhere is wrong. Verified in-browser:
editing one occurrence of train 3593 moved only it; the other 3593 (a different
occurrence) was untouched.

## Shipped
- [x] **Safe re-editability of cut / re-paired products.** Products carry a stable
  `_editKeyBase` handle (stub `…|stub`, loose-dep `…|dep`, split `…|a`/`…|b`,
  re-paired source = its own key) so a re-edit op binds to them. `applyList` is now
  two-phase (retry after append) so an op keyed on an appended product resolves.
  Enabled: **re-track + couple on all products**, plus **re-time on the anchored
  edge only** (severed-stub arrival, loose-departure time, split halves' real edge)
  via the single `retimeableEdges()` gate that the decorator handles AND the
  keyboard/drag paths consult. Re-paired RIGHT-edge re-time + split-boundary re-time
  stay deferred (need a segment-relative delta base, not frozen-planned).
- [x] **"🔒 Lås" look-only toggle** (`edit-lock.js`, header button). Per-device,
  persisted; blocks entering edit mode + hides the context-menu retrack twin (the
  one commitNow path); discards an open session on lock.
- [x] **Re-time delay-decoupled chip** (⏱, `_retimed` flag → decorator chip),
  shown when not inverted.
- [x] Reduced-motion: new chrome (Lås button, ⏱ chip) is static; no animation
  dependency. Existing Phase 1–4 affordances were already static.
- [x] Hygiene: `TrainEditsStore.persistList` strips runtime flags
  (`_unresolved`/`_consumeUnresolved`/`_declined`) so they never leak to localStorage.
- [x] **Notes / checks are occurrence-scoped.** Stored under `train.id` but RESOLVED
  by occurrence identity (`editKey`): a note/check is shown only on the train whose
  identity matches, so it stays on its one occurrence, never appears on another train
  (same number on another day/week, or a renumbered id slot now held by a different
  train), and follows its train across an id renumber. Identity is captured at write
  (id valid in the build); reads search by `editKey` and consolidate to the current
  id; a legacy entry (no `editKey`) is adopted once to the train currently at its id.

## Cut (do NOT rebuild without the owner)
- [ ] ~~Orphan-reconcile tray~~ — removed. Edits are occurrence-scoped; an op that
  doesn't resolve just doesn't apply (correct). No cross-train rebinding.
- [ ] ~~Notes/checks "carry across regen" retrofit~~ (the week-AGNOSTIC migration) —
  removed. Carrying a note to a same-numbered train next week is persisting to
  another train (forbidden). Replaced by the occurrence-scoped resolution above,
  which is week/day-INCLUSIVE so it never crosses occurrences.

## Verification (in-browser, 0 edit-mode console errors)
- Occurrence-scoping: edit one occurrence of a repeated number → only it changes. ✔
- Re-editability: cut→retrack/retime/couple the stub & loose-dep (phase-2 bind),
  split halves' anchored edge only, attach re-pair + consume unchanged. ✔
- Re-time gate: departure nudge on a severed stub creates no op. ✔
- Lås: blocks edit mode, persists, discards on lock. ✔  ⏱ chip renders. ✔
