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

    function findBar(canvas, trainId) {
        if (!canvas || trainId == null) return null;
        return canvas.querySelector(`.train-bar[data-train-id="${CSS.escape(String(trainId))}"]`);
    }

    function buildGhost(bar, oldLayout, durationMs, remainingMs, entry) {
        const ghost = document.createElement('div');
        ghost.className = GHOST_CLASS;
        ghost.dataset.trainId = bar.dataset.trainId;
        if (entry?.trainNumber) ghost.dataset.trainNumber = entry.trainNumber;

        const left = parseFloat(bar.style.left) || 0;
        const width = parseFloat(bar.style.width) || bar.getBoundingClientRect().width;
        const height = parseFloat(bar.style.height) || 18;
        const verticalPadding = Math.max(2, Math.round((oldLayout.height - height) / 2));
        const top = oldLayout.top + verticalPadding;

        ghost.style.left = `${left}px`;
        ghost.style.top = `${top}px`;
        ghost.style.width = `${width}px`;
        ghost.style.height = `${height}px`;
        ghost.style.animationDuration = `${remainingMs}ms`;

        // Inner trail decorations: pulsing stripe + label.
        ghost.innerHTML = `
            <div class="${GHOST_CLASS}__stripe"></div>
            <div class="${GHOST_CLASS}__label">${entry?.trainNumber ? `${entry.trainNumber} · ` : ''}Plan ${oldLayout.id}</div>
        `;

        return ghost;
    }

    function buildArrow(bar, oldLayout, newLayout, entry, durationMs, remainingMs) {
        const left = parseFloat(bar.style.left) || 0;
        const width = parseFloat(bar.style.width) || bar.getBoundingClientRect().width;

        const oldCenterY = oldLayout.top + oldLayout.height / 2;
        const newCenterY = newLayout.top + newLayout.height / 2;

        const goingDown = newCenterY > oldCenterY;

        const top = Math.min(oldCenterY, newCenterY) - 6;
        const height = Math.abs(newCenterY - oldCenterY) + 12;
        // Tail anchored 12px in from the leading edge of the train bar so it
        // sits right above/below the train without colliding with text.
        const arrowLeft = Math.max(0, left + Math.min(28, Math.max(12, width * 0.15))) - 11;
        const svgWidth = 22;

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

        const x = svgWidth / 2;
        const y1 = goingDown ? 2 : height - 2;        // tail (planned track)
        const y2 = goingDown ? height - 8 : 8;        // head (actual track)
        const headDir = goingDown ? 1 : -1;
        const pillText = `${entry.trainNumber ? `${entry.trainNumber} · ` : ''}${entry.fromTrack ?? '?'} → ${entry.toTrack ?? '?'}`;

        wrap.innerHTML = `
            <svg viewBox="0 0 ${svgWidth} ${height}" width="${svgWidth}" height="${height}" aria-hidden="true">
                <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"
                      class="${ARROW_CLASS}__shaft" stroke-linecap="round"></line>
                <polyline points="${x - 5},${y2 + 6 * headDir} ${x},${y2} ${x + 5},${y2 + 6 * headDir}"
                          class="${ARROW_CLASS}__head" fill="none" stroke-linejoin="round" stroke-linecap="round"></polyline>
                <circle cx="${x}" cy="${y1}" r="2.5" class="${ARROW_CLASS}__dot"></circle>
            </svg>
            <span class="${ARROW_CLASS}__pill" style="${goingDown ? 'bottom:-4px' : 'top:-4px'}">${pillText}</span>
        `;

        return wrap;
    }

    function decorateAll() {
        const canvas = getCanvas();
        if (!canvas) return;
        const layer = getLayer();
        if (!layer) return;

        layer.innerHTML = '';

        const store = window.TrackChangesStore;
        if (!store) return;

        const settings = getSettings();
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
            const bar = findBar(canvas, entry.trainId);
            if (!bar) return;

            const oldLayout = findLayout(layouts, entry.fromTrack);
            const newLayout = findLayout(layouts, entry.toTrack);
            if (!oldLayout) return;

            const elapsed = Date.now() - entry.changedAt;
            const remainingMs = Math.max(150, durationMs - elapsed);

            if (showGhost) {
                const ghost = buildGhost(bar, oldLayout, durationMs, remainingMs, entry);
                layer.appendChild(ghost);
            }

            if (showArrow && newLayout) {
                const arrow = buildArrow(bar, oldLayout, newLayout, entry, durationMs, remainingMs);
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
            if (window.TrackChangesStore.getAllActive().length === 0) {
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
