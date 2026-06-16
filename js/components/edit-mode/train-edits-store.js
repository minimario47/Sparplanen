/**
 * Train Edits Store
 *
 * Persists the operator's manual board edits (re-track, re-time, cut, attach,
 * couple, …) as an APPEND-ONLY OP LOG, device-local in localStorage. It is the
 * committed counterpart to the in-memory EditSession draft log.
 *
 * Cloned from `user-trains-store.js` (same IIFE / negative-id / subscribe /
 * CustomEvent shape) so the rest of the app treats it identically.
 *
 * An op is NOT a mutated record — it is a transform keyed by a STABLE natural
 * key (see edit-key.js) that survives the weekly trains.js regeneration. The
 * projection (`applyTrainEdits`, edit-projection.js) replays the log over the
 * read-only base at render time. `trains.js` is never mutated.
 *
 * Op record shape:
 *   {
 *     id: number (negative; auto-assigned)
 *     op: 'retrack'|'retime'|'cut'|'attach'|'couple'|'split'|'delete'
 *     editKey: string                       // stable key the op binds to
 *     params: object                        // op-specific transform params
 *     before: object | null                 // AUDIT/diagnostic snapshot only
 *     after:  object | null                 // AUDIT/diagnostic snapshot only
 *     scope: { week, day, anchorStr } | null
 *     createdAt: ISO-8601
 *   }
 *
 * Public API (window.TrainEditsStore):
 *   getAll()              → Array<op>
 *   get(id)               → op | null
 *   add(partial)          → op
 *   addMany(partials)     → Array<op>       // one notify (used by session commit)
 *   update(id, patch)     → op | null
 *   remove(id)            → boolean
 *   clear()               → void
 *   subscribe(cb)         → unsubscribe()
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-train-edits';
    const ID_KEY = 'sparplannen-train-edits-next-id';
    const OPS = ['retrack', 'retime', 'cut', 'attach', 'couple', 'split', 'delete'];
    const subscribers = new Set();
    let cache = null;
    let nextId = null;

    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed === undefined || parsed === null ? fallback : parsed;
        } catch (error) {
            console.warn('[TrainEditsStore] failed to parse', error);
            return fallback;
        }
    }

    function load() {
        if (cache) return cache;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const arr = safeParse(raw, []);
            cache = Array.isArray(arr) ? arr : [];
        } catch (_) {
            cache = [];
        }
        return cache;
    }

    function loadNextId() {
        if (Number.isFinite(nextId)) return nextId;
        try {
            const raw = localStorage.getItem(ID_KEY);
            const parsed = parseInt(raw, 10);
            nextId = Number.isFinite(parsed) ? parsed : -1;
        } catch (_) {
            nextId = -1;
        }
        const used = load().map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n < 0);
        if (used.length) {
            const min = Math.min(...used);
            if (min - 1 < nextId) nextId = min - 1;
        }
        return nextId;
    }

    // The projection stamps transient runtime flags on the shared op objects
    // (`_unresolved`, `_consumeUnresolved`, `_declined`). They are re-derived on
    // every render, so never persist them — strip underscore-prefixed keys.
    function stripRuntime(key, value) {
        return (typeof key === 'string' && key.charAt(0) === '_') ? undefined : value;
    }

    function persistList() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || [], stripRuntime));
        } catch (error) {
            console.warn('[TrainEditsStore] persist failed', error);
        }
    }

    function persistNextId() {
        try {
            localStorage.setItem(ID_KEY, String(nextId));
        } catch (_) { /* ignore */ }
    }

    function notify(detail) {
        subscribers.forEach((cb) => {
            try { cb(detail); } catch (e) { console.error(e); }
        });
        try {
            window.dispatchEvent(new CustomEvent('train-edits-changed', { detail }));
        } catch (_) { /* ignore */ }
    }

    function getAll() {
        return load().slice();
    }

    function get(id) {
        if (id === null || id === undefined) return null;
        return load().find((r) => String(r.id) === String(id)) || null;
    }

    function normalize(partial) {
        const safe = partial && typeof partial === 'object' ? partial : {};
        const op = OPS.indexOf(safe.op) >= 0 ? safe.op : 'retrack';
        return {
            id: safe.id,
            op,
            editKey: String(safe.editKey || ''),
            params: (safe.params && typeof safe.params === 'object') ? safe.params : {},
            before: (safe.before && typeof safe.before === 'object') ? safe.before : null,
            after: (safe.after && typeof safe.after === 'object') ? safe.after : null,
            scope: (safe.scope && typeof safe.scope === 'object') ? safe.scope : null,
            createdAt: safe.createdAt || new Date().toISOString()
        };
    }

    function mintId() {
        loadNextId();
        const id = nextId;
        nextId -= 1;
        return id;
    }

    function add(partial) {
        const data = load();
        const record = { ...normalize(partial), id: mintId() };
        persistNextId();
        data.push(record);
        persistList();
        notify({ type: 'add', record });
        return record;
    }

    function addMany(partials) {
        const list = Array.isArray(partials) ? partials : [];
        if (!list.length) return [];
        const data = load();
        const records = list.map((p) => {
            const record = { ...normalize(p), id: mintId() };
            data.push(record);
            return record;
        });
        persistNextId();
        persistList();
        notify({ type: 'add-many', records });
        return records;
    }

    function update(id, patch) {
        const data = load();
        const idx = data.findIndex((r) => String(r.id) === String(id));
        if (idx === -1) return null;
        const merged = normalize({ ...data[idx], ...patch, id: data[idx].id, createdAt: data[idx].createdAt });
        data[idx] = merged;
        persistList();
        notify({ type: 'update', record: merged });
        return merged;
    }

    function remove(id) {
        const data = load();
        const idx = data.findIndex((r) => String(r.id) === String(id));
        if (idx === -1) return false;
        const [record] = data.splice(idx, 1);
        persistList();
        notify({ type: 'remove', record });
        return true;
    }

    function clear() {
        cache = [];
        persistList();
        notify({ type: 'clear' });
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    window.TrainEditsStore = {
        getAll,
        get,
        add,
        addMany,
        update,
        remove,
        clear,
        subscribe,
        OPS
    };
})();
