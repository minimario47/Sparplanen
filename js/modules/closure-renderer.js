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

    const DAY_MS = 24 * 60 * 60 * 1000;
    const ARCHIVE_DAY_KEYS = ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag'];

    function toMin(str) {
        if (!str) return null;
        const [h, m] = String(str).split(':').map(Number);
        return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
    }

    /**
     * Merge closure fragments the PDF extractor split across 3h pages back into
     * one continuous band per track+sub-track. A track shut all day arrives as
     * several abutting slices (e.g. 00:00–06:05, 06:00–12:05, … each flagged
     * continuesTo/FromPrevPage); fragments that overlap or touch (≤1 min gap) on
     * the same track are the same physical closure and are joined. Genuinely
     * separate closures with a real gap stay distinct.
     */
    function mergeClosures(list) {
        const byKey = new Map();
        (list || []).forEach((c) => {
            const s = toMin(c.startTime);
            const e = toMin(c.endTime);
            if (s == null || e == null) return;
            const key = `${c.trackId}|${c.subTrackIndex ?? 0}`;
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push({ ...c, _s: s, _e: e });
        });
        const out = [];
        byKey.forEach((arr) => {
            arr.sort((a, b) => a._s - b._s);
            let cur = null;
            arr.forEach((c) => {
                if (cur && c._s <= cur._e + 1) {
                    if (c._e > cur._e) { cur._e = c._e; cur.endTime = c.endTime; }
                } else {
                    if (cur) out.push(cur);
                    cur = { ...c };
                }
            });
            if (cur) out.push(cur);
        });
        return out;
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
        const resolve = window.SparplanenResolve;
        const sel = window.currentScheduleSelection || {};

        // Gather closures as { closures, base } day-groups. Live mode: the one
        // resolved day at timelineStart. Archive mode: every available day of the
        // week, each offset to its own day on the wide canvas — so e.g. Saturday's
        // all-day closures show when you scroll to Saturday (not just the first
        // day's).
        const groups = [];
        if (sel.archive && sel.week && sel.anchorStr && resolve
            && typeof resolve.parseClosuresNow === 'function') {
            const anchors = (window.SPARPLANEN_ANCHORS || {})[sel.week] || {};
            const fp = String(sel.anchorStr).split('-').map(Number);
            const firstNoon = new Date(fp[0], fp[1] - 1, fp[2], 12, 0, 0, 0);
            ARCHIVE_DAY_KEYS.forEach((dk) => {
                const cs = resolve.parseClosuresNow(sel.week, dk);
                const aStr = anchors[dk];
                if (!Array.isArray(cs) || !cs.length || !aStr) return;
                const p = String(aStr).split('-').map(Number);
                const offset = Math.round(
                    (new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0) - firstNoon) / DAY_MS);
                groups.push({ closures: cs, base: new Date(timelineStart.getTime() + offset * DAY_MS) });
            });
        } else {
            let baseClosures = (typeof initialTrackClosures !== 'undefined' && Array.isArray(initialTrackClosures))
                ? initialTrackClosures
                : [];
            if (resolve && typeof resolve.parseScheduleNow === 'function'
                && typeof resolve.parseClosuresNow === 'function') {
                const r = resolve.parseScheduleNow();
                if (r && r.usedBundle && r.week && r.day) {
                    const fromBundle = resolve.parseClosuresNow(r.week, r.day);
                    if (Array.isArray(fromBundle)) baseClosures = fromBundle;
                }
            }
            groups.push({ closures: baseClosures, base: timelineStart });
        }

        const userClosures = (window.UserClosuresStore && typeof window.UserClosuresStore.getAll === 'function')
            ? window.UserClosuresStore.getAll()
            : [];
        if (userClosures.length) groups.push({ closures: userClosures, base: timelineStart });

        // Merge page-split fragments within each day, then flatten to {c, base}.
        const source = [];
        groups.forEach(({ closures, base }) => {
            mergeClosures(closures).forEach((c) => source.push({ c, base }));
        });
        if (source.length === 0) return;

        source.forEach(({ c, base }) => {
            const track = trackLayouts.find(t => t.id === c.trackId);
            if (!track) return;

            const start = parseTime(c.startTime, base);
            const end = parseTime(c.endTime, base);
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
