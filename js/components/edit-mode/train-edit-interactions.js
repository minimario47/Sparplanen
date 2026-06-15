/**
 * Train Edit Interactions — the re-track + re-time engine (Phases 1–2).
 *
 * Owns direct manipulation of a `.train-bar` while an edit session is open:
 *   • pointer drag on the bar BODY (vertical → change TRACK) with a ghost moved
 *     by `transform` alone (never left/top — avoids the transition-storm);
 *   • pointer drag on an EDGE handle (horizontal → change arrival/departure
 *     TIME); the ghost is resized in px live, snapped to 5 min on drop (Alt
 *     bypasses snap → round to the minute);
 *   • click-to-select + keyboard: ↑/↓ re-track to an adjacent track, ←/→ re-time
 *     the active edge ±5 min (Shift = ±1), [ / ] pick the edge, digits jump to a
 *     track — the WCAG 2.5.7 non-drag path;
 *   • the single shared `retrack()` / `retime()` entry points used by drag,
 *     keyboard, AND the context-menu twin;
 *   • the live-truce toast shown on a train's first manual edit.
 *
 * An edit appends a draft op to the EditSession when a session is open, or
 * commits one directly to TrainEditsStore when invoked outside a session (the
 * context menu). The op-log projection does the actual move; this file never
 * mutates trains.js or the base data. Re-time params are minute deltas from the
 * FROZEN planned time per edge, so replays are order-independent (last-wins).
 *
 * Public API (window.EditModeInteractions):
 *   retrack(train, params, opts?)   // params:{trackId, subTrackIndex}; opts.commitNow
 *   retime(train, params, opts?)    // params:{arrDeltaMin?, depDeltaMin?}; opts.commitNow
 *   nudgeEdge(deltaMin, edge?)      // keyboard-style nudge of the selected train
 *   select(trainOrId)  clearSelection()  getSelectedId()
 *   followLiveAgain(train, editKey)
 */
