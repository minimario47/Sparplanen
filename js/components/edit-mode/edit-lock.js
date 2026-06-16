/**
 * Edit Lock — "🔒 Lås" look-only toggle (Phase 5).
 *
 * A per-device safety valve, the inverse of edit mode: when engaged the editing
 * feature is disarmed so a controller can read the board with zero chance of
 * arming an edit. Persisted in localStorage; survives reload.
 *
 * Scope: it gates the EDIT feature only (pen toggle + the context-menu retrack
 * twin — the one mutation path that runs outside an edit session). It does NOT
 * touch notes / checks / closures (separate, lower-risk surfaces). Every
 * drag/keyboard edit gesture already early-returns on `!isEditing()`, and lock
 * blocks ever entering edit mode, so those are covered transitively.
 *
 * Public API (window.EditLock):
 *   isLocked()        → boolean
 *   setLocked(bool)   → void   (closes an open session first, with confirm)
 *   toggle()          → void
 *   subscribe(cb)     → unsubscribe()
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sparplannen-edit-locked';
    const subscribers = new Set();
    let locked = load();
    let btn = null;

    function load() {
        try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) { return false; }
    }
    function persist() {
        try { localStorage.setItem(STORAGE_KEY, locked ? 'true' : 'false'); } catch (_) { /* ignore */ }
    }
    function isLocked() { return locked; }

    function paint() {
        document.body.classList.toggle('is-locked', locked);
        if (btn) {
            btn.classList.toggle('is-locked', locked);
            btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
            btn.title = locked
                ? 'Spårplanen är låst (skrivskydd) – klicka för att låsa upp'
                : 'Lås spårplanen (skrivskydd)';
        }
        const pen = document.getElementById('edit-mode-toggle');
        if (pen) pen.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }

    function setLocked(next) {
        next = !!next;
        if (next === locked) return;
        // Locking with a session open: close it first, honouring the same
        // discard-confirm the action bar's Avbryt uses.
        if (next && window.EditSession && window.EditSession.active) {
            const s = window.EditSession;
            if (typeof s.pendingCount === 'function' && s.pendingCount() > 0) {
                const n = s.pendingCount();
                const ok = window.confirm(`Lås spårplanen och kasta ${n} ${n === 1 ? 'ändring' : 'ändringar'}?`);
                if (!ok) return;
            }
            if (typeof s.discard === 'function') s.discard();
        }
        locked = next;
        persist();
        paint();
        if (locked && typeof window.showNotification === 'function') {
            try { window.showNotification('Spårplanen låst – skrivskyddad.', 'info'); } catch (_) { /* ignore */ }
        }
        subscribers.forEach((cb) => { try { cb(locked); } catch (e) { console.error(e); } });
    }
    function toggle() { setLocked(!locked); }

    function init() {
        btn = document.getElementById('edit-lock-toggle');
        if (btn) btn.addEventListener('click', toggle);
        paint();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.EditLock = {
        isLocked, setLocked, toggle,
        subscribe(cb) {
            if (typeof cb !== 'function') return () => {};
            subscribers.add(cb);
            return () => subscribers.delete(cb);
        }
    };
})();
