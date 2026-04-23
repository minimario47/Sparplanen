/**
 * Late arrivals to Göteborg C (Trafikverket location signature G).
 * Movable floating panel; lists announcements delayed by at least N minutes.
 * Rows hide shortly after the train should have cleared the arrival:
 *   1 min after actual TimeAtLocation, else 1 min after EstimatedTimeAtLocation,
 *   else 2 min after (advertised + delayMinutes) when the API never reports an arrival at G.
 */
(function () {
    'use strict';

    const STORAGE_MIN = 'lateArrivalsMinMinutes';
    const STORAGE_POS = 'lateArrivalsPanelPos';
    const STORAGE_OPEN = 'lateArrivalsPanelOpen';

    const DEFAULT_MIN = 3;
    const TICK_MS = 4000;

    let panel = null;
    let toggleBtn = null;
    let thresholdInput = null;
    let listEl = null;
    let lastTrains = [];
    let tickTimer = null;
    let drag = null;

    function parseApiDate(str) {
        if (!str) return null;
        try {
            const cleaned = String(str).replace('+02:00', '').replace('+01:00', '');
            const d = new Date(cleaned);
            return Number.isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }

    function formatClock(d) {
        if (!d) return '—';
        const h = d.getHours();
        const m = d.getMinutes();
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function getMinMinutes() {
        const raw = parseInt(localStorage.getItem(STORAGE_MIN) || '', 10);
        if (Number.isFinite(raw) && raw >= 1 && raw <= 240) return raw;
        return DEFAULT_MIN;
    }

    function setMinMinutes(v) {
        localStorage.setItem(STORAGE_MIN, String(v));
    }

    function loadPos() {
        try {
            const raw = localStorage.getItem(STORAGE_POS);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (typeof o.left === 'number' && typeof o.top === 'number') return o;
        } catch { /* ignore */ }
        return null;
    }

    function savePos(left, top) {
        localStorage.setItem(STORAGE_POS, JSON.stringify({ left, top }));
    }

    function clampPanelPosition() {
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        const margin = 8;
        let left = rect.left;
        let top = rect.top;
        const maxL = window.innerWidth - rect.width - margin;
        const maxT = window.innerHeight - rect.height - margin;
        left = Math.max(margin, Math.min(left, maxL));
        top = Math.max(margin, Math.min(top, maxT));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        savePos(left, top);
    }

    function buildPanel() {
        const el = document.createElement('aside');
        el.className = 'late-arrivals-panel';
        el.setAttribute('role', 'complementary');
        el.setAttribute('aria-label', 'Försenade ankomster till Göteborg');
        el.hidden = true;
        el.innerHTML = `
            <div class="late-arrivals-panel__header" data-drag-handle>
                <div class="late-arrivals-panel__title-wrap">
                    <h2 class="late-arrivals-panel__title">Sen ankomst</h2>
                    <span class="late-arrivals-panel__subtitle">Göteborg C · signatur G · ankomster</span>
                </div>
                <button type="button" class="late-arrivals-panel__close" aria-label="Stäng panel" title="Stäng">×</button>
            </div>
            <div class="late-arrivals-panel__toolbar">
                <label for="late-arrivals-threshold">Minst försening</label>
                <input type="number" id="late-arrivals-threshold" class="late-arrivals-panel__threshold"
                    min="1" max="240" step="1" value="${getMinMinutes()}" aria-label="Minst antal minuter försening" />
                <span style="font-size:var(--font-size-xs);color:var(--text-secondary)">min</span>
            </div>
            <div class="late-arrivals-panel__list" id="late-arrivals-list"></div>
            <div class="late-arrivals-panel__footer">Uppdateras med förseningsdata · rader döljs 1 min efter faktisk ankomst, annars 1 min efter beräknad tid, annars 2 min efter plan + försening om G saknar avläsning</div>
        `;
        document.body.appendChild(el);
        return el;
    }

    /**
     * True when the train should no longer appear as "incoming late" — i.e. the
     * passage at G is already over from the user's perspective. Trafikverket does
     * not always send TimeAtLocation for every train; without a fallback, rows
     * would stick forever (e.g. 72477 after many hours).
     */
    function isArrivalWindowClosed(t, nowMs) {
        const actual = parseApiDate(t.actualTime);
        if (actual) {
            return nowMs - actual.getTime() > 60 * 1000;
        }
        const est = parseApiDate(t.estimatedTime);
        if (est) {
            return nowMs - est.getTime() > 60 * 1000;
        }
        const adv = parseApiDate(t.advertisedTime);
        const dm = t.delayMinutes;
        if (adv && Number.isFinite(dm) && dm >= 0) {
            const impliedPass = adv.getTime() + dm * 60 * 1000;
            return nowMs - impliedPass > 2 * 60 * 1000;
        }
        return false;
    }

    function filterTrains(trains, minMinutes, now) {
        const out = [];
        if (!Array.isArray(trains)) return out;
        const nowMs = now.getTime();
        for (const t of trains) {
            if (t.isCanceled) continue;
            const dm = t.delayMinutes;
            if (dm == null || !Number.isFinite(dm)) continue;
            if (dm < minMinutes) continue;

            if (isArrivalWindowClosed(t, nowMs)) continue;

            out.push(t);
        }
        out.sort((a, b) => {
            const ea = parseApiDate(a.estimatedTime) || parseApiDate(a.advertisedTime);
            const eb = parseApiDate(b.estimatedTime) || parseApiDate(b.advertisedTime);
            const ta = ea ? ea.getTime() : 0;
            const tb = eb ? eb.getTime() : 0;
            return ta - tb;
        });
        return out;
    }

    function renderList() {
        if (!listEl) return;
        const now = new Date();
        const minM = getMinMinutes();
        const rows = filterTrains(lastTrains, minM, now);

        listEl.innerHTML = '';
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.className = 'late-arrivals-panel__empty';
            if (!window.delayIntegration || !window.delayIntegration.isInitialized) {
                empty.textContent = 'Förseningsdata är inte ansluten. Kontrollera nätverk eller att molnfunktionen svarar.';
            } else if (!lastTrains.length) {
                empty.textContent = 'Ingen aktiv data ännu — väntar på första uppdatering…';
            } else {
                empty.textContent = `Inga tåg med minst ${minM} minuters försening till G just nu.`;
            }
            listEl.appendChild(empty);
            return;
        }

        for (const t of rows) {
            const row = document.createElement('div');
            row.className = 'late-arrivals-row';
            const adv = parseApiDate(t.advertisedTime);
            const est = parseApiDate(t.estimatedTime);
            const act = parseApiDate(t.actualTime);
            const num = document.createElement('div');
            num.className = 'late-arrivals-row__num';
            num.textContent = String(t.trainNumber || '—');

            const del = document.createElement('div');
            del.className = 'late-arrivals-row__delay';
            del.textContent = `+${t.delayMinutes} min`;

            const meta = document.createElement('div');
            meta.className = 'late-arrivals-row__meta';
            let line = `Plan ${formatClock(adv)}`;
            if (est) line += ` · Beräknad ${formatClock(est)}`;
            if (act) line += ' · Ankommen';
            if (t.fromLocation) line += ` · Från ${t.fromLocation}`;
            if (t.trackAtLocation) line += ` · Spår ${t.trackAtLocation}`;
            meta.textContent = line;

            row.appendChild(num);
            row.appendChild(del);
            row.appendChild(meta);
            listEl.appendChild(row);
        }
    }

    function onFeedUpdated(e) {
        const data = e.detail;
        if (data && Array.isArray(data.trains)) {
            lastTrains = data.trains;
        }
        if (panel && !panel.hidden) renderList();
    }

    function startTick() {
        stopTick();
        tickTimer = window.setInterval(renderList, TICK_MS);
    }

    function stopTick() {
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
        }
    }

    function setOpen(open) {
        if (!panel || !toggleBtn) return;
        panel.hidden = !open;
        toggleBtn.classList.toggle('is-active', open);
        toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
        localStorage.setItem(STORAGE_OPEN, open ? '1' : '0');
        if (open) {
            renderList();
            startTick();
        } else {
            stopTick();
        }
    }

    function setupDrag() {
        const handle = panel.querySelector('[data-drag-handle]');
        if (!handle) return;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.late-arrivals-panel__close')) return;
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            drag = {
                offsetX: e.clientX - rect.left,
                offsetY: e.clientY - rect.top,
            };
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!drag) return;
            let left = e.clientX - drag.offsetX;
            let top = e.clientY - drag.offsetY;
            const margin = 8;
            const w = panel.offsetWidth;
            const h = panel.offsetHeight;
            left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
            top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        });

        window.addEventListener('mouseup', () => {
            if (drag) {
                drag = null;
                const rect = panel.getBoundingClientRect();
                savePos(rect.left, rect.top);
            }
        });
    }

    function positionInitial() {
        const saved = loadPos();
        if (saved) {
            panel.style.left = `${saved.left}px`;
            panel.style.top = `${saved.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            requestAnimationFrame(clampPanelPosition);
        } else {
            panel.style.right = '16px';
            panel.style.bottom = '24px';
            panel.style.left = 'auto';
            panel.style.top = 'auto';
        }
    }

    function init() {
        toggleBtn = document.getElementById('late-arrivals-toggle');
        if (!toggleBtn) {
            console.warn('LateArrivalsPanel: toggle button missing');
            return;
        }

        panel = buildPanel();
        listEl = panel.querySelector('#late-arrivals-list');
        thresholdInput = panel.querySelector('#late-arrivals-threshold');
        const closeBtn = panel.querySelector('.late-arrivals-panel__close');

        thresholdInput.value = String(getMinMinutes());
        thresholdInput.addEventListener('change', () => {
            let v = parseInt(thresholdInput.value, 10);
            if (!Number.isFinite(v)) v = DEFAULT_MIN;
            v = Math.max(1, Math.min(240, v));
            thresholdInput.value = String(v);
            setMinMinutes(v);
            renderList();
        });

        closeBtn.addEventListener('click', () => setOpen(false));
        toggleBtn.addEventListener('click', () => setOpen(panel.hidden));

        window.addEventListener('delay-feed-updated', onFeedUpdated);
        window.addEventListener('resize', () => {
            if (!panel.hidden) clampPanelPosition();
        });

        setupDrag();
        positionInitial();

        const wantOpen = localStorage.getItem(STORAGE_OPEN) === '1';
        if (wantOpen) setOpen(true);

        const api = window.delayIntegration?.apiClient;
        const last = api && typeof api.getLastData === 'function' ? api.getLastData() : null;
        if (last?.trains) {
            lastTrains = last.trains;
            if (!panel.hidden) renderList();
        }
    }

    window.LateArrivalsPanel = { init };
})();
