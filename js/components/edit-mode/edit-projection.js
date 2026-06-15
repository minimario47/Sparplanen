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
 * Transforms mutate a single projected train object and MAY return an array of
 * extra records to append (the projection layer appends them) — `cut` is the one
 * op type that changes record count. New op types register a case here per phase.
 * Phase 1 ships `retrack`; Phase 2 `retime`; Phase 3 `cut`.
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
        },

        // Cut: sever a turn or split a dwell. RETURNS the extra record(s) the
        // projection layer appends to the train list (the only op type that
        // changes record COUNT). Two variants:
        //  • 'sever' — a through bar → an arrival-only stub (this record) + a
        //    loose departure-only segment (returned), each a clean single-leg
        //    record, so workload/delay count each leg exactly once unchanged.
        //  • 'split' — one dwell → two consecutive same-track records at cutTime,
        //    sharing a `_splitSibling` id. The cut BOUNDARY times are marked
        //    synthetic and the boundary-side numbers blanked, so the per-leg
        //    machinery (workload :79/:89 synthetic guard, getDelayContextsForTrain
        //    keyed on the real number) counts/looks-up each real leg exactly once
        //    with NO changes to those consumers. `_splitSibling` only defends the
        //    overlap-based consumers (conflict-detector, _packLanes).
        cut(train, params) {
            params = params || {};
            const variant = params.variant === 'split' ? 'split' : 'sever';

            if (variant === 'sever') {
                const dep = Object.assign({}, train);
                dep.id = `${train.id}::dep`;
                dep.arrTime = null;
                dep.arrivalTrainNumber = '';
                dep.arrivalLabel = '';
                dep.arrSynthetic = false;
                dep.movementKind = 'departure';
                dep.splitTracks = null;
                dep._cutLooseDeparture = true;
                // The matched record becomes the arrival-only stub.
                train.depTime = null;
                train.departureTrainNumber = '';
                train.departureLabel = '';
                train.depSynthetic = false;
                train.movementKind = 'arrival';
                train.splitTracks = null;
                train._cutSevered = true;
                return [dep];
            }

            // Time-split. Single-ended / malformed bars can't be split; return
            // `false` to signal failure so applyOne does NOT mark the train edited.
            const pArr = (train.plannedArrTime instanceof Date) ? train.plannedArrTime : train.arrTime;
            if (!(train.arrTime instanceof Date) || !(train.depTime instanceof Date) || !(pArr instanceof Date)) {
                return false;
            }
            let cutMs = Number.isFinite(params.cutOffsetMin)
                ? pArr.getTime() + params.cutOffsetMin * 60000
                : train.arrTime.getTime() + (train.depTime.getTime() - train.arrTime.getTime()) / 2;
            // Keep the cut strictly inside the dwell so both halves stay visible.
            const lo = train.arrTime.getTime() + 60000;
            const hi = train.depTime.getTime() - 60000;
            if (hi > lo) cutMs = Math.max(lo, Math.min(hi, cutMs));
            const cutTime = new Date(cutMs);
            const sib = String(train.id);

            const b = Object.assign({}, train);
            b.id = `${train.id}::b`;
            b.arrTime = cutTime;
            b.arrivalTrainNumber = '';
            b.arrivalLabel = '';
            b.arrSynthetic = true;          // synthetic cut boundary, not a real arrival
            b.movementKind = 'departure';
            b.splitTracks = null;
            b._splitSibling = sib;
            b.editDerived = true;

            // The matched record becomes the first half [arr .. cutTime].
            train.depTime = cutTime;
            train.departureTrainNumber = '';
            train.departureLabel = '';
            train.depSynthetic = true;      // synthetic cut boundary, not a real departure
            train.movementKind = 'arrival';
            train.splitTracks = null;
            train._splitSibling = sib;
            train.editDerived = true;
            return [b];
        }
    };

    function registerTransform(op, fn) {
        if (typeof op === 'string' && typeof fn === 'function') TRANSFORMS[op] = fn;
    }

    // Returns an array of extra records to append (cut), or null.
    function applyOne(train, op, isDraft) {
        const fn = TRANSFORMS[op.op];
        if (!fn) return null;
        let extra = null;
        try {
            extra = fn(train, op.params || {}, op);
        } catch (e) {
            console.warn('[EditProjection] transform failed', op, e);
            return null;
        }
        // A transform returns `false` to DECLINE (its preconditions failed at
        // projection time) — don't then claim the train was manually edited.
        if (extra === false) { op._declined = true; return null; }
        delete op._declined;
        train._edited = true;
        train.manualOverride = true;
        train._editOps = (train._editOps || []).concat(op.op);
        if (isDraft) train._draft = true;
        if (Array.isArray(extra) && extra.length) {
            extra.forEach((rec) => {
                rec._edited = true;
                rec.manualOverride = true;
                rec._editOps = [op.op];
                if (isDraft) rec._draft = true;
            });
            return extra;
        }
        return null;
    }

    function applyList(trains, ops, isDraft) {
        if (!Array.isArray(ops) || !ops.length) return;
        const EditKey = window.EditKey;
        if (!EditKey || typeof EditKey.resolveEditKey !== 'function') return;
        // Records produced by record-adding ops (cut) are collected and appended
        // AFTER the loop, so an op's editKey never resolves against a sibling a
        // prior op in the same pass produced.
        const appended = [];
        ops.forEach((op) => {
            if (!op || !op.editKey) return;
            const { matches, count } = EditKey.resolveEditKey(op.editKey, trains);
            if (count !== 1) { op._unresolved = count; return; }
            delete op._unresolved;
            const extra = applyOne(matches[0], op, isDraft);
            if (extra) appended.push(...extra);
        });
        if (appended.length) trains.push(...appended);
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
