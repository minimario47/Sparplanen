/**
 * Train Notes Store
 *
 * Persists per-train free-text notes in localStorage. Notes are keyed by
 * the stable `train.id` (which corresponds to `service.id` in trains.js,
 * or to the negative IDs used by user-added trains).
 *
 * Storage format:  { "[trainId]": { text: string, updatedAt: ISO-8601 } }
 *
 * Public API (window.TrainNotesStore):
 *   get(id)        → string | ''
 *   getMeta(id)    → { text, updatedAt } | null
 *   set(id, text)  → boolean (true if changed; '' deletes)
 *   delete(id)     → boolean
 *   has(id)        → boolean
 *   subscribe(cb)  → unsubscribe()
 *
 * Side effects:
 *   - Dispatches `train-notes-changed` on `window` after every mutation.
 *   - Falls back to in-memory state if localStorage is unavailable.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-train-notes';
    const MAX_LENGTH = 500;
    const subscribers = new Set();
    let cache = null;

    function safeParse(raw) {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            console.warn('[TrainNotesStore] failed to parse stored notes', error);
            return {};
        }
    }

    function load() {
        if (cache) return cache;
        try {
            cache = safeParse(localStorage.getItem(STORAGE_KEY));
        } catch (_) {
            cache = {};
        }
        return cache;
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || {}));
        } catch (error) {
            console.warn('[TrainNotesStore] persist failed', error);
        }
    }

    function notify(detail) {
        subscribers.forEach((cb) => {
            try { cb(detail); } catch (e) { console.error(e); }
        });
        try {
            window.dispatchEvent(new CustomEvent('train-notes-changed', { detail }));
        } catch (_) { /* ignore */ }
    }

    function key(id) {
        if (id === null || id === undefined) return '';
        return String(id);
    }

    function get(id) {
        const meta = getMeta(id);
        return meta ? meta.text : '';
    }

    function getMeta(id) {
        const k = key(id);
        if (!k) return null;
        const data = load();
        return data[k] || null;
    }

    function has(id) {
        return Boolean(getMeta(id));
    }

    function set(id, text) {
        const k = key(id);
        if (!k) return false;
        const trimmed = String(text || '').slice(0, MAX_LENGTH);
        const data = load();
        const current = data[k];

        if (!trimmed.trim()) {
            if (!current) return false;
            delete data[k];
            persist();
            notify({ id: k, text: '', removed: true });
            return true;
        }

        if (current && current.text === trimmed) return false;

        data[k] = { text: trimmed, updatedAt: new Date().toISOString() };
        persist();
        notify({ id: k, text: trimmed, removed: false });
        return true;
    }

    function remove(id) {
        return set(id, '');
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    window.TrainNotesStore = {
        MAX_LENGTH,
        get,
        getMeta,
        has,
        set,
        delete: remove,
        subscribe
    };
})();
