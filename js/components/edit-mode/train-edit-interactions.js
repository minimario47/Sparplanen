/**
 * Train Edit Interactions — the re-track engine (Phase 1).
 *
 * Owns direct manipulation of a `.train-bar` while an edit session is open:
 *   • pointer drag (vertical only → change TRACK, not time) with a ghost moved
 *     by `transform` alone (never left/top — avoids the transition-storm);
 *   • click-to-select + keyboard re-track (type a track number, ↑/↓ to an
 *     adjacent track) — the WCAG 2.5.7 non-drag path;
 *   • the single shared `retrack(train, params)` entry point used by drag,
 *     keyboard, AND the context-menu twin;
 *   • the live-truce toast shown on a train's first manual re-track, with a
 *     "Följ live igen" relink and a "Visa inte igen" opt-out.
 *
 * A re-track appends a `retrack` op to the EditSession (draft) when a session is
 * open, or commits one directly to TrainEditsStore when invoked outside a
 * session (the context menu). The op-log projection does the actual move; this
 * file never mutates trains.js or the base data.
 *
 * Public API (window.EditModeInteractions):
 *   retrack(train, params, opts?)   // params:{trackId, subTrackIndex}; opts.commitNow
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
        if (selectedId == null) return;
        const bar = canvas.querySelector(`.train-bar[data-train-id="${CSS.escape(String(selectedId))}"]`);
        if (bar) bar.classList.add('edit-selected');
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
        drag = { train, bar, ghost: null, startY: e.clientY, startX: e.clientX,
                 moved: false, lastDy: 0, raf: 0, pointerId: e.pointerId, capture: canvas };
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
        if (drag && drag.ghost) drag.ghost.style.transform = `translateY(${drag.lastDy}px)`;
    }

    function onPointerMove(e) {
        if (!drag) return;
        const dy = e.clientY - drag.startY;
        const dx = e.clientX - drag.startX;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!drag.moved) { drag.moved = true; startGhost(); }
        // Vertical only: a re-track changes track, never time. Batch the write to
        // one per frame so a flurry of pointermove events can't thrash the layout.
        drag.lastDy = dy;
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
            drag = null;
            return;
        }
        let target = null;
        if (window.GridCoords && typeof window.GridCoords.fromEvent === 'function') {
            target = window.GridCoords.fromEvent(e);
        }
        if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
        d.bar.classList.remove('edit-dragging'); // restores the bar if we snap back
        drag = null;
        if (target && Number.isFinite(Number(target.trackId))) {
            retrack(d.train, { trackId: target.trackId, subTrackIndex: target.subTrackIndex || 0 });
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

    window.EditModeInteractions = { retrack, select, clearSelection, getSelectedId, followLiveAgain };
})();
