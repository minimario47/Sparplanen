/**
 * Train Checks Store
 *
 * Tracks "controlled / signed off" status per train, persisted in localStorage.
 * Stored under `train.id` but RESOLVED by occurrence IDENTITY (the stable
 * `editKey`), exactly like TrainNotesStore: a checkmark belongs to ONE train
 * occurrence, is shown only on the train whose identity matches (never on another
 * train / another day), and follows its train across an id renumber.
 *
 * Storage format: { "[trainId]": { checkedAt: ISO-8601, editKey } }
 *
 * Public API (window.TrainChecksStore):
 *   isChecked(id)          → boolean
 *   getMeta(id)            → { checkedAt } | null
 *   set(id, checked)       → boolean
 *   toggle(id)             → boolean (resulting state)
 *   subscribe(cb)          → unsubscribe()
 *   getAll()               → Array<{ id, checkedAt }>
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-train-checks';
    const subscribers = new Set();
    let cache = null;

    function safeParse(raw) {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            console.warn('[TrainChecksStore] failed to parse stored checks', error);
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
            console.warn('[TrainChecksStore] persist failed', error);
        }
    }

    function notify(detail) {
        subscribers.forEach((cb) => {
            try { cb(detail); } catch (e) { console.error(e); }
        });
        try {
            window.dispatchEvent(new CustomEvent('train-checks-changed', { detail }));
        } catch (_) { /* ignore */ }
    }

    function key(id) {
        if (id === null || id === undefined) return '';
        return String(id);
    }

    // Occurrence identity of the train currently at `id` (see TrainNotesStore).
    function identityFor(id) {
        if (!window.EditKey || typeof window.EditKey.buildEditKey !== 'function') return null;
        const t = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.find((x) => String(x.id) === String(id)) : null;
        return t ? (window.EditKey.buildEditKey(t) || null) : null;
    }

    // Resolve the entry belonging to the occurrence currently at `id`, BY IDENTITY
    // → { key, meta } | null. Same rules as TrainNotesStore.resolveRef.
    function resolveRef(k) {
        const data = load();
        const ek = identityFor(k);
        if (!ek) return data[k] ? { key: k, meta: data[k] } : null;
        if (data[k] && data[k].editKey === ek) return { key: k, meta: data[k] };
        for (const kk in data) {
            if (data[kk] && data[kk].editKey === ek) return { key: kk, meta: data[kk] };
        }
        if (data[k] && !data[k].editKey) { data[k].editKey = ek; persist(); return { key: k, meta: data[k] }; }
        return null;
    }

    function isChecked(id) {
        const k = key(id);
        if (!k) return false;
        return Boolean(resolveRef(k));
    }

    function getMeta(id) {
        const k = key(id);
        if (!k) return null;
        const ref = resolveRef(k);
        return ref ? ref.meta : null;
    }

    function set(id, checked) {
        const k = key(id);
        if (!k) return false;
        const data = load();
        const ref = resolveRef(k);            // entry for THIS occurrence (any id)
        const exists = Boolean(ref);
        const next = Boolean(checked);
        if (next === exists) return false;
        if (next) {
            const editKey = identityFor(k) || null;
            data[k] = { checkedAt: new Date().toISOString(), editKey };
        } else {
            delete data[ref.key];
        }
        persist();
        notify({ id: next ? k : ref.key, checked: next });
        return true;
    }

    function toggle(id) {
        const next = !isChecked(id);
        set(id, next);
        return next;
    }

    function getAll() {
        const data = load();
        return Object.entries(data).map(([id, meta]) => ({ id, checkedAt: meta?.checkedAt || null }));
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    window.TrainChecksStore = {
        isChecked,
        getMeta,
        set,
        toggle,
        getAll,
        subscribe
    };
})();
