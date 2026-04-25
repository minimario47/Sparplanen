/**
 * Grid Coords
 *
 * Translates browser pointer events on the schedule canvas into logical
 * `{ trackId, subTrackIndex, time }` triples used by the empty-grid
 * context menu actions.
 *
 * Relies on `window.scheduleState`, dispatched by schedule-renderer.js
 * after every render, which contains:
 *   - timelineStart   (Date)
 *   - pixelsPerHour   (number)
 *   - trackLayouts    ([{ id, top, height, subTracks?: [{ top, height, index }] }])
 *
 * Public API (window.GridCoords):
 *   fromEvent(event)        → { trackId, subTrackIndex, time, snappedTime, x, y } | null
 *   resolveTime(x)          → Date | null
 *   resolveTrack(y)         → { trackId, subTrackIndex } | null
 *
 * Snapping: time is snapped to the nearest 5 minute mark.
 */
(function () {
    'use strict';

    const SNAP_MINUTES = 5;

    function getCanvas() {
        return document.getElementById('timeline-canvas');
    }

    function getState() {
        return window.scheduleState || null;
    }

    function snapTime(date) {
        if (!(date instanceof Date)) return date;
        const ms = date.getTime();
        const stepMs = SNAP_MINUTES * 60 * 1000;
        return new Date(Math.round(ms / stepMs) * stepMs);
    }

    function resolveTime(canvasX) {
        const state = getState();
        if (!state || !state.timelineStart || !Number.isFinite(state.pixelsPerHour) || state.pixelsPerHour <= 0) {
            return null;
        }
        const hoursFromStart = canvasX / state.pixelsPerHour;
        const ms = state.timelineStart.getTime() + hoursFromStart * 60 * 60 * 1000;
        return new Date(ms);
    }

    function resolveTrack(canvasY) {
        const state = getState();
        if (!state || !Array.isArray(state.trackLayouts)) return null;

        for (const layout of state.trackLayouts) {
            if (canvasY < layout.top || canvasY > layout.top + layout.height) continue;
            let subTrackIndex = 0;
            if (Array.isArray(layout.subTracks) && layout.subTracks.length) {
                const sub = layout.subTracks.find((st) => canvasY >= st.top && canvasY <= st.top + st.height);
                if (sub) subTrackIndex = Number.isFinite(sub.index) ? sub.index : layout.subTracks.indexOf(sub);
            }
            return { trackId: layout.id, subTrackIndex };
        }
        return null;
    }

    function fromEvent(event) {
        const canvas = getCanvas();
        if (!canvas || !event) return null;
        const state = getState();
        if (!state) return null;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left + canvas.scrollLeft;
        const y = event.clientY - rect.top + canvas.scrollTop;

        const time = resolveTime(x);
        if (!time) return null;

        const trackInfo = resolveTrack(y);
        if (!trackInfo) return null;

        return {
            ...trackInfo,
            time,
            snappedTime: snapTime(time),
            x,
            y
        };
    }

    window.GridCoords = {
        SNAP_MINUTES,
        fromEvent,
        resolveTime,
        resolveTrack,
        snapTime
    };
})();
