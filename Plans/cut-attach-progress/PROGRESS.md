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

**Branch:** all work lives on `feature/cut-attach-editing` (off `main`). Stay on this branch through Phase 5; do not merge to `main` until the feature is done. Phase 0 committed as `6103df48`.

**Locked decisions:** (1) edits are **device-local only** (localStorage; no Firestore). (2) **No hard blocks — soft-warn only**; negative/zero-duration bars are allowed and must stay visible.

| Phase | Title | Status | Todo / record |
|---|---|---|---|
| 0 | Scaffolding & inert overlay | ✅ done & verified | `phase-0-handoff.md` |
| 1 | Re-track + live truce | ✅ done & verified | `phase-1.md` (Handoff) |
| 2 | Re-time | ⏭️ next | `phase-2.md` |
| 3 | Cut (sever-turn / time-split) | pending | `phase-3.md` |
| 4 | Attach / couple | pending | `phase-4.md` |
| 5 | Polish & resilience | pending | `phase-5.md` |

**Current state:** re-track is live and verified. In edit mode you can move a bar to another track by **drag** (vertical ghost), **keyboard** (click to select → type a track number or `↑/↓`), or the **context menu** ("⇅ Flytta till spår…", works even outside edit mode). The move sticks against the 30s live poll — the `detectTrackChanges` **live-truce gate** skips all mutations for `manualOverride`/in-session trains and flags `_liveDisagrees` (⚡ chip) when the feed reports a different track. The live indicator is suppressed for edited trains; a top-center toast offers "Följ live igen" / "Visa inte igen". Edits persist across reload and survive repeated edits of the same train. Palette is now a horizontal strip bottom-center (no label overlap).

**Ground change to note:** records now carry a frozen **`plannedSubTrackIndex`** (parallel to `plannedTrackId`, set in both builders in `schedule-renderer.js`). Edit keys MUST key off the frozen planned fields, never the live `trackId`/`subTrackIndex` (a re-track mutates those). See `phase-1.md` Handoff → Gotchas.

**Open polish items (non-blocking):** the bottom-center palette + action bar float over the lowest track rows (Spår 15–16) during editing — same trade-off as the pre-existing action bar; acceptable, refine later if needed.
