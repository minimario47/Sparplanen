/**
 * Day Boundary Renderer - marks each midnight on the timeline with a soft
 * colour wash that fades out over the first 30 minutes of the new day, so it
 * is visually obvious where one calendar day ends and the next begins.
 *
 * The 30-hour view contains two midnights:
 *   hour 0  → 00:00 of the displayed day (the day "begins")
 *   hour 24 → 00:00 of the next day (the stitched tomorrow-morning begins)
 * The hour-24 marker is suppressed when tomorrow's data is missing, because
 * the inactive-region torn edge already marks that boundary.
 *
 * Purely static styling (a gradient) — fully visible under reduced motion.
 */
(function () {
    const LAYER_ID = 'day-boundary-layer';
    const FADE_MINUTES = 30;

    function remove() {
        const el = document.getElementById(LAYER_ID);
        if (el) el.remove();
        document.querySelectorAll('.day-boundary-daylabel').forEach((e) => e.remove());
    }

    // "torsdag" → "Torsdag" in Europe/Stockholm. timelineStart is a real Date
    // on the anchor calendar, so its weekday is authoritative (handles ö/ä).
    function weekdayName(date) {
        const s = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', timeZone: 'Europe/Stockholm' }).format(date);
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    /**
     * @param {Date} timelineStart 00:00 of the displayed day
     * @param {number} pixelsPerHour
     * @param {number} timelineHours rendered span (30)
     */
    function render(timelineStart, pixelsPerHour, timelineHours) {
        const canvas = document.getElementById('timeline-canvas');
        if (!canvas) return;

        let layer = document.getElementById(LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = LAYER_ID;
            canvas.appendChild(layer);
        } else if (layer.parentNode !== canvas) {
            canvas.appendChild(layer);
        }
        layer.innerHTML = '';

        const fadeW = (FADE_MINUTES / 60) * pixelsPerHour;
        const stitched = !!(window.currentStitchInfo && window.currentStitchInfo.stitched);
        const archive = !!(window.currentScheduleSelection && window.currentScheduleSelection.archive);

        // Midnight hour offsets within the view. Archive mode spans a whole week
        // so it marks every midnight; the live 30h view marks hour 24 only when
        // tomorrow is stitched in (otherwise the inactive region owns that edge).
        const midnights = [0];
        if (archive) {
            for (let h = 24; h < timelineHours; h += 24) midnights.push(h);
        } else if (timelineHours > 24 && stitched) {
            midnights.push(24);
        }

        midnights.forEach((hour) => {
            const mark = document.createElement('div');
            mark.className = 'day-boundary-mark';
            mark.style.left = `${hour * pixelsPerHour}px`;
            mark.style.width = `${fadeW}px`;
            layer.appendChild(mark);
        });

        // Weekday labels in the clock row, flanking each separator line:
        // the day ending (left) and the day beginning (right).
        const hoursEl = document.getElementById('timeline-hours');
        if (!hoursEl) return;
        hoursEl.querySelectorAll('.day-boundary-daylabel').forEach((e) => e.remove());

        midnights.forEach((hour) => {
            const x = hour * pixelsPerHour;
            const lineDate = new Date(timelineStart.getTime() + hour * 3600000);

            const right = document.createElement('div');
            right.className = 'day-boundary-daylabel day-boundary-daylabel--right';
            right.style.left = `${x}px`;
            right.textContent = weekdayName(lineDate); // day that begins here
            hoursEl.appendChild(right);

            // Left label only when there's room before the line (skips the
            // hour-0 separator, which sits at the very left edge).
            if (x >= 72) {
                const left = document.createElement('div');
                left.className = 'day-boundary-daylabel day-boundary-daylabel--left';
                left.style.left = `${x}px`;
                left.textContent = weekdayName(new Date(lineDate.getTime() - 86400000)); // day that ends here
                hoursEl.appendChild(left);
            }
        });
    }

    window.DayBoundaryRenderer = { render, remove };
})();
