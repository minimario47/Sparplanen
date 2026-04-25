/**
 * Train Checks Store
 *
 * Tracks "controlled / signed off" status per train, persisted in
 * localStorage. The set of checked train IDs is exposed as a small,
 * lightweight store similar to TrainNotesStore.
 *
 * Storage format: { "[trainId]": { checkedAt: ISO-8601 } }
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

    function isChecked(id) {
        const k = key(id);
        if (!k) return false;
        return Boolean(load()[k]);
    }

    function getMeta(id) {
        const k = key(id);
        if (!k) return null;
        return load()[k] || null;
    }

    function set(id, checked) {
        const k = key(id);
        if (!k) return false;
        const data = load();
        const exists = Boolean(data[k]);
        const next = Boolean(checked);
        if (next === exists) return false;
        if (next) {
            data[k] = { checkedAt: new Date().toISOString() };
        } else {
            delete data[k];
        }
        persist();
        notify({ id: k, checked: next });
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
