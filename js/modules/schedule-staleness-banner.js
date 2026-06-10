/**
 * Schedule week indicator + staleness banner.
 *
 * Always shows which week's spårplan is loaded as a small "vecka N" text in
 * the header (under the SpårplanV2 title, #header-week-indicator).
 * Additionally warns when that week differs from the real current ISO week —
 * e.g. this week's PDF hasn't been ingested yet, so the app fell back to an
 * older bundle — via a small dismissible pill below the header reading e.g.
 * "Använder spårplan från vecka 23".
 *
 * Depends on: window.SparplanenResolve.parseScheduleNow().
 * Refreshes on the 'schedule:rendered' event so it tracks re-renders.
 */
(function () {
    const BANNER_ID = 'schedule-staleness-banner';
    // Remember which week the user dismissed so we don't nag again for the
    // same stale bundle within this session.
    let dismissedForWeek = null;

    function resolveState() {
        if (!window.SparplanenResolve || typeof window.SparplanenResolve.parseScheduleNow !== 'function') {
            return null;
        }
        try {
            return window.SparplanenResolve.parseScheduleNow();
        } catch (e) {
            return null;
        }
    }

    function removeBanner() {
        const el = document.getElementById(BANNER_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function buildBanner(weekNumber) {
        const banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.className = 'schedule-staleness-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');

        const icon = document.createElement('span');
        icon.className = 'schedule-staleness-banner__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '⚠';

        const text = document.createElement('span');
        text.className = 'schedule-staleness-banner__text';
        text.textContent = 'Använder spårplan från vecka ' + weekNumber;

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'schedule-staleness-banner__close';
        close.setAttribute('aria-label', 'Stäng');
        close.textContent = '×';
        close.addEventListener('click', function () {
            dismissedForWeek = weekNumber;
            removeBanner();
        });

        banner.appendChild(icon);
        banner.appendChild(text);
        banner.appendChild(close);
        return banner;
    }

    function updateWeekIndicator(state) {
        const el = document.getElementById('header-week-indicator');
        if (!el) return;
        el.textContent = (state && state.weekNumber) ? 'vecka ' + state.weekNumber : '';
    }

    function update() {
        const state = resolveState();
        updateWeekIndicator(state);
        if (!state || !state.isStale || !state.weekNumber) {
            removeBanner();
            return;
        }
        if (dismissedForWeek === state.weekNumber) {
            removeBanner();
            return;
        }

        const existing = document.getElementById(BANNER_ID);
        if (existing) {
            // Update the text in place if the stale week changed.
            const text = existing.querySelector('.schedule-staleness-banner__text');
            if (text) text.textContent = 'Använder spårplan från vecka ' + state.weekNumber;
            return;
        }

        const banner = buildBanner(state.weekNumber);
        document.body.appendChild(banner);
    }

    function init() {
        update();
        // Re-evaluate after each schedule render (e.g. when data reloads).
        window.addEventListener('schedule:rendered', update);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
