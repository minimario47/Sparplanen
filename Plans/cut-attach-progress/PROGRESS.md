# Cut & Attach editing — build progress index

Running index for the multi-phase board-editing feature. Each phase ends with a
handoff file in this folder so work resumes cleanly after a context reset.

**Always-valid background (read these first):**
- Design research (canonical): `Plans/cut-attach-editing-design.md`
- Execution plan (phases, decisions, reuse map): `/Users/mikailyenigun/.claude/plans/perfect-please-plan-the-purring-llama.md`
- Memory: `cut-attach-edit-feature-design` (load-bearing decisions)

**Branch:** all work lives on `feature/cut-attach-editing` (off `main`). Stay on this branch through Phase 5; do not merge to `main` until the feature is done. Phase 0 committed as `6103df48`.

**Locked decisions:** (1) edits are **device-local only** (localStorage; no Firestore). (2) **No hard blocks — soft-warn only**; negative/zero-duration bars are allowed and must stay visible.

| Phase | Title | Status | Handoff |
|---|---|---|---|
| 0 | Scaffolding & inert overlay | ✅ done & verified | `phase-0-handoff.md` |
| 1 | Re-track + live truce | ⏭️ next | — |
| 2 | Re-time | pending | — |
| 3 | Cut (sever-turn / time-split) | pending | — |
| 4 | Attach / couple | pending | — |
| 5 | Polish & resilience | pending | — |

**Current state:** the edit-mode skeleton is live. Pen toggle (header, `#edit-mode-toggle`, key `E`) enters a bounded session: `is-editing` body class, left tool palette (all tools disabled), bottom action bar (Ångra/Gör om/Avbryt/Slutför working). An append-only op-log overlay (`TrainEditsStore` + `applyTrainEdits` projection) is wired and proven end-to-end with a `retrack` transform; `plannedTrackId` stays frozen so edit keys survive re-tracks. No UI yet creates ops — that's Phase 1.

**Open polish items (non-blocking):** the palette currently overlaps the leftmost track labels (Spår 1–4); reposition in Phase 1.
