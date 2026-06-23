/**
 * Archive mode — browse a past (or any loaded) spårplan week.
 *
 * The header "vecka N" label is a button. Clicking it opens a picker of every
 * loaded week. Picking the live week returns to the normal feed; picking any
 * other week enters ARCHIVE MODE: the schedule renders that week, the live
 * delay API and the "new spårplan" nag are switched off (see delay-integration
 * and schedule-update-checker), following-mode / jump-to-now are locked (via the
 * qaOverride flag in TimeManager), and the user can scroll/navigate the day
 * freely. A "Tillbaka till live" banner — modeled on the existing reload
 * banner — switches back.
 *
 * Mechanism: the selection lives in sessionStorage and is applied on the reload
 * that follows, exactly like the "Ladda om" flow. SparplanenResolve reads it
 * when picking the week/day bundle; this module only drives the UI.
 *
 * Depends on: window.SparplanenResolve (getArchiveSelection, pickNaturalWeekAndDay,
 * ARCHIVE_KEY), window.SPARPLANEN_WEEKS, window.SPARPLANEN_ANCHORS.
 */
(function () {
    'use strict';

    const resolve = window.SparplanenResolve || {};
    const ARCHIVE_KEY = resolve.ARCHIVE_KEY || 'sparplanen.archive';
    const BANNER_ID = 'archive-banner';
    const PICKER_ID = 'week-picker';

    const MONTHS_SV = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun',
        'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const DAY_ORDER = ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag'];

    // ---- Helpers -----------------------------------------------------------
    function weeks() { return window.SPARPLANEN_WEEKS || {}; }
    function anchors() { return window.SPARPLANEN_ANCHORS || {}; }

    function parseWeekKey(wk) {
        const p = String(wk).split('-W');
        return { y: parseInt(p[0], 10) || 0, w: parseInt(p[1], 10) || 0 };
    }
    function compareDesc(a, b) {
        const A = parseWeekKey(a), B = parseWeekKey(b);
        return A.y !== B.y ? B.y - A.y : B.w - A.w;
    }

    function weekNumberOf(wk) { return parseWeekKey(wk).w || null; }

    // "26–29 maj" / "29 maj–4 jun" from the week's anchor dates.
    function weekDateRange(wk) {
        const a = anchors()[wk];
        if (!a) return '';
        const dates = Object.values(a).filter(Boolean).sort();
        if (!dates.length) return '';
        const first = dates[0].split('-').map(Number);
        const last = dates[dates.length - 1].split('-').map(Number);
        const fDay = first[2], fMon = MONTHS_SV[first[1] - 1];
        const lDay = last[2], lMon = MONTHS_SV[last[1] - 1];
        if (fMon === lMon) return `${fDay}–${lDay} ${lMon}`;
        return `${fDay} ${fMon}–${lDay} ${lMon}`;
    }

    function liveWeekKey() {
        if (typeof resolve.pickNaturalWeekAndDay !== 'function') return null;
        const p = resolve.pickNaturalWeekAndDay(weeks(), anchors());
        return p && p.week;
    }
    function activeArchiveWeek() {
        const sel = (typeof resolve.getArchiveSelection === 'function') ? resolve.getArchiveSelection() : null;
        return sel && sel.week;
    }
    function isArchiveActive() { return !!activeArchiveWeek(); }

    // ---- Enter / exit (reload-based, mirrors the "Ladda om" flow) ----------
    // Both transitions drop the persisted TimeManager scroll position so the
    // destination starts clean: entering an archive week lands on its default
    // hour, returning to live lands on "now" — neither inherits the other's
    // scroll. (Manual reloads *within* a mode still restore position via the
    // 1-hour time-state window.)
    function clearTimeState() {
        try { localStorage.removeItem('sparplanen_time_state'); } catch (e) { /* ignore */ }
    }
    function enter(weekKey) {
        try { sessionStorage.setItem(ARCHIVE_KEY, JSON.stringify({ week: weekKey })); } catch (e) { /* ignore */ }
        clearTimeState();
        window.location.reload();
    }
    function exit() {
        try { sessionStorage.removeItem(ARCHIVE_KEY); } catch (e) { /* ignore */ }
        clearTimeState();
        window.location.reload();
    }

    // ---- Week picker popover ----------------------------------------------
    let picker = null;
    let onDocClick = null;
    let onKeydown = null;

    function closePicker() {
        if (picker && picker.parentNode) picker.parentNode.removeChild(picker);
        picker = null;
        if (onDocClick) document.removeEventListener('mousedown', onDocClick, true);
        if (onKeydown) document.removeEventListener('keydown', onKeydown, true);
        onDocClick = null;
        onKeydown = null;
        const label = document.getElementById('header-week-indicator');
        if (label) label.setAttribute('aria-expanded', 'false');
    }

    function buildItem(wk, opts) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'week-picker__item';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', opts.active ? 'true' : 'false');
        if (opts.active) item.classList.add('is-active');

        const main = document.createElement('span');
        main.className = 'week-picker__main';
        const num = document.createElement('span');
        num.className = 'week-picker__week';
        num.textContent = 'v.' + (weekNumberOf(wk) || '?');
        const range = document.createElement('span');
        range.className = 'week-picker__range';
        range.textContent = weekDateRange(wk);
        main.appendChild(num);
        main.appendChild(range);

        const tail = document.createElement('span');
        tail.className = 'week-picker__tail';
        if (opts.live) {
            const badge = document.createElement('span');
            badge.className = 'week-picker__badge';
            badge.textContent = 'Live';
            tail.appendChild(badge);
        }
        if (opts.active) {
            const check = document.createElement('span');
            check.className = 'week-picker__check';
            check.setAttribute('aria-hidden', 'true');
            check.textContent = '✓';
            tail.appendChild(check);
        }

        item.appendChild(main);
        item.appendChild(tail);

        item.addEventListener('click', function () {
            closePicker();
            if (opts.live) {
                if (isArchiveActive()) exit();      // back to the live feed
                return;                              // already live → nothing to do
            }
            if (opts.active) return;                 // already viewing this archived week
            enter(wk);
        });
        return item;
    }

    function openPicker() {
        if (picker) { closePicker(); return; }
        const label = document.getElementById('header-week-indicator');
        if (!label) return;

        const live = liveWeekKey();
        const active = activeArchiveWeek() || live; // when not archiving, live is the active one
        const list = Object.keys(weeks()).sort(compareDesc);

        picker = document.createElement('div');
        picker.id = PICKER_ID;
        picker.className = 'week-picker';
        picker.setAttribute('role', 'menu');
        picker.setAttribute('aria-label', 'Välj spårplansvecka');

        const head = document.createElement('div');
        head.className = 'week-picker__head';
        head.textContent = 'Visa spårplansvecka';
        picker.appendChild(head);

        const body = document.createElement('div');
        body.className = 'week-picker__list';
        list.forEach(function (wk) {
            body.appendChild(buildItem(wk, { live: wk === live, active: wk === active }));
        });
        picker.appendChild(body);

        document.body.appendChild(picker);

        // Position under the label, clamped to the viewport.
        const r = label.getBoundingClientRect();
        const pw = picker.offsetWidth;
        let left = r.left;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (left < 8) left = 8;
        picker.style.left = Math.round(left) + 'px';
        picker.style.top = Math.round(r.bottom + 6) + 'px';

        label.setAttribute('aria-expanded', 'true');

        // Focus the active item for keyboard users.
        const activeEl = picker.querySelector('.week-picker__item.is-active') ||
            picker.querySelector('.week-picker__item');
        if (activeEl) activeEl.focus();

        onDocClick = function (e) {
            if (!picker) return;
            if (picker.contains(e.target) || e.target === label || label.contains(e.target)) return;
            closePicker();
        };
        onKeydown = function (e) {
            if (e.key === 'Escape') { e.preventDefault(); closePicker(); label.focus(); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = Array.prototype.slice.call(picker.querySelectorAll('.week-picker__item'));
                const idx = items.indexOf(document.activeElement);
                const next = e.key === 'ArrowDown'
                    ? items[Math.min(items.length - 1, idx + 1)]
                    : items[Math.max(0, idx - 1)];
                if (next) next.focus();
            }
        };
        document.addEventListener('mousedown', onDocClick, true);
        document.addEventListener('keydown', onKeydown, true);
    }

    // ---- "Tillbaka till live" banner --------------------------------------
    function showBanner() {
        if (document.getElementById(BANNER_ID)) return;
        const wk = activeArchiveWeek();
        const el = document.createElement('div');
        el.id = BANNER_ID;
        el.className = 'archive-banner';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        const text = document.createElement('span');
        text.className = 'archive-banner__text';
        const range = weekDateRange(wk);
        text.textContent = 'Arkivläge · vecka ' + (weekNumberOf(wk) || '?') +
            (range ? ' (' + range + ')' : '');

        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'archive-banner__back';
        back.textContent = 'Tillbaka till live';
        back.addEventListener('click', exit);

        el.appendChild(text);
        el.appendChild(back);
        document.body.appendChild(el);
    }

    // ---- Make the week label a button -------------------------------------
    function wireLabel() {
        const label = document.getElementById('header-week-indicator');
        if (!label || label.dataset.archiveWired) return;
        label.dataset.archiveWired = '1';
        label.classList.add('is-clickable');
        label.setAttribute('role', 'button');
        label.setAttribute('tabindex', '0');
        label.setAttribute('aria-haspopup', 'menu');
        label.setAttribute('aria-expanded', 'false');
        label.setAttribute('title', 'Visa/byt spårplansvecka');
        label.addEventListener('click', function (e) { e.stopPropagation(); openPicker(); });
        label.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
        });
    }

    // ---- Init --------------------------------------------------------------
    function init() {
        wireLabel();
        if (isArchiveActive()) {
            document.body.classList.add('archive-mode');
            showBanner();
            // The live "Nu" button is meaningless in archive mode.
            const nu = document.getElementById('now-button');
            if (nu) {
                nu.disabled = true;
                nu.setAttribute('title', 'Inaktiverad i arkivläge');
            }
        }
    }

    window.SparplanenArchive = { enter: enter, exit: exit, isActive: isArchiveActive, openPicker: openPicker };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
