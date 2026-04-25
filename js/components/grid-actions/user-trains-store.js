/**
 * User Trains Store
 *
 * Holds trains/shunting movements that the operator added at runtime via the
 * "Lägg till tåg/växling här…" grid menu item. Persisted in localStorage and
 * merged with `initialServiceData` by `schedule-renderer.js#prepareTrainData`.
 *
 * Each record uses the *service* shape that schedule-renderer expects so the
 * mapping in `serviceLikeToTrain()` only needs minimal work.
 *
 * Record shape:
 *   {
 *     id: number (negative; auto-assigned)
 *     trackId: number
 *     scheduledArrivalTime: 'HH:MM' | null
 *     scheduledDepartureTime: 'HH:MM' | null
 *     arrivalTrainNumber: string
 *     departureTrainNumber: string
 *     origin: string
 *     destination: string
 *     kind: 'train' | 'shunting'
 *     trainSet: { vehicleTypeID: string, count: number, customLength?: number } | null
 *     createdAt: ISO-8601
 *   }
 *
 * Public API (window.UserTrainsStore):
 *   getAll()              → Array<record>
 *   get(id)               → record | null
 *   add(partial)          → record
 *   update(id, patch)     → record | null
 *   remove(id)            → boolean
 *   clear()               → void
 *   subscribe(cb)         → unsubscribe()
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-user-trains';
    const ID_KEY = 'sparplannen-user-trains-next-id';
    const subscribers = new Set();
    let cache = null;
    let nextId = null;

    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed === undefined || parsed === null ? fallback : parsed;
        } catch (error) {
            console.warn('[UserTrainsStore] failed to parse', error);
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
            console.warn('[UserTrainsStore] persist failed', error);
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
            window.dispatchEvent(new CustomEvent('user-trains-changed', { detail }));
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
        return {
            id: safe.id,
            trackId: Number(safe.trackId) || 0,
            scheduledArrivalTime: safe.scheduledArrivalTime || null,
            scheduledDepartureTime: safe.scheduledDepartureTime || null,
            arrivalTrainNumber: String(safe.arrivalTrainNumber || '').trim(),
            departureTrainNumber: String(safe.departureTrainNumber || '').trim(),
            origin: String(safe.origin || '').trim(),
            destination: String(safe.destination || '').trim(),
            kind: safe.kind === 'shunting' ? 'shunting' : 'train',
            trainSet: safe.trainSet || null,
            createdAt: safe.createdAt || new Date().toISOString()
        };
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

    window.UserTrainsStore = {
        getAll,
        get,
        add,
        update,
        remove,
        clear,
        subscribe
    };
})();
