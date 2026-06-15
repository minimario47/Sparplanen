/**
 * "Newer spårplan available — reload" checker.
 *
 * The schedule data ships in trains.js (window.SPARPLANEN_BUILD stamps which
 * build it is). When a new week is ingested and deployed, a tab that's been
 * left open has no way to know — and on some browsers (notably Safari) even a
 * refresh can keep serving the cached trains.js. So:
 *
 *   1. trains.js / closures.js are loaded with a per-build ?v= query
 *      (emit_week_bundle.py rewrites it), so a reload re-downloads fresh data.
 *   2. This checker polls data-version.json with `no-store` (so the answer is
 *      always current), and when its build differs from the one we loaded it
 *      shows a one-click "Ladda om" banner. Clicking reloads → step 1 pulls the
 *      new data. No private window, no cache clearing.
 *
 * Polls on an interval and whenever the tab regains focus/visibility (a board
 * left open overnight notices the new week as soon as someone looks at it).
 */
(function () {
    const BANNER_ID = 'schedule-update-banner';
    const VERSION_URL = 'data-version.json';
    const POLL_MS = 5 * 60 * 1000; // 5 minutes

    // The build the currently-loaded trains.js belongs to. Absent on older
    // bundles that predate the stamp — then we simply never nag (nothing to
    // compare against), which is the safe default.
    const loadedBuild = (typeof window !== 'undefined' && window.SPARPLANEN_BUILD) || null;

    let banner = null;
    let stopped = false;

    function buildBanner() {
        const el = document.createElement('div');
        el.id = BANNER_ID;
        el.className = 'schedule-update-banner';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        const icon = document.createElement('span');
        icon.className = 'schedule-update-banner__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↻';

        const text = document.createElement('span');
        text.className = 'schedule-update-banner__text';
        text.textContent = 'Ny spårplan tillgänglig';

        const reload = document.createElement('button');
        reload.type = 'button';
        reload.className = 'schedule-update-banner__reload';
        reload.textContent = 'Ladda om';
        reload.addEventListener('click', function () {
            // A normal reload re-validates index.html, which now points at
            // trains.js?v=<newBuild> — a URL never cached — so fresh data loads.
            window.location.reload();
        });

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'schedule-update-banner__close';
        close.setAttribute('aria-label', 'Stäng');
        close.textContent = '×';
        close.addEventListener('click', function () {
            // Dismiss for this session; stop nagging until the next page load.
            stopped = true;
            removeBanner();
        });

        el.appendChild(icon);
        el.appendChild(text);
        el.appendChild(reload);
        el.appendChild(close);
        return el;
    }

    function showBanner() {
        if (document.getElementById(BANNER_ID)) return;
        banner = buildBanner();
        document.body.appendChild(banner);
    }

    function removeBanner() {
        const el = document.getElementById(BANNER_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        banner = null;
    }

    async function check() {
        if (stopped || !loadedBuild) return;
        let latest = null;
        try {
            // Cache-busting query + no-store so we always see the deployed build,
            // never a cached manifest.
            const res = await fetch(VERSION_URL + '?_=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) return;
            latest = await res.json();
        } catch (e) {
            return; // offline / not deployed yet — try again next tick
        }
        if (latest && latest.build && latest.build !== loadedBuild) {
            showBanner();
        }
    }

    function start() {
        check();
        setInterval(function () {
            if (document.hidden) return; // don't poll a backgrounded tab
            check();
        }, POLL_MS);
        // Catch up the instant the user returns to the tab.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) check();
        });
        window.addEventListener('focus', check);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
