/**
 * Edit Session — the bounded editing session opened by the pen toggle.
 *
 * Holds an in-memory, ordered list of DRAFT ops plus a redo stack. The
 * immutable base is the snapshot, so we clone nothing: undo = pop a draft op
 * and re-project; redo = push it back. Committing flattens the draft log into
 * the persisted TrainEditsStore as one batch; discarding drops it.
 *
 * While a session is active, `document.body` carries `is-editing` (drives all
 * edit-mode CSS) and `window.editSession.active` is true (the live delay feed
 * reads this to stop fighting in-progress edits — see Phase 1).
 *
 * Every state change funnels through `_refresh()`, which dispatches
 * `train-edits-changed`; schedule-renderer re-runs prepareTrainData (→
 * applyTrainEdits, which layers these draft ops) + renderFullSchedule.
 *
 * Public API (window.EditSession / window.editSession):
 *   active                 (boolean)
 *   start()  commit()  discard()
 *   addOp(op)              → op            // op: {op, editKey, params, before?, after?}
 *   removeByKey(editKey)   → count         // drop all draft ops for one train
 *   undo()   redo()
 *   canUndo()  canRedo()  getOps()  pendingCount()
 *   subscribe(cb)          → unsubscribe()  // cb({type}) on any state change
 */
(function () {
    'use strict';

    const subscribers = new Set();
    let ops = [];
    let redo = [];

    const api = {
        active: false
    };

    function emit(type) {
        subscribers.forEach((cb) => { try { cb({ type }); } catch (e) { console.error(e); } });
    }

    function rerender() {
        // Mirror the user-trains-changed path so the projection re-applies.
        try {
            window.dispatchEvent(new CustomEvent('train-edits-changed', { detail: { type: 'session' } }));
        } catch (_) { /* ignore */ }
    }

    function _refresh(type) {
        emit(type);
        rerender();
    }

    function start() {
        if (api.active) return;
        api.active = true;
        ops = [];
        redo = [];
        document.body.classList.add('is-editing');
        _refresh('start');
    }

    function addOp(op) {
        if (!api.active || !op || !op.op || !op.editKey) return null;
        const record = {
            op: op.op,
            editKey: op.editKey,
            params: op.params || {},
            before: op.before || null,
            after: op.after || null
        };
        ops.push(record);
        redo = [];
        _refresh('add');
        return record;
    }

    function undo() {
        if (!api.active || !ops.length) return;
        redo.push(ops.pop());
        _refresh('undo');
    }

    // Drop every draft op for one editKey (used by the "follow live again"
    // relink, which reverts a train's in-progress manual edits). Not part of the
    // undo stack — these are gone, not undoable.
    function removeByKey(editKey) {
        if (!api.active || !editKey) return 0;
        const keep = ops.filter((o) => o.editKey !== editKey);
        const removed = ops.length - keep.length;
        if (!removed) return 0;
        ops = keep;
        redo = [];
        _refresh('remove');
        return removed;
    }

    function redoOp() {
        if (!api.active || !redo.length) return;
        ops.push(redo.pop());
        _refresh('redo');
    }

    function finalize(type) {
        api.active = false;
        ops = [];
        redo = [];
        document.body.classList.remove('is-editing');
    }

    function commit() {
        if (!api.active) return;
        const pending = ops.slice();
        const sel = window.currentScheduleSelection || {};
        const scope = { week: sel.week || null, day: sel.day || null, anchorStr: sel.anchorStr || null };
        finalize('commit');
        if (pending.length && window.TrainEditsStore && typeof window.TrainEditsStore.addMany === 'function') {
            // addMany dispatches train-edits-changed → single post-commit render
            // (now showing committed, not draft, styling since active is false).
            window.TrainEditsStore.addMany(pending.map((o) => ({ ...o, scope })));
        } else {
            _refresh('commit');
        }
        emit('commit');
    }

    function discard() {
        if (!api.active) return;
        finalize('discard');
        _refresh('discard');
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    api.start = start;
    api.commit = commit;
    api.discard = discard;
    api.addOp = addOp;
    api.removeByKey = removeByKey;
    api.undo = undo;
    api.redo = redoOp;
    api.canUndo = () => api.active && ops.length > 0;
    api.canRedo = () => api.active && redo.length > 0;
    api.getOps = () => ops.slice();
    api.pendingCount = () => ops.length;
    api.subscribe = subscribe;

    window.EditSession = api;
    window.editSession = api; // alias: the live feed checks window.editSession.active
})();