(function () {
    'use strict';

    const DRAG_THRESHOLD = 4;            // px before a press becomes a drag
    const NUM_BUFFER_MS = 500;           // window to type a 2-digit track number
    const TOAST_DISMISS_KEY = 'sparplannen-edit-truce-toast-dismissed';

    let selectedId = null;
    let drag = null;                     // active drag state
    let numBuffer = '';
    let numTimer = null;
    let activeEdge = 'dep';              // which edge keyboard re-time targets ('arr'|'dep')

    // ── small helpers ────────────────────────────────────────────────────────
    function getCanvas() { return document.getElementById('timeline-canvas'); }
    function isEditing() { return !!(window.editSession && window.editSession.active); }
    function trainFromBar(bar) {
        if (!bar || !Array.isArray(window.cachedTrains)) return null;
        const id = bar.dataset.trainId;
        return window.cachedTrains.find((t) => String(t.id) === String(id)) || null;
    }
    function trainNumberOf(train) {
        return train.arrivalTrainNumber || train.departureTrainNumber
            || train.arrivalLabel || train.departureLabel || train.id;
    }
    // Track ids top→bottom, from the rendered layout (the canonical track order).
    function orderedTrackIds() {
        const st = window.scheduleState;
        if (!st || !Array.isArray(st.trackLayouts)) return [];
        return st.trackLayouts.map((l) => l.id);
    }

    // ── selection ────────────────────────────────────────────────────────────
    function paintSelection() {
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.querySelectorAll('.train-bar.edit-selected').forEach((el) => el.classList.remove('edit-selected'));
        canvas.querySelectorAll('.edit-resize-handle.is-active-edge').forEach((el) => el.classList.remove('is-active-edge'));
        if (selectedId == null) return;
        const bar = canvas.querySelector(`.train-bar[data-train-id="${CSS.escape(String(selectedId))}"]`);
        if (!bar) return;
        bar.classList.add('edit-selected');
        // Highlight the handle the keyboard nudges will move, so [ / ] gives
        // visible feedback even before the first nudge.
        const edge = effectiveEdge(selectedTrain(), activeEdge);
        const handle = bar.querySelector(edge === 'arr'
            ? '.edit-resize-handle--start' : '.edit-resize-handle--end');
        if (handle) handle.classList.add('is-active-edge');
    }
    function select(trainOrId) {
        selectedId = (trainOrId && typeof trainOrId === 'object') ? trainOrId.id : trainOrId;
        paintSelection();
    }
    function clearSelection() { selectedId = null; paintSelection(); }
    function getSelectedId() { return selectedId; }
    function selectedTrain() {
        if (selectedId == null || !Array.isArray(window.cachedTrains)) return null;
        return window.cachedTrains.find((t) => String(t.id) === String(selectedId)) || null;
    }

    // ── the one true re-track ────────────────────────────────────────────────
    function retrack(train, params, opts) {
        opts = opts || {};
        if (!train || !window.EditKey || typeof window.EditKey.buildEditKey !== 'function') return;
        const editKey = window.EditKey.buildEditKey(train);
        if (!editKey) return;

        const trackId = parseInt(params.trackId, 10);
        if (!Number.isFinite(trackId)) return;
        const subTrackIndex = Number.isFinite(parseInt(params.subTrackIndex, 10))
            ? parseInt(params.subTrackIndex, 10) : 0;

        // No-op guard: dropping a bar back where it already is must not log an op.
        const curTrack = parseInt(train.trackId, 10);
        const curSub = Number.isFinite(parseInt(train.subTrackIndex, 10)) ? parseInt(train.subTrackIndex, 10) : 0;
        if (trackId === curTrack && subTrackIndex === curSub) return;

        const wasOverridden = train.manualOverride === true;
        const op = {
            op: 'retrack',
            editKey,
            params: { trackId, subTrackIndex },
            before: { trackId: curTrack, subTrackIndex: curSub }
        };

        const session = window.EditSession;
        if (session && session.active && !opts.commitNow) {
            session.addOp(op);
        } else if (window.TrainEditsStore && typeof window.TrainEditsStore.addMany === 'function') {
            const sel = window.currentScheduleSelection || {};
            const scope = { week: sel.week || null, day: sel.day || null, anchorStr: sel.anchorStr || null };
            window.TrainEditsStore.addMany([{ ...op, scope }]);
        } else {
            return;
        }

        // Silence the live track-change indicator for this train (the gate stops
        // recording new ones; this kills any already on screen).
        if (train.id != null && window.TrackChangesStore && typeof window.TrackChangesStore.suppress === 'function') {
            window.TrackChangesStore.suppress(train.id);
        }
        if (!wasOverridden) maybeShowTruceToast(train, editKey);
    }

    // ── the one true re-time ─────────────────────────────────────────────────
    // Params are minute deltas FROM THE FROZEN PLANNED time per edge (the same
    // absolute-from-planned form the projection replays). Edits store only the
    // edge that moved; the projection composes them (last write per edge wins).
    function currentDeltas(train) {
        const d = {};
        const pArr = train.plannedArrTime || train.arrTime;
        const pDep = train.plannedDepTime || train.depTime;
        if (train.arrTime instanceof Date && pArr instanceof Date) {
            d.arrDeltaMin = Math.round((train.arrTime.getTime() - pArr.getTime()) / 60000);
        }
        if (train.depTime instanceof Date && pDep instanceof Date) {
            d.depDeltaMin = Math.round((train.depTime.getTime() - pDep.getTime()) / 60000);
        }
        return d;
    }

    function retime(train, params, opts) {
        opts = opts || {};
        if (!train || !window.EditKey || typeof window.EditKey.buildEditKey !== 'function') return;
        const editKey = window.EditKey.buildEditKey(train);
        if (!editKey) return;

        const p = {};
        if (Number.isFinite(params.arrDeltaMin)) p.arrDeltaMin = params.arrDeltaMin;
        if (Number.isFinite(params.depDeltaMin)) p.depDeltaMin = params.depDeltaMin;
        if (p.arrDeltaMin == null && p.depDeltaMin == null) return;

        const wasOverridden = train.manualOverride === true;
        const op = { op: 'retime', editKey, params: p, before: currentDeltas(train) };

        const session = window.EditSession;
        if (session && session.active && !opts.commitNow) {
            session.addOp(op);
        } else if (window.TrainEditsStore && typeof window.TrainEditsStore.addMany === 'function') {
            const sel = window.currentScheduleSelection || {};
            const scope = { week: sel.week || null, day: sel.day || null, anchorStr: sel.anchorStr || null };
            window.TrainEditsStore.addMany([{ ...op, scope }]);
        } else {
            return;
        }

        if (train.id != null && window.TrackChangesStore && typeof window.TrackChangesStore.suppress === 'function') {
            window.TrackChangesStore.suppress(train.id);
        }
        if (!wasOverridden) maybeShowTruceToast(train, editKey);
    }

    // Move one edge to an absolute wall-clock time (from a drop) → delta-from-
    // planned, with a no-op guard so re-dropping at the same minute logs nothing.
    function retimeEdgeAbsolute(train, edge, newAbs) {
        if (!train || !(newAbs instanceof Date)) return;
        const planned = edge === 'arr'
            ? (train.plannedArrTime || train.arrTime)
            : (train.plannedDepTime || train.depTime);
        if (!(planned instanceof Date)) return;
        const newDelta = Math.round((newAbs.getTime() - planned.getTime()) / 60000);
        const cur = currentDeltas(train);
        const curDelta = (edge === 'arr' ? cur.arrDeltaMin : cur.depDeltaMin) || 0;
        if (newDelta === curDelta) return; // no-op
        retime(train, edge === 'arr' ? { arrDeltaMin: newDelta } : { depDeltaMin: newDelta });
    }

    // Which edge a keyboard nudge targets: the requested one if it exists on this
    // train, else fall back to whichever edge the bar actually has.
    function effectiveEdge(train, requested) {
        const want = requested || activeEdge;
        const hasArr = train && train.arrTime instanceof Date;
        const hasDep = train && train.depTime instanceof Date;
        if (want === 'arr' && hasArr) return 'arr';
        if (want === 'dep' && hasDep) return 'dep';
        return hasDep ? 'dep' : 'arr';
    }

    function nudgeEdge(deltaMin, requestedEdge) {
        const train = selectedTrain();
        if (!train) return;
        const edge = effectiveEdge(train, requestedEdge);
        const cur = edge === 'arr' ? train.arrTime : train.depTime;
        if (!(cur instanceof Date)) return;
        retimeEdgeAbsolute(train, edge, new Date(cur.getTime() + deltaMin * 60000));
    }

    function roundToMinute(date) {
        if (!(date instanceof Date)) return date;
        return new Date(Math.round(date.getTime() / 60000) * 60000);
    }

    // ── live-truce toast ─────────────────────────────────────────────────────
    let activeToast = null;
    function dismissToast() {
        if (activeToast && activeToast.parentNode) activeToast.parentNode.removeChild(activeToast);
        activeToast = null;
    }
    function maybeShowTruceToast(train, editKey) {
        try { if (localStorage.getItem(TOAST_DISMISS_KEY) === 'true') return; } catch (_) { /* ignore */ }
        dismissToast();
        const num = trainNumberOf(train);
        const trainId = train.id;

        const toast = document.createElement('div');
        toast.className = 'edit-truce-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        const msg = document.createElement('span');
        msg.className = 'edit-truce-toast__msg';
        msg.textContent = `Live-spårändringar pausade för tåg ${num} — manuell placering gäller.`;
        toast.appendChild(msg);

        const relink = document.createElement('button');
        relink.type = 'button';
        relink.className = 'edit-truce-toast__action';
        relink.textContent = 'Följ live igen';
        relink.addEventListener('click', () => {
            followLiveAgain({ id: trainId }, editKey);
            dismissToast();
        });
        toast.appendChild(relink);

        const never = document.createElement('button');
        never.type = 'button';
        never.className = 'edit-truce-toast__dismiss';
        never.textContent = 'Visa inte igen';
        never.addEventListener('click', () => {
            try { localStorage.setItem(TOAST_DISMISS_KEY, 'true'); } catch (_) { /* ignore */ }
            dismissToast();
        });
        toast.appendChild(never);

        document.body.appendChild(toast);
        activeToast = toast;
        setTimeout(() => { if (activeToast === toast) dismissToast(); }, 7000);
    }

    // Revert a train's manual re-track and re-enable live tracking for it.
    function followLiveAgain(train, editKey) {
        if (!train) return;
        if (!editKey && window.EditKey) editKey = window.EditKey.buildEditKey(train);
        // committed ops
        if (window.TrainEditsStore && typeof window.TrainEditsStore.getAll === 'function') {
            window.TrainEditsStore.getAll()
                .filter((o) => o && o.editKey === editKey)
                .forEach((o) => window.TrainEditsStore.remove(o.id));
        }
        // in-progress draft ops
        if (window.EditSession && window.EditSession.active && typeof window.EditSession.removeByKey === 'function') {
            window.EditSession.removeByKey(editKey);
        }
        if (train.id != null && window.TrackChangesStore && typeof window.TrackChangesStore.unsuppress === 'function') {
            window.TrackChangesStore.unsuppress(train.id);
        }
    }

    // ── pointer drag (vertical re-track) ─────────────────────────────────────
    function onPointerDown(e) {
        if (!isEditing() || e.button !== 0) return;
        const bar = e.target.closest && e.target.closest('.train-bar');
        const canvas = getCanvas();
        if (!bar || !canvas || !canvas.contains(bar)) {
            // empty-grid press in edit mode clears the current selection
            if (!bar) clearSelection();
            return;
        }
        const train = trainFromBar(bar);
        if (!train) return;
        e.stopPropagation(); // claim the gesture from the normal bar click/tooltip
        // An edge handle → horizontal re-time of that edge; the bar body →
        // vertical re-track. Capture the bar's pixel geometry so an edge drag can
        // resize the ghost live without recomputing it from times every frame.
        const handle = e.target.closest && e.target.closest('.edit-resize-handle');
        const mode = handle
            ? (handle.classList.contains('edit-resize-handle--end') ? 'dep' : 'arr')
            : 'track';
        drag = { mode, train, bar, ghost: null, startY: e.clientY, startX: e.clientX,
                 moved: false, lastDy: 0, lastDx: 0, raf: 0, alt: e.altKey,
                 baseLeft: parseFloat(bar.style.left) || 0,
                 baseWidth: parseFloat(bar.style.width) || 0,
                 pointerId: e.pointerId, capture: canvas };
        // Capture the pointer so move/up land here and, crucially, so the other
        // bars stop firing hover/tooltip work for the duration of the drag.
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerCancel, true);
    }

    function startGhost() {
        const bar = drag.bar;
        const ghost = bar.cloneNode(true);
        ghost.classList.add('edit-ghost');
        ghost.classList.remove('is-selected', 'edit-selected');
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '2000';
        bar.parentNode.appendChild(ghost);
        bar.classList.add('edit-dragging');
        drag.ghost = ghost;
    }

    function paintGhost() {
        drag.raf = 0;
        if (!drag || !drag.ghost) return;
        if (drag.mode === 'track') {
            // Vertical only: a re-track changes track, never time.
            drag.ghost.style.transform = `translateY(${drag.lastDy}px)`;
            return;
        }
        // Edge re-time: resize the ghost horizontally. The left edge moves both
        // left & width; the right edge moves width only. No hard clamp on the
        // committed time (decision #2) — only floor the ghost's *visual* width so
        // an inverted drag still shows a thin stub instead of vanishing.
        let left = drag.baseLeft;
        let width = drag.baseWidth;
        if (drag.mode === 'arr') { left = drag.baseLeft + drag.lastDx; width = drag.baseWidth - drag.lastDx; }
        else { width = drag.baseWidth + drag.lastDx; }
        if (width < 2) { if (drag.mode === 'arr') left = drag.baseLeft + drag.baseWidth - 2; width = 2; }
        drag.ghost.style.left = `${left}px`;
        drag.ghost.style.width = `${width}px`;
    }

    function onPointerMove(e) {
        if (!drag) return;
        drag.alt = e.altKey;                 // Alt (held at drop) bypasses snap
        const dy = e.clientY - drag.startY;
        const dx = e.clientX - drag.startX;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!drag.moved) { drag.moved = true; startGhost(); }
        // Batch the write to one per frame so a flurry of pointermove events can't
        // thrash the layout.
        drag.lastDy = dy;
        drag.lastDx = dx;
        if (!drag.raf) drag.raf = requestAnimationFrame(paintGhost);
    }

    function endDrag() {
        if (drag) {
            if (drag.raf) { cancelAnimationFrame(drag.raf); drag.raf = 0; }
            if (drag.capture && drag.pointerId != null) {
                try { drag.capture.releasePointerCapture(drag.pointerId); } catch (_) { /* ignore */ }
            }
        }
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onPointerCancel, true);
    }

    function onPointerUp(e) {
        if (!drag) return;
        const d = drag;
        endDrag();
        if (!d.moved) {                       // a click → select for keyboard editing
            select(d.train);
            if (d.mode !== 'track') { activeEdge = d.mode; paintSelection(); }
            drag = null;
            return;
        }
        if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
        d.bar.classList.remove('edit-dragging'); // restores the bar if we snap back
        drag = null;
        const coords = (window.GridCoords && typeof window.GridCoords.fromEvent === 'function')
            ? window.GridCoords.fromEvent(e) : null;
        if (d.mode === 'track') {
            if (coords && Number.isFinite(Number(coords.trackId))) {
                retrack(d.train, { trackId: coords.trackId, subTrackIndex: coords.subTrackIndex || 0 });
                select(d.train);
            }
            return;
        }
        // Edge re-time: drop x → new edge time. Alt bypasses the 5-min snap.
        if (coords && coords.time instanceof Date) {
            const newTime = d.alt
                ? roundToMinute(coords.time)
                : (coords.snappedTime instanceof Date ? coords.snappedTime : window.GridCoords.snapTime(coords.time));
            retimeEdgeAbsolute(d.train, d.mode, newTime);
            activeEdge = d.mode;
            select(d.train);
        }
    }

    function onPointerCancel() {
        if (!drag) return;
        endDrag();
        if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
        if (drag.bar) drag.bar.classList.remove('edit-dragging');
        drag = null;
    }

    // ── keyboard re-track (non-drag path) ────────────────────────────────────
    function isTypingTarget(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }
    function commitNumberBuffer() {
        const n = parseInt(numBuffer, 10);
        numBuffer = '';
        if (numTimer) { clearTimeout(numTimer); numTimer = null; }
        const train = selectedTrain();
        if (!train || !Number.isFinite(n)) return;
        if (!orderedTrackIds().includes(n)) return; // not a real track — ignore
        retrack(train, { trackId: n, subTrackIndex: 0 });
    }
    function nudgeTrack(dir) {
        const train = selectedTrain();
        if (!train) return;
        const ids = orderedTrackIds();
        const cur = parseInt(train.trackId, 10);
        const idx = ids.indexOf(cur);
        if (idx === -1) return;
        const next = ids[idx + dir];
        if (next == null) return;
        retrack(train, { trackId: next, subTrackIndex: 0 });
    }
    function onKeydown(e) {
        if (!isEditing() || isTypingTarget(e.target)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return; // leave undo/redo etc. alone
        if (selectedId == null) return;
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            numBuffer += e.key;
            if (numTimer) clearTimeout(numTimer);
            if (numBuffer.length >= 2) { commitNumberBuffer(); return; }
            numTimer = setTimeout(commitNumberBuffer, NUM_BUFFER_MS);
            return;
        }
        if (e.key === 'ArrowUp') { e.preventDefault(); nudgeTrack(-1); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); nudgeTrack(1); return; }
        // Re-time the active edge: ←/→ = ±5 min, Shift+←/→ = ±1 min.
        if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeEdge(e.shiftKey ? -1 : -5); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); nudgeEdge(e.shiftKey ? 1 : 5); return; }
        // [ / ] pick which edge (arrival / departure) the nudges target.
        if (e.key === '[') { e.preventDefault(); activeEdge = 'arr'; paintSelection(); return; }
        if (e.key === ']') { e.preventDefault(); activeEdge = 'dep'; paintSelection(); return; }
    }

    // ── wiring ───────────────────────────────────────────────────────────────
    function init() {
        const canvas = getCanvas();
        if (canvas) {
            // capture phase: run before the bar's own click/tooltip handlers
            canvas.addEventListener('pointerdown', onPointerDown, true);
            canvas.addEventListener('click', (e) => {
                if (isEditing() && e.target.closest && e.target.closest('.train-bar')) {
                    e.stopPropagation(); // suppress normal selection while editing
                }
            }, true);
        }
        document.addEventListener('keydown', onKeydown);
        // Re-apply the selection ring after every re-render (bars are rebuilt).
        window.addEventListener('schedule:rendered', paintSelection);
        // Leaving edit mode drops the selection.
        if (window.EditSession && typeof window.EditSession.subscribe === 'function') {
            window.EditSession.subscribe((evt) => {
                if (evt && (evt.type === 'discard' || evt.type === 'commit')) clearSelection();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.EditModeInteractions = { retrack, retime, nudgeEdge, select, clearSelection, getSelectedId, followLiveAgain };
})();
