/**
 * Track Changes Decorator
 *
 * Listens to `schedule:rendered`, `track-changes-changed` and
 * `settingsChanged` and overlays two visuals onto `#timeline-canvas`
 * for every active track change:
 *
 *   1. An arrow connecting the train's planned track row to its actual row,
 *      pointing toward the actual API track.
 *   2. A "ghost" silhouette of the train at its previous track,
 *      slowly fading away.
 *
 * Pure presentation. No mutation of train data.
 */
(function () {
    'use strict';

    const ARROW_CLASS = 'track-change-arrow';
    const GHOST_CLASS = 'track-change-ghost';
    const LAYER_ID = 'track-changes-layer';

    function getCanvas() {
        return document.getElementById('timeline-canvas');
    }

    function getLayer() {
        const canvas = getCanvas();
        if (!canvas) return null;
        let layer = document.getElementById(LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = LAYER_ID;
            layer.className = 'track-changes-layer';
            canvas.appendChild(layer);
        } else if (layer.parentNode !== canvas) {
            canvas.appendChild(layer);
        }
        return layer;
    }

    function clearLayer() {
        const layer = document.getElementById(LAYER_ID);
        if (layer) layer.innerHTML = '';
    }

    function getSettings() {
        return window.SettingsModal?.getCurrentSettings?.() || {};
    }

    function getTrackLayouts() {
        return window.scheduleState?.trackLayouts || null;
    }

    function findLayout(layouts, trackId) {
        if (!Array.isArray(layouts) || trackId == null) return null;
        const id = parseInt(trackId, 10);
        return layouts.find((l) => parseInt(l.id, 10) === id) || null;
    }

    function findBar(canvas, trainId, leg) {
        if (!canvas || trainId == null) return null;
        const id = CSS.escape(String(trainId));
        // A torn (split) train renders as two halves sharing the train id;
        // prefer the half matching the change's leg.
        if (leg) {
            const half = canvas.querySelector(`.train-bar[data-train-id="${id}"][data-segment="${leg}"]`);
            if (half) return half;
        }
        return canvas.querySelector(`.train-bar[data-train-id="${id}"]:not([data-segment])`) ||
               canvas.querySelector(`.train-bar[data-train-id="${id}"]`);
    }

    function readPx(value, fallback = 0) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        if (max < min) return min;
        return Math.min(max, Math.max(min, value));
    }

    function getBarMetrics(bar) {
        const rect = bar.getBoundingClientRect();
        return {
            left: readPx(bar.style.left, 0),
            top: readPx(bar.style.top, 0),
            width: readPx(bar.style.width, rect.width || 0),
            height: readPx(bar.style.height, rect.height || 18)
        };
    }

    function getGhostTop(bar, oldLayout, newLayout, metrics) {
        const maxOffset = Math.max(0, oldLayout.height - metrics.height);
        if (newLayout) {
            return oldLayout.top + clamp(metrics.top - newLayout.top, 0, maxOffset);
        }

        const laneIndex = parseInt(bar.dataset.subTrackIndex, 10);
        const laneCount = Math.max(parseInt(oldLayout.laneCount || 1, 10), 1);
        const laneHeight = oldLayout.height / laneCount;
        const laneOffset = Number.isFinite(laneIndex)
            ? laneIndex * laneHeight + Math.max(1, (laneHeight - metrics.height) / 2)
            : (oldLayout.height - metrics.height) / 2;

        return oldLayout.top + clamp(laneOffset, 0, maxOffset);
    }

    function normalizeNumber(value) {
        return String(value || '').trim();
    }

    function getTargetNumberElement(numberElements, bar, entry) {
        if (numberElements.length === 0) return null;
        if (numberElements.length === 1) return numberElements[0];

        const wantedNumber = normalizeNumber(entry?.trainNumber);
        if (wantedNumber) {
            const exact = numberElements.find((el) => normalizeNumber(el.textContent) === wantedNumber);
            if (exact) return exact;
        }

        if (entry?.leg === 'departure') return numberElements[numberElements.length - 1];
        if (entry?.leg === 'arrival') return numberElements[0];

        const arrival = normalizeNumber(bar.dataset.arrival);
        const departure = normalizeNumber(bar.dataset.departure);
        if (wantedNumber && wantedNumber === departure && wantedNumber !== arrival) {
            return numberElements[numberElements.length - 1];
        }
        return numberElements[0];
    }

    function getNumberAnchorX(canvas, bar, entry, metrics) {
        const minX = metrics.left + Math.min(6, Math.max(0, metrics.width / 2));
        const maxX = metrics.left + Math.max(0, metrics.width - 6);
        const numberElements = Array.from(bar.querySelectorAll('.train-number-value'))
            .filter((el) => normalizeNumber(el.textContent));

        const target = getTargetNumberElement(numberElements, bar, entry);
        const canvasRect = canvas.getBoundingClientRect?.();
        if (target && canvasRect) {
            const rect = target.getBoundingClientRect();
            if (rect.width || rect.height) {
                return clamp(rect.left + rect.width / 2 - canvasRect.left, minX, maxX);
            }
        }

        if (entry?.leg === 'departure') {
            return clamp(metrics.left + metrics.width - Math.min(28, metrics.width * 0.25), minX, maxX);
        }
        if (entry?.leg === 'arrival') {
            return clamp(metrics.left + Math.min(28, metrics.width * 0.25), minX, maxX);
        }
        return metrics.left + metrics.width / 2;
    }

    function buildGhost(bar, oldLayout, newLayout, remainingMs, entry) {
        const ghost = document.createElement('div');
        ghost.className = GHOST_CLASS;
        ghost.dataset.trainId = bar.dataset.trainId;
        if (entry?.trainNumber) ghost.dataset.trainNumber = entry.trainNumber;

        const metrics = getBarMetrics(bar);
        const top = getGhostTop(bar, oldLayout, newLayout, metrics);

        ghost.style.left = `${metrics.left}px`;
        ghost.style.top = `${top}px`;
        ghost.style.width = `${metrics.width}px`;
        ghost.style.height = `${metrics.height}px`;
        ghost.style.animationDuration = `${remainingMs}ms`;
        ghost.setAttribute('aria-hidden', 'true');

        // The ghost should show only the previous bar position; train/track text is already visible in context.
        ghost.innerHTML = `
            <div class="${GHOST_CLASS}__stripe"></div>
        `;

        return ghost;
    }

    function buildArrow(canvas, bar, oldLayout, newLayout, entry, remainingMs) {
        const metrics = getBarMetrics(bar);
        const oldTop = getGhostTop(bar, oldLayout, newLayout, metrics);
        const oldCenterY = oldTop + metrics.height / 2;
        const newCenterY = metrics.top + metrics.height / 2;

        const goingDown = newCenterY > oldCenterY;

        const top = Math.min(oldCenterY, newCenterY) - 4;
        const height = Math.abs(newCenterY - oldCenterY) + 8;
        const svgWidth = 24;
        const anchorX = getNumberAnchorX(canvas, bar, entry, metrics);
        const arrowLeft = Math.max(0, anchorX - svgWidth / 2);

        const wrap = document.createElement('div');
        wrap.className = ARROW_CLASS;
        if (entry.discrepancy) wrap.classList.add(`${ARROW_CLASS}--discrepancy`);
        wrap.dataset.trainId = bar.dataset.trainId;
        if (entry.trainNumber) wrap.dataset.trainNumber = entry.trainNumber;
        wrap.style.left = `${arrowLeft}px`;
        wrap.style.top = `${top}px`;
        wrap.style.width = `${svgWidth}px`;
        wrap.style.height = `${height}px`;
        wrap.style.animationDuration = `${remainingMs}ms`;
        wrap.title = `${entry.fromTrack ?? '?'} → ${entry.toTrack ?? '?'}`;

        const x = svgWidth / 2;
        const y1 = goingDown ? 2 : height - 2;        // planned track
        const y2 = goingDown ? height - 2 : 2;        // actual train bar; hidden underneath the bar

        wrap.innerHTML = `
            <svg viewBox="0 0 ${svgWidth} ${height}" width="${svgWidth}" height="${height}" aria-hidden="true">
                <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"
                      class="${ARROW_CLASS}__shaft" stroke-linecap="round"></line>
                <circle cx="${x}" cy="${y1}" r="2.5" class="${ARROW_CLASS}__dot"></circle>
            </svg>
        `;

        return wrap;
    }

    const SEAM_CLASS = 'track-change-seam';

    /**
     * Draw the "tear seam" connecting the two halves of a split train —
     * a jagged vertical zigzag between the torn edges, echoing the rip.
     */
    function decorateSplits(canvas, layer) {
        const trains = Array.isArray(window.cachedTrains) ? window.cachedTrains : [];
        trains.forEach((train) => {
            const st = train && train.splitTracks;
            if (!st) return;
            const id = CSS.escape(String(train.id));
            const arrBar = canvas.querySelector(`.train-bar[data-train-id="${id}"][data-segment="arrival"]`);
            const depBar = canvas.querySelector(`.train-bar[data-train-id="${id}"][data-segment="departure"]`);
            if (!arrBar || !depBar) return;

            arrBar.dataset.split = 'true';
            depBar.dataset.split = 'true';

            const a = getBarMetrics(arrBar);
            const d = getBarMetrics(depBar);
            const aY = a.top + a.height / 2;
            const dY = d.top + d.height / 2;
            const seamX = a.left + a.width; // torn edge; equals depBar's left

            const pad = 7;
            const top = Math.min(aY, dY) - pad;
            const height = Math.abs(dY - aY) + pad * 2;
            const svgW = 18;
            const cx = svgW / 2;

            const wrap = document.createElement('div');
            wrap.className = SEAM_CLASS;
            wrap.dataset.trainId = String(train.id);
            wrap.style.left = `${seamX - svgW / 2}px`;
            wrap.style.top = `${top}px`;
            wrap.style.width = `${svgW}px`;
            wrap.style.height = `${height}px`;
            wrap.title = `Ankomst spår ${st.arrivalTrack} · Avgång spår ${st.departureTrack} (planerat spår ${st.plannedTrack})`;

            // Deterministic zigzag between the two bar centers.
            const y0 = pad;
            const y1 = height - pad;
            const steps = Math.max(4, Math.round((y1 - y0) / 9));
            let points = `${cx},${y0}`;
            for (let i = 1; i < steps; i++) {
                const y = y0 + ((y1 - y0) * i) / steps;
                const dx = (i % 2 === 0 ? -1 : 1) * 4.5;
                points += ` ${cx + dx},${y.toFixed(1)}`;
            }
            points += ` ${cx},${y1}`;

            wrap.innerHTML = `
                <svg viewBox="0 0 ${svgW} ${height}" width="${svgW}" height="${height}" aria-hidden="true">
                    <polyline points="${points}" class="${SEAM_CLASS}__zig" fill="none" stroke-linejoin="round"></polyline>
                    <line x1="${cx - 6}" y1="${y0}" x2="${cx + 6}" y2="${y0}" class="${SEAM_CLASS}__end"></line>
                    <line x1="${cx - 6}" y1="${y1}" x2="${cx + 6}" y2="${y1}" class="${SEAM_CLASS}__end"></line>
                </svg>
            `;

            layer.appendChild(wrap);
        });
    }

    function decorateAll() {
        const canvas = getCanvas();
        if (!canvas) return;
        const layer = getLayer();
        if (!layer) return;

        layer.innerHTML = '';

        const settings = getSettings();

        // Tear seams for split trains are driven by trackChangesSplitBar and
        // are independent of the auto-switch setting.
        if (settings.trackChangesSplitBar !== false) {
            decorateSplits(canvas, layer);
        }

        const store = window.TrackChangesStore;
        if (!store) return;

        // The arrow/ghost visuals describe the auto-switch movement; they only
        // make sense when auto-switch is on. With auto-switch off, the train
        // bar stays on the planned track so a "ghost on old track" overlay
        // would land on top of the bar itself.
        if (settings.trackChangesAutoSwitch === false) return;
        const showArrow = settings.trackChangesShowArrow !== false;
        const showGhost = settings.trackChangesShowGhost !== false;
        if (!showArrow && !showGhost) return;

        const layouts = getTrackLayouts();
        if (!layouts) return;

        const durationMs = store.getDurationMs();
        const active = store.getAllActive();

        active.forEach((entry) => {
            const bar = findBar(canvas, entry.trainId, entry.leg);
            if (!bar) return;

            const oldLayout = findLayout(layouts, entry.fromTrack);
            const newLayout = findLayout(layouts, entry.toTrack);
            if (!oldLayout) return;

            const elapsed = Date.now() - entry.changedAt;
            const remainingMs = Math.max(150, durationMs - elapsed);

            if (showGhost) {
                const ghost = buildGhost(bar, oldLayout, newLayout, remainingMs, entry);
                layer.appendChild(ghost);
            }

            if (showArrow && newLayout) {
                const arrow = buildArrow(canvas, bar, oldLayout, newLayout, entry, remainingMs);
                layer.appendChild(arrow);
            }

            bar.dataset.hasTrackChange = 'true';
        });
    }

    function clearBarMarkers() {
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.querySelectorAll('.train-bar[data-has-track-change]').forEach((bar) => {
            bar.removeAttribute('data-has-track-change');
        });
        canvas.querySelectorAll('.train-bar[data-split]').forEach((bar) => {
            bar.removeAttribute('data-split');
        });
    }

    function refresh() {
        clearBarMarkers();
        decorateAll();
    }

    let scheduledFrame = null;
    function scheduleRefresh() {
        if (scheduledFrame) return;
        scheduledFrame = window.requestAnimationFrame(() => {
            scheduledFrame = null;
            refresh();
        });
    }

    function init() {
        window.addEventListener('schedule:rendered', scheduleRefresh);
        window.addEventListener('track-changes-changed', scheduleRefresh);
        window.addEventListener('settingsChanged', scheduleRefresh);

        // Periodic refresh keeps the decorator honest as entries expire,
        // even when no other event fires.
        setInterval(() => {
            if (!window.TrackChangesStore) return;
            // Splits outlive the 2-minute arrow/ghost window — keep the seam
            // alive as long as any train is torn.
            const hasSplits = Array.isArray(window.cachedTrains) &&
                window.cachedTrains.some((t) => t && t.splitTracks);
            if (window.TrackChangesStore.getAllActive().length === 0 && !hasSplits) {
                clearLayer();
                return;
            }
            scheduleRefresh();
        }, 5000);

        scheduleRefresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TrackChangesDecorator = {
        refresh,
        clear: clearLayer
    };
})();
