/**
 * Inactive Region Renderer - marks the part of the timeline that has no
 * schedule data (next day's PDF not uploaded yet, e.g. Sunday evening before
 * the new week is ingested).
 *
 * The graph "tears off" at 24:00 — jagged torn-paper edge (same visual
 * language as the split-bar feature) — and the region beyond is abruptly
 * dimmed and hatched with a centered "Vecka NN har inte laddats upp ännu"
 * label. Purely static styling: stays fully visible under reduced motion.
 */
(function () {
    const REGION_ID = 'inactive-region';

    function remove() {
        const el = document.getElementById(REGION_ID);
        if (el) el.remove();
    }

    /**
     * @param {Date} timelineStart - 00:00 of the schedule day
     * @param {number} pixelsPerHour
     * @param {number} timelineHours - rendered span (30)
     */
    function render(timelineStart, pixelsPerHour, timelineHours) {
        const info = window.currentStitchInfo;
        const canvas = document.getElementById('timeline-canvas');
        if (!canvas) return;

        // Stitched (tomorrow exists) or stitching not applicable → no overlay.
        if (!info || info.stitched) { remove(); return; }

        const startHour = 24; // data ends where today's page ends
        if (timelineHours <= startHour) { remove(); return; }

        let el = document.getElementById(REGION_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = REGION_ID;
            el.innerHTML = `
                <div class="inactive-region__label">
                    <div class="inactive-region__title"></div>
                    <div class="inactive-region__subtitle">Tåg efter 24:00 kan saknas i grafen</div>
                </div>`;
            canvas.appendChild(el);
        } else if (el.parentNode !== canvas) {
            // Full re-renders rebuild the canvas content around us.
            canvas.appendChild(el);
        }

        const loadedWeek = (window.currentScheduleSelection && window.currentScheduleSelection.week) || null;
        const title = (info.missingWeekNumber && info.missingWeekKey !== loadedWeek)
            ? `Vecka ${info.missingWeekNumber} har inte laddats upp ännu`
            : 'Nästa dags graf har inte laddats upp ännu';
        el.querySelector('.inactive-region__title').textContent = title;

        el.style.left = `${startHour * pixelsPerHour}px`;
        el.style.width = `${(timelineHours - startHour) * pixelsPerHour}px`;
    }

    window.InactiveRegionRenderer = { render, remove };
})();
