/**
 * Closure Renderer
 * ================
 * Draws "track closed" bands on the schedule timeline.
 *
 * Closures are extracted from red-family bars in the PDF (see
 * extract_monday.py / classify_closures).  They are NOT train services
 * and must never be included in anything that looks at
 * `window.cachedTrains` (conflict detection, selectors, delay logic, …).
 *
 * Visual language:
 *   - Diagonal warning stripes in a neutral grey so they read as
 *     "unavailable / no trains here" without competing with the colour
 *     coding used for train length buckets.
 *   - Lock/stop glyph + readable text with start/end time so operators
 *     can scan the timeline and know why the track is blocked.
 *   - Hoverable tooltip shows the full reason string.
 *
 * The renderer reads `window.initialTrackClosures` which is emitted by
 * `TrainData/emit_app_data.py` into `closures.js`.
 */

window.ClosureRenderer = (() => {
    /**
     * Parse a "HH:MM" string into a Date aligned to the same midnight the
     * train data uses (startTime passed in from schedule-renderer).
     * Returns null for empty strings.
     */
    function parseTime(str, base) {
        if (!str) return null;
        const [h, m] = str.split(':').map(Number);
        return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    }

    /**
     * Converts closure data into timeline-relative minute offsets, then
     * draws one DIV per closure into `#timeline-canvas`.
     */
    function render(trackLayouts, timelineStart, pixelsPerHour, viewWindowStart, viewWindowEnd) {
        const canvas = document.getElementById('timeline-canvas');
        if (!canvas) return;

        // Remove prior closures before re-rendering.
        canvas.querySelectorAll('.closure-band').forEach(el => el.remove());

        // `initialTrackClosures` is declared with `const` at the top level of
        // `closures.js`, which does NOT attach to `window` in browsers; we
        // therefore reach for the bare identifier.  Wrapped in typeof so we
        // don't throw when the file failed to load.
        let baseClosures = (typeof initialTrackClosures !== 'undefined' && Array.isArray(initialTrackClosures))
            ? initialTrackClosures
            : [];
        if (window.SparplanenResolve && typeof window.SparplanenResolve.parseScheduleNow === 'function'
            && typeof window.SparplanenResolve.parseClosuresNow === 'function') {
            const r = window.SparplanenResolve.parseScheduleNow();
            if (r && r.usedBundle && r.week && r.day) {
                const fromBundle = window.SparplanenResolve.parseClosuresNow(r.week, r.day);
                if (Array.isArray(fromBundle)) {
                    baseClosures = fromBundle;
                }
            }
        }
        const userClosures = (window.UserClosuresStore && typeof window.UserClosuresStore.getAll === 'function')
            ? window.UserClosuresStore.getAll()
            : [];
        const source = baseClosures.concat(userClosures);
        if (source.length === 0) return;

        source.forEach(c => {
            const track = trackLayouts.find(t => t.id === c.trackId);
            if (!track) return;

            const start = parseTime(c.startTime, timelineStart);
            const end = parseTime(c.endTime, timelineStart);
            if (!start || !end) return;

            // Viewport cull for performance.
            if (end < viewWindowStart || start > viewWindowEnd) return;

            const startMin = (start - timelineStart) / 60000;
            const endMin = (end - timelineStart) / 60000;

            const left = (startMin / 60) * pixelsPerHour;
            const width = Math.max(((endMin - startMin) / 60) * pixelsPerHour, 6);

            const el = document.createElement('div');
            el.className = 'closure-band';
            el.style.left = `${left}px`;
            el.style.width = `${width}px`;
            el.style.top = `${track.top + 2}px`;
            el.style.height = `${Math.max(track.height - 4, 12)}px`;

            const timeRange = `${c.startTime} – ${c.endTime}`;
            const reason = c.reason || 'Spår stängt';
            el.dataset.trackId = String(c.trackId);
            el.dataset.subTrackIndex = String(c.subTrackIndex ?? 0);
            if (c.id !== undefined && c.id !== null) {
                el.dataset.closureId = String(c.id);
            }
            if (c.userAdded) {
                el.dataset.userAdded = 'true';
                el.classList.add('closure-band--user-added');
            }
            el.setAttribute('role', 'img');
            el.setAttribute('aria-label', `${reason}: ${timeRange}`);

            const narrow = width < 80;
            el.innerHTML = `
                <div class="closure-band__stripes" aria-hidden="true"></div>
                <div class="closure-band__content">
                    <span class="closure-band__icon" aria-hidden="true">⛔</span>
                    ${narrow ? '' : `<span class="closure-band__label">${reason}</span>`}
                    <span class="closure-band__time">${timeRange}</span>
                </div>
                <div class="closure-band__tooltip" role="tooltip">
                    <strong>${reason}</strong>
                    <br>${timeRange}
                    <br><span class="closure-band__tooltip-meta">Spår ${c.trackId}${c.subTrackIndex ? `.${c.subTrackIndex}` : ''}</span>
                </div>
            `;

            canvas.appendChild(el);
        });
    }

    return { render };
})();
