/**
 * Track Changes Store
 *
 * In-memory store for live track changes detected from the API.
 * A "track change" means: the API reports the train at a different
 * track than the planned `trackId` from the schedule. Each entry
 * remembers `{ fromTrack, toTrack, changedAt }` for a single train,
 * and is auto-pruned when older than the configured display duration.
 *
 * Hidden trains are tracked separately in a Set, mirroring the
 * `suppressedDelays` pattern.
 *
 * Public API (window.TrackChangesStore):
 *   recordChange(trainId, from, to)  → boolean (true if newly stored / replaced)
 *   getActive(trainId)               → entry | null  (null if hidden / expired)
 *   getRaw(trainId)                  → entry | null  (ignores hide / expiry)
 *   getAllActive()                   → Array<entry>
 *   hide(trainId) / unhide(trainId)  → boolean
 *   isHidden(trainId)                → boolean
 *   clearHidden()                    → number (count cleared)
 *   prune()                          → number (entries removed)
 *   getDurationMs()                  → number
 *   subscribe(cb)                    → unsubscribe()
 *
 * Events:
 *   'track-changes-changed' (CustomEvent) on window after any mutation.
 */
(function () {
    'use strict';

    const subscribers = new Set();
    const changes = new Map(); // trainId(string) → { fromTrack, toTrack, changedAt }
    const hidden = new Set();  // trainId(string)
    let pruneTimer = null;

    function key(id) {
        if (id === null || id === undefined) return '';
        return String(id);
    }

    function getDurationMs() {
        const settings = window.SettingsModal?.getCurrentSettings?.() || {};
        const minutes = Number.isFinite(settings.trackChangesDurationMin)
            ? settings.trackChangesDurationMin
            : 2;
        return Math.max(15, minutes) * 60 * 1000;
    }

    function isExpired(entry) {
        if (!entry || !entry.changedAt) return true;
        return (Date.now() - entry.changedAt) >= getDurationMs();
    }

    function notify(detail) {
        subscribers.forEach((cb) => {
            try { cb(detail); } catch (e) { console.error('[TrackChangesStore] subscriber error', e); }
        });
        try {
            window.dispatchEvent(new CustomEvent('track-changes-changed', { detail }));
        } catch (_) { /* ignore */ }
    }

    function recordChange(trainId, fromTrack, toTrack) {
        const k = key(trainId);
        if (!k) return false;
        const from = parseInt(fromTrack, 10);
        const to = parseInt(toTrack, 10);
        if (!Number.isFinite(to)) return false;

        const existing = changes.get(k);
        if (existing && existing.toTrack === to && !isExpired(existing)) {
            return false;
        }

        changes.set(k, {
            trainId: k,
            fromTrack: Number.isFinite(from) ? from : (existing?.fromTrack ?? null),
            toTrack: to,
            changedAt: Date.now()
        });
        // A new change for a train cancels its previous "hidden" state so the user
        // can see the latest movement and choose to hide it again if needed.
        if (hidden.has(k)) hidden.delete(k);

        notify({ type: 'recorded', trainId: k, toTrack: to });
        scheduleAutoPrune();
        return true;
    }

    function getRaw(trainId) {
        const k = key(trainId);
        if (!k) return null;
        return changes.get(k) || null;
    }

    function getActive(trainId) {
        const k = key(trainId);
        if (!k) return null;
        if (hidden.has(k)) return null;
        const entry = changes.get(k);
        if (!entry) return null;
        if (isExpired(entry)) return null;
        return entry;
    }

    function getAllActive() {
        const out = [];
        changes.forEach((entry, k) => {
            if (hidden.has(k)) return;
            if (isExpired(entry)) return;
            out.push(entry);
        });
        return out;
    }

    function hide(trainId) {
        const k = key(trainId);
        if (!k) return false;
        if (hidden.has(k)) return false;
        hidden.add(k);
        notify({ type: 'hidden', trainId: k });
        return true;
    }

    function unhide(trainId) {
        const k = key(trainId);
        if (!k) return false;
        if (!hidden.has(k)) return false;
        hidden.delete(k);
        notify({ type: 'unhidden', trainId: k });
        return true;
    }

    function isHidden(trainId) {
        const k = key(trainId);
        return !!k && hidden.has(k);
    }

    function clearHidden() {
        const n = hidden.size;
        if (n === 0) return 0;
        hidden.clear();
        notify({ type: 'cleared-hidden', count: n });
        return n;
    }

    function prune() {
        let removed = 0;
        changes.forEach((entry, k) => {
            if (isExpired(entry)) {
                changes.delete(k);
                hidden.delete(k);
                removed++;
            }
        });
        if (removed > 0) notify({ type: 'pruned', count: removed });
        return removed;
    }

    function scheduleAutoPrune() {
        if (pruneTimer) return;
        pruneTimer = setInterval(() => {
            prune();
            if (changes.size === 0 && pruneTimer) {
                clearInterval(pruneTimer);
                pruneTimer = null;
            }
        }, 10 * 1000);
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') return () => {};
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    window.addEventListener('settingsChanged', () => {
        prune();
        notify({ type: 'settings-changed' });
    });

    window.TrackChangesStore = {
        recordChange,
        getActive,
        getRaw,
        getAllActive,
        hide,
        unhide,
        isHidden,
        clearHidden,
        prune,
        getDurationMs,
        subscribe
    };
})();
