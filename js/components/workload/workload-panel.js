/**
 * Belastning (workload) mini-panel.
 * Movable floating panel with a stacked column chart of arrivals+departures
 * per 15 min over the whole 30h canvas, split tåg/växling. Doubles as a
 * minimap: a shaded region mirrors the main view's visible window, a tick
 * mirrors the now-line, and clicking/dragging the chart pans the main view.
 * Settings (mode, delay adjustment, header strip) are shared with the heat
 * strip overlay via localStorage + the 'workload-settings-changed' event.
 */
(function () {
    'use strict';

    const STORAGE_POS = 'workloadPanelPos';
    const STORAGE_OPEN = 'workloadPanelOpen';
    const STORAGE_MODE = 'workloadMode';          // 'all' | 'tag' | 'vaxling'
    const STORAGE_DELAY = 'workloadUseDelay';
    const STORAGE_OVERLAY = 'workloadShowOverlay';

    const NOW_TICK_MS = 30000;

    let panel = null;
    let toggleBtn = null;
    let chartEl = null;
    let colsEl = null;
    let viewportEl = null;
    let nowEl = null;
    let tooltipEl = null;
    let peakEl = null;
    let totalEl = null;
    let drag = null;
    let scrub = null;
    let lastResult = null;
    let nowTimer = null;
    let viewportRaf = 0;

    function getMode() {
        const v = localStorage.getItem(STORAGE_MODE);
        return (v === 'tag' || v === 'vaxling') ? v : 'all';
    }
    function getUseDelay() { return localStorage.getItem(STORAGE_DELAY) === '1'; }
    function getShowOverlay() { return localStorage.getItem(STORAGE_OVERLAY) === '1'; }

    function notifySettingsChanged() {
        window.dispatchEvent(new CustomEvent('workload-settings-changed', {
            detail: { mode: getMode(), useDelay: getUseDelay(), showOverlay: getShowOverlay() }
        }));
    }

    function loadPos() {
        try {
            const o = JSON.parse(localStorage.getItem(STORAGE_POS) || 'null');
            if (o && typeof o.left === 'number' && typeof o.top === 'number') return o;
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
        const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin));
        const top = Math.max(margin, Math.min(rect.top, window.innerHeight - rect.height - margin));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        savePos(left, top);
    }

    function buildPanel() {
        const mode = getMode();
        const el = document.createElement('aside');
        el.className = 'workload-panel';
        el.setAttribute('role', 'complementary');
        el.setAttribute('aria-label', 'Belastning: rörelser per kvart');
        el.hidden = true;
        el.innerHTML = `
            <div class="workload-panel__header" data-drag-handle>
                <div class="workload-panel__title-wrap">
                    <h2 class="workload-panel__title">Belastning</h2>
                    <span class="workload-panel__subtitle">Ankomster + avgångar per 15 min</span>
                </div>
                <button type="button" class="workload-panel__close" aria-label="Stäng panel" title="Stäng">×</button>
            </div>
            <div class="workload-panel__controls">
                <div class="radio-group workload-panel__mode" id="workload-mode-group" style="--radio-options: 3">
                    <div class="radio-group-option">
                        <input id="wl-mode-all" type="radio" name="workload-mode" value="all" class="radio-group-input" ${mode === 'all' ? 'checked' : ''}>
                        <label for="wl-mode-all" class="radio-group-label">Alla</label>
                    </div>
                    <div class="radio-group-option">
                        <input id="wl-mode-tag" type="radio" name="workload-mode" value="tag" class="radio-group-input" ${mode === 'tag' ? 'checked' : ''}>
                        <label for="wl-mode-tag" class="radio-group-label">Tåg</label>
                    </div>
                    <div class="radio-group-option">
                        <input id="wl-mode-vaxling" type="radio" name="workload-mode" value="vaxling" class="radio-group-input" ${mode === 'vaxling' ? 'checked' : ''}>
                        <label for="wl-mode-vaxling" class="radio-group-label">Växl.</label>
                    </div>
                </div>
                <div class="workload-panel__toggle-row">
                    <span class="workload-panel__toggle-label" id="label-workload-delay">Justera för förseningar</span>
                    <div class="toggle-switch toggle-switch--small ${getUseDelay() ? 'checked' : ''}" id="workload-delay-toggle"
                        role="switch" aria-checked="${getUseDelay()}" aria-labelledby="label-workload-delay" tabindex="0">
                        <div class="toggle-thumb"></div>
                    </div>
                </div>
                <div class="workload-panel__toggle-row">
                    <span class="workload-panel__toggle-label" id="label-workload-overlay">Visa i tidslinjen</span>
                    <div class="toggle-switch toggle-switch--small ${getShowOverlay() ? 'checked' : ''}" id="workload-overlay-toggle"
                        role="switch" aria-checked="${getShowOverlay()}" aria-labelledby="label-workload-overlay" tabindex="0">
                        <div class="toggle-thumb"></div>
                    </div>
                </div>
            </div>
            <div class="workload-panel__chart-wrap">
                <div class="workload-chart" id="workload-chart">
                    <div class="workload-chart__cols"></div>
                    <div class="workload-chart__viewport" aria-hidden="true"></div>
                    <div class="workload-chart__now" aria-hidden="true"></div>
                </div>
                <div class="workload-chart__hours" aria-hidden="true"></div>
                <div class="workload-chart__tooltip" hidden></div>
            </div>
            <div class="workload-panel__footer">
                <span class="workload-panel__legend">
                    <span class="workload-legend-dot workload-legend-dot--tag"></span>Tåg
                    <span class="workload-legend-dot workload-legend-dot--vaxling"></span>Växling
                </span>
                <span class="workload-panel__stats">
                    <span id="workload-peak">–</span>
                    <span id="workload-total">–</span>
                </span>
            </div>
        `;
        document.body.appendChild(el);
        return el;
    }

    function scaleMaxFor(result, mode) {
        if (mode === 'tag') return Math.max(result.maxTag, 1);
        if (mode === 'vaxling') return Math.max(result.maxVaxling, 1);
        return Math.max(result.maxAll, 1);
    }

    function renderChart() {
        if (!panel || panel.hidden) return;
        lastResult = window.WorkloadAggregator
            ? window.WorkloadAggregator.compute({ useDelay: getUseDelay() })
            : null;
        if (!lastResult) return;

        const mode = getMode();
        const scaleMax = scaleMaxFor(lastResult, mode);
        const frag = document.createDocumentFragment();

        for (let i = 0; i < lastResult.bucketCount; i++) {
            const b = lastResult.buckets[i];
            const col = document.createElement('div');
            col.className = 'workload-chart__col';
            if (mode !== 'vaxling' && b.tag > 0) {
                const seg = document.createElement('div');
                seg.className = 'workload-chart__seg workload-chart__seg--tag';
                seg.style.height = `${(b.tag / scaleMax) * 100}%`;
                col.appendChild(seg);
            }
            if (mode !== 'tag' && b.vaxling > 0) {
                const seg = document.createElement('div');
                seg.className = 'workload-chart__seg workload-chart__seg--vaxling';
                seg.style.height = `${(b.vaxling / scaleMax) * 100}%`;
                col.appendChild(seg);
            }
            frag.appendChild(col);
        }
        colsEl.replaceChildren(frag);

        renderHourTicks();
        renderStats(mode);
        updateViewportShade();
        updateNowTick();
    }

    function renderHourTicks() {
        const hoursEl = panel.querySelector('.workload-chart__hours');
        const total = lastResult.totalHours;
        const frag = document.createDocumentFragment();
        for (let h = 0; h <= total; h += 6) {
            const tick = document.createElement('span');
            tick.className = 'workload-chart__hour-tick';
            tick.style.left = `${(h / total) * 100}%`;
            tick.textContent = String(h % 24).padStart(2, '0');
            frag.appendChild(tick);
        }
        hoursEl.replaceChildren(frag);
    }

    function renderStats(mode) {
        const r = lastResult;
        let peakIdx, peakVal, total;
        if (mode === 'tag') { peakIdx = r.peakTagIndex; peakVal = r.maxTag; total = r.totalTag; }
        else if (mode === 'vaxling') { peakIdx = r.peakVaxlingIndex; peakVal = r.maxVaxling; total = r.totalVaxling; }
        else { peakIdx = r.peakAllIndex; peakVal = r.maxAll; total = r.totalTag + r.totalVaxling; }

        peakEl.textContent = peakIdx >= 0
            ? `Max ${peakVal} · ${window.WorkloadAggregator.bucketLabel(r, peakIdx)}`
            : 'Max –';
        totalEl.textContent = `Totalt ${total}`;
    }

    /** Shade the chart region matching the main view's visible time window. */
    function updateViewportShade() {
        if (!lastResult || !viewportEl) return;
        const wrapper = document.querySelector('.schedule-wrapper');
        const pxPerHour = window.currentPixelsPerHour;
        if (!wrapper || !pxPerHour) return;
        const total = lastResult.totalHours;
        const leftPct = Math.max(0, (wrapper.scrollLeft / pxPerHour / total) * 100);
        const widthPct = Math.min(100 - leftPct, (wrapper.clientWidth / pxPerHour / total) * 100);
        viewportEl.style.left = `${leftPct}%`;
        viewportEl.style.width = `${widthPct}%`;
    }

    function updateNowTick() {
        if (!lastResult || !nowEl) return;
        const hours = (Date.now() - lastResult.timelineStart.getTime()) / 3600000;
        if (hours < 0 || hours > lastResult.totalHours) {
            nowEl.hidden = true;
            return;
        }
        nowEl.hidden = false;
        nowEl.style.left = `${(hours / lastResult.totalHours) * 100}%`;
    }

    function onWrapperScroll() {
        if (!panel || panel.hidden) return;
        if (viewportRaf) return;
        viewportRaf = requestAnimationFrame(() => {
            viewportRaf = 0;
            updateViewportShade();
        });
    }

    // --- chart hover tooltip + click/drag navigation ---

    function bucketIndexFromEvent(e) {
        if (!lastResult) return -1;
        const rect = colsEl.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(lastResult.bucketCount - 1, Math.floor(frac * lastResult.bucketCount)));
    }

    function showTooltip(e) {
        const idx = bucketIndexFromEvent(e);
        if (idx < 0) { tooltipEl.hidden = true; return; }
        const b = lastResult.buckets[idx];
        const mode = getMode();
        let text;
        const label = window.WorkloadAggregator.bucketLabel(lastResult, idx);
        if (mode === 'tag') text = `${label} · ${b.tag} tåg`;
        else if (mode === 'vaxling') text = `${label} · ${b.vaxling} växl.`;
        else text = `${label} · ${b.tag + b.vaxling} rörelser (${b.tag} tåg, ${b.vaxling} växl.)`;
        tooltipEl.textContent = text;
        tooltipEl.hidden = false;

        const wrapRect = tooltipEl.parentElement.getBoundingClientRect();
        let x = e.clientX - wrapRect.left;
        x = Math.max(4, Math.min(x, wrapRect.width - tooltipEl.offsetWidth - 4));
        tooltipEl.style.left = `${x}px`;
    }

    /** Pan the main view so the chart-fraction time sits at the viewport center. */
    function panMainViewTo(e) {
        if (!lastResult) return;
        const wrapper = document.querySelector('.schedule-wrapper');
        const pxPerHour = window.currentPixelsPerHour;
        if (!wrapper || !pxPerHour) return;
        const rect = colsEl.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetPx = frac * lastResult.totalHours * pxPerHour;
        wrapper.scrollLeft = Math.max(0, targetPx - wrapper.clientWidth / 2);
    }

    function setupChartInteraction() {
        chartEl.addEventListener('pointermove', (e) => {
            if (scrub) { panMainViewTo(e); }
            showTooltip(e);
        });
        chartEl.addEventListener('pointerleave', () => { tooltipEl.hidden = true; });
        chartEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            scrub = true;
            chartEl.setPointerCapture(e.pointerId);
            chartEl.classList.add('is-scrubbing');
            panMainViewTo(e);
            e.preventDefault();
        });
        const endScrub = (e) => {
            if (!scrub) return;
            scrub = null;
            chartEl.classList.remove('is-scrubbing');
            try { chartEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        };
        chartEl.addEventListener('pointerup', endScrub);
        chartEl.addEventListener('pointercancel', endScrub);
    }

    // --- controls ---

    function setupToggleSwitch(el, getter, setter) {
        const apply = (on) => {
            el.classList.toggle('checked', on);
            el.setAttribute('aria-checked', on ? 'true' : 'false');
        };
        const flip = () => {
            const next = !getter();
            setter(next);
            apply(next);
        };
        el.addEventListener('click', flip);
        el.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                flip();
            }
        });
    }

    function setupControls() {
        const modeGroup = panel.querySelector('#workload-mode-group');
        const updateHighlight = () => {
            modeGroup.querySelectorAll('.radio-group-input').forEach((input, idx) => {
                if (input.checked) modeGroup.style.setProperty('--highlight-index', idx);
            });
        };
        updateHighlight();
        modeGroup.querySelectorAll('.radio-group-input').forEach((input) => {
            input.addEventListener('change', () => {
                localStorage.setItem(STORAGE_MODE, input.value);
                updateHighlight();
                renderChart();
                notifySettingsChanged();
            });
        });

        setupToggleSwitch(panel.querySelector('#workload-delay-toggle'), getUseDelay, (on) => {
            localStorage.setItem(STORAGE_DELAY, on ? '1' : '0');
            renderChart();
            notifySettingsChanged();
        });

        setupToggleSwitch(panel.querySelector('#workload-overlay-toggle'), getShowOverlay, (on) => {
            localStorage.setItem(STORAGE_OVERLAY, on ? '1' : '0');
            notifySettingsChanged();
        });
    }

    // --- open/close, drag, position (late-arrivals pattern) ---

    function setOpen(open) {
        if (!panel || !toggleBtn) return;
        panel.hidden = !open;
        toggleBtn.classList.toggle('is-active', open);
        toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
        localStorage.setItem(STORAGE_OPEN, open ? '1' : '0');
        if (open) {
            renderChart();
            if (!nowTimer) nowTimer = window.setInterval(updateNowTick, NOW_TICK_MS);
        } else if (nowTimer) {
            clearInterval(nowTimer);
            nowTimer = null;
        }
    }

    function setupDrag() {
        const handle = panel.querySelector('[data-drag-handle]');
        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.workload-panel__close')) return;
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            drag = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!drag) return;
            const margin = 8;
            const left = Math.max(margin, Math.min(e.clientX - drag.offsetX, window.innerWidth - panel.offsetWidth - margin));
            const top = Math.max(margin, Math.min(e.clientY - drag.offsetY, window.innerHeight - panel.offsetHeight - margin));
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
            panel.style.top = 'calc(var(--header-height) + 16px)';
            panel.style.left = 'auto';
            panel.style.bottom = 'auto';
        }
    }

    function init() {
        toggleBtn = document.getElementById('workload-toggle');
        if (!toggleBtn) {
            console.warn('WorkloadPanel: toggle button missing');
            return;
        }

        panel = buildPanel();
        chartEl = panel.querySelector('#workload-chart');
        colsEl = panel.querySelector('.workload-chart__cols');
        viewportEl = panel.querySelector('.workload-chart__viewport');
        nowEl = panel.querySelector('.workload-chart__now');
        tooltipEl = panel.querySelector('.workload-chart__tooltip');
        peakEl = panel.querySelector('#workload-peak');
        totalEl = panel.querySelector('#workload-total');

        panel.querySelector('.workload-panel__close').addEventListener('click', () => setOpen(false));
        toggleBtn.addEventListener('click', () => setOpen(panel.hidden));

        setupControls();
        setupChartInteraction();
        setupDrag();
        positionInitial();

        window.addEventListener('schedule:rendered', () => {
            if (!panel.hidden) renderChart();
        });
        window.addEventListener('delay-feed-updated', () => {
            if (!panel.hidden && getUseDelay()) renderChart();
        });
        window.addEventListener('user-trains-changed', () => {
            if (!panel.hidden) renderChart();
        });
        window.addEventListener('resize', () => {
            if (!panel.hidden) clampPanelPosition();
        });
        const wrapper = document.querySelector('.schedule-wrapper');
        if (wrapper) wrapper.addEventListener('scroll', onWrapperScroll, { passive: true });

        if (localStorage.getItem(STORAGE_OPEN) === '1') setOpen(true);
    }

    window.WorkloadPanel = { init };
})();
