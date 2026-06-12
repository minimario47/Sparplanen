/**
 * Belastning heat strip: a thin density band at the bottom of the sticky
 * timeline header, one cell per 15-min bucket, aligned with the time axis
 * (same left/width pixel math as closure bands). Intensity is scaled to the
 * day's busiest bucket for the active mode. Enabled/configured from the
 * workload panel; settings shared via localStorage + the
 * 'workload-settings-changed' event. Clicking a cell centers the main view
 * on that quarter hour.
 */
(function () {
    'use strict';

    const STORAGE_MODE = 'workloadMode';
    const STORAGE_DELAY = 'workloadUseDelay';
    const STORAGE_OVERLAY = 'workloadShowOverlay';
    const LEVELS = 4; // intensity classes 1..4; 0 = empty (no cell)

    let strip = null;

    function getMode() {
        const v = localStorage.getItem(STORAGE_MODE);
        return (v === 'tag' || v === 'vaxling') ? v : 'all';
    }
    function getUseDelay() { return localStorage.getItem(STORAGE_DELAY) === '1'; }
    function isEnabled() { return localStorage.getItem(STORAGE_OVERLAY) === '1'; }

    function ensureStrip() {
        if (strip) return strip;
        const header = document.querySelector('.schedule-timeline-header');
        if (!header) return null;
        strip = document.createElement('div');
        strip.id = 'workload-heat-strip';
        strip.className = 'workload-heat-strip';
        strip.setAttribute('aria-hidden', 'true');
        header.appendChild(strip);
        return strip;
    }

    function countFor(bucket, mode) {
        if (mode === 'tag') return bucket.tag;
        if (mode === 'vaxling') return bucket.vaxling;
        return bucket.tag + bucket.vaxling;
    }

    function render() {
        const el = ensureStrip();
        if (!el) return;

        if (!isEnabled()) {
            el.hidden = true;
            el.replaceChildren();
            return;
        }

        const result = window.WorkloadAggregator
            ? window.WorkloadAggregator.compute({ useDelay: getUseDelay() })
            : null;
        const pxPerHour = window.currentPixelsPerHour;
        if (!result || !pxPerHour) {
            el.hidden = true;
            return;
        }

        const mode = getMode();
        let scaleMax = 1;
        for (const b of result.buckets) scaleMax = Math.max(scaleMax, countFor(b, mode));

        const cellWidth = pxPerHour * (result.bucketMinutes / 60);
        const frag = document.createDocumentFragment();

        for (let i = 0; i < result.bucketCount; i++) {
            const count = countFor(result.buckets[i], mode);
            if (count === 0) continue;
            const level = Math.max(1, Math.ceil((count / scaleMax) * LEVELS));
            const cell = document.createElement('div');
            cell.className = 'workload-heat-cell';
            cell.dataset.level = String(level);
            cell.style.left = `${i * cellWidth}px`;
            cell.style.width = `${cellWidth}px`;
            const b = result.buckets[i];
            cell.title = `${window.WorkloadAggregator.bucketLabel(result, i)} · ${count} rörelser (${b.tag} tåg, ${b.vaxling} växl.)`;
            cell.dataset.bucket = String(i);
            frag.appendChild(cell);
        }

        el.replaceChildren(frag);
        el.hidden = false;
    }

    function onStripClick(e) {
        const cell = e.target.closest('.workload-heat-cell');
        if (!cell || !window.TimeManager || !window.scheduleState) return;
        const idx = parseInt(cell.dataset.bucket, 10);
        const bucketMinutes = window.WorkloadAggregator.BUCKET_MINUTES;
        const center = new Date(
            window.scheduleState.timelineStart.getTime() + (idx + 0.5) * bucketMinutes * 60000
        );
        window.TimeManager.centerOnTime(center);
    }

    function init() {
        window.addEventListener('schedule:rendered', render);
        window.addEventListener('workload-settings-changed', render);
        window.addEventListener('user-trains-changed', () => { if (isEnabled()) render(); });
        window.addEventListener('delay-feed-updated', () => {
            if (isEnabled() && getUseDelay()) render();
        });
        const el = ensureStrip();
        if (el) el.addEventListener('click', onStripClick);
        render();
    }

    window.WorkloadOverlay = { init, render };
})();
