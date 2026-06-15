/**
 * Edit Projection — replays the edit op-log over the read-only base trains.
 *
 * Called by schedule-renderer.js#prepareTrainData immediately after the
 * user-trains merge, on the projected `mergedTrains` copy ONLY. It applies, in
 * order: (1) committed ops from TrainEditsStore, then (2) the active session's
 * in-memory draft ops (so uncommitted edits show live while editing). The base
 * data and trains.js are never touched.
 *
 * Each op resolves its stable editKey to exactly one train; count !== 1 is left
 * unapplied and flagged (`op._unresolved`) for the Phase-5 reconcile tray —
 * never auto-applied to a wrong/ambiguous bar.
 *
 * Transforms are pure mutations of a single projected train object. New op
 * types register a case here per phase. Phase 1 ships `retrack`; Phase 2 `retime`.
 *
 * Public API:
 *   window.applyTrainEdits(trains) → trains (mutated in place)
 *   window.EditProjection.registerTransform(op, fn)
 */
(function () {
    'use strict';

    const TRANSFORMS = {
        // Re-track: move a bar to another track and/or sub-lane. plannedTrackId
        // stays frozen so the editKey survives; only the live trackId moves.
        retrack(train, params) {
            const t = parseInt(params.trackId, 10);
            const s = parseInt(params.subTrackIndex, 10);
            if (Number.isFinite(t)) train.trackId = t;
            if (Number.isFinite(s)) train.subTrackIndex = s;
            // A manual placement is a single, deliberate track — drop any live
            // split visual so the bar doesn't render torn across two tracks.
            if (train.splitTracks) train.splitTracks = null;
        },

        // Re-time: shift arrival and/or departure. Params carry a delta in
        // MINUTES FROM THE FROZEN PLANNED time per edge, so replaying is
        // order-independent and last-write-wins (each op is absolute-from-planned,
        // not incremental). Reassigning to a fresh Date — never mutating in place —
        // keeps plannedArrTime/plannedDepTime (the edit-key source) intact. Date
        // arithmetic crosses midnight naturally, so a time pushed past the 06:00
        // service-day edge lands at the right wall-clock position on the canvas.
        retime(train, params) {
            const pArr = train.plannedArrTime || train.arrTime;
            const pDep = train.plannedDepTime || train.depTime;
            if (params.arrDeltaMin != null && pArr instanceof Date) {
                train.arrTime = new Date(pArr.getTime() + params.arrDeltaMin * 60000);
            }
            if (params.depDeltaMin != null && pDep instanceof Date) {
                train.depTime = new Date(pDep.getTime() + params.depDeltaMin * 60000);
            }
            // Soft-warn only (locked decision #2): a departure at/ before arrival
            // is allowed and must stay visible — flag it so the decorator can hatch
            // it and chip a warning. Never block, never clamp the time.
            if (train.arrTime instanceof Date && train.depTime instanceof Date
                && train.depTime.getTime() <= train.arrTime.getTime()) {
                train._inverted = true;
            }
        }
    };

    function registerTransform(op, fn) {
        if (typeof op === 'string' && typeof fn === 'function') TRANSFORMS[op] = fn;
    }

    function applyOne(train, op, isDraft) {
        const fn = TRANSFORMS[op.op];
        if (!fn) return;
        try {
            fn(train, op.params || {}, op);
        } catch (e) {
            console.warn('[EditProjection] transform failed', op, e);
            return;
        }
        train._edited = true;
        train.manualOverride = true;
        train._editOps = (train._editOps || []).concat(op.op);
        if (isDraft) train._draft = true;
    }

    function applyList(trains, ops, isDraft) {
        if (!Array.isArray(ops) || !ops.length) return;
        const EditKey = window.EditKey;
        if (!EditKey || typeof EditKey.resolveEditKey !== 'function') return;
        ops.forEach((op) => {
            if (!op || !op.editKey) return;
            const { matches, count } = EditKey.resolveEditKey(op.editKey, trains);
            if (count !== 1) { op._unresolved = count; return; }
            delete op._unresolved;
            applyOne(matches[0], op, isDraft);
        });
    }

    function applyTrainEdits(trains) {
        if (!Array.isArray(trains)) return trains;
        // 1) committed ops (persisted, device-local)
        const committed = (window.TrainEditsStore && typeof window.TrainEditsStore.getAll === 'function')
            ? window.TrainEditsStore.getAll()
            : [];
        applyList(trains, committed, false);
        // 2) active session draft ops (in-memory, not yet persisted)
        const session = window.EditSession;
        if (session && session.active && typeof session.getOps === 'function') {
            applyList(trains, session.getOps(), true);
        }
        return trains;
    }

    window.applyTrainEdits = applyTrainEdits;
    window.EditProjection = { registerTransform, applyTrainEdits };
})();
