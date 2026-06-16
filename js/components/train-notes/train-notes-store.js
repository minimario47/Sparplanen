/**
 * Train Notes Store
 *
 * Persists per-train free-text notes in localStorage. Notes are STORED under
 * `train.id` but RESOLVED by occurrence IDENTITY (the stable `editKey` =
 * week|day|track|sub|number|time). A note therefore belongs to ONE specific train
 * occurrence and is shown only on the train whose identity matches — never on
 * another train (a repeating number on another day/week is a different train), and
 * it follows its train if the positional id renumbers within the same occurrence.
 *
 * Storage format:  { "[trainId]": { text, updatedAt, editKey } }
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

    // The occurrence identity of the train currently at `id` (from the rendered
    // set). editKey embeds week|day|track|sub|number|time, so it is unique to one
    // train occurrence and stable across an id renumber within that occurrence.
    function identityFor(id) {
        if (!window.EditKey || typeof window.EditKey.buildEditKey !== 'function') return null;
        const t = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.find((x) => String(x.id) === String(id)) : null;
        return t ? (window.EditKey.buildEditKey(t) || null) : null;
    }

    // Resolve the stored entry that belongs to the occurrence currently at `id`,
    // BY IDENTITY → { key, meta } | null:
    //   • entry under this id whose editKey matches            → it (common case)
    //   • entry under ANY id whose editKey matches             → it (id renumbered)
    //   • legacy entry under this id with no editKey           → adopt it once
    //   • entry under this id with a DIFFERENT editKey, or none → null (never show
    //     a note on a train it doesn't belong to)
    // Falls back to plain id lookup only when identity is unavailable (e.g.
    // cachedTrains not ready yet) — the decorator re-runs once it is.
    function resolveRef(k) {
        const data = load();
        const ek = identityFor(k);
        if (!ek) return data[k] ? { key: k, meta: data[k] } : null;
        if (data[k] && data[k].editKey === ek) return { key: k, meta: data[k] };
        for (const kk in data) {
            if (data[kk] && data[kk].editKey === ek) return { key: kk, meta: data[kk] };
        }
        if (data[k] && !data[k].editKey) {                 // legacy → adopt to this occurrence
            data[k].editKey = ek; persist();
            return { key: k, meta: data[k] };
        }
        return null;
    }

    function get(id) {
        const meta = getMeta(id);
        return meta ? meta.text : '';
    }

    function getMeta(id) {
        const k = key(id);
        if (!k) return null;
        const ref = resolveRef(k);
        return ref ? ref.meta : null;
    }

    function has(id) {
        return Boolean(getMeta(id));
    }

    function set(id, text) {
        const k = key(id);
        if (!k) return false;
        const trimmed = String(text || '').slice(0, MAX_LENGTH);
        const data = load();
        const ref = resolveRef(k);            // the entry for THIS occurrence (any id)

        if (!trimmed.trim()) {
            if (!ref) return false;
            delete data[ref.key];
            persist();
            notify({ id: ref.key, text: '', removed: true });
            return true;
        }

        if (ref && ref.meta.text === trimmed && ref.key === k) return false;

        // Capture the occurrence identity now (the id is valid in the current
        // build — the user is annotating a visible bar) and consolidate the entry
        // under the current id so the note can never split across two slots.
        const editKey = identityFor(k) || (ref && ref.meta.editKey) || null;
        if (ref && ref.key !== k) delete data[ref.key];
        data[k] = { text: trimmed, updatedAt: new Date().toISOString(), editKey };
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
