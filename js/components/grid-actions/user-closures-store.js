/**
 * User Closures Store
 *
 * Holds runtime track closures added by the operator from the grid context
 * menu. Persisted in localStorage and merged into `closure-renderer.js`.
 *
 * Record shape (mirrors initialTrackClosures.js — note that closure-renderer
 * parses startTime/endTime as 'HH:MM' relative to the schedule's day):
 *   {
 *     id: number (negative; auto-assigned)
 *     trackId: number
 *     subTrackIndex: number (default 0)
 *     startTime: 'HH:MM'
 *     endTime: 'HH:MM'
 *     reason: string
 *     userAdded: true
 *     createdAt: ISO-8601 string
 *   }
 *
 * Public API (window.UserClosuresStore):
 *   getAll()            → Array<record>
 *   get(id)             → record | null
 *   add(partial)        → record
 *   update(id, patch)   → record | null
 *   remove(id)          → boolean
 *   subscribe(cb)       → unsubscribe()
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-user-closures';
    const ID_KEY = 'sparplannen-user-closures-next-id';
    const subscribers = new Set();
    let cache = null;
    let nextId = null;

    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed === undefined || parsed === null ? fallback : parsed;
        } catch (error) {
            console.warn('[UserClosuresStore] failed to parse', error);
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

    function persistList() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || []));
        } catch (error) {
            console.warn('[UserClosuresStore] persist failed', error);
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
            window.dispatchEvent(new CustomEvent('user-closures-changed', { detail }));
        } catch (_) { /* ignore */ }
    }

    function normalize(partial) {
        const safe = partial && typeof partial === 'object' ? partial : {};
        return {
            id: safe.id,
            trackId: Number(safe.trackId) || 0,
            subTrackIndex: Number.isFinite(safe.subTrackIndex) ? Number(safe.subTrackIndex) : 0,
            startTime: safe.startTime || null,
            endTime: safe.endTime || null,
            reason: String(safe.reason || '').trim() || 'Spår avstängt',
            userAdded: true,
            createdAt: safe.createdAt || new Date().toISOString()
        };
    }

    function getAll() {
        return load().slice();
    }

    function get(id) {
        if (id === null || id === undefined) return null;
        return load().find((r) => String(r.id) === String(id)) || null;
    }

    function add(partial) {
        const data = load();
        loadNextId();
        const id = nextId;
        nextId -= 1;
        persistNextId();
        const record = { ...normalize(partial), id };
        data.push(record);
        persistList();
        notify({ type: 'add', record });
        return record;
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

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    window.UserClosuresStore = {
        getAll,
        get,
        add,
        update,
        remove,
        subscribe
    };
})();
