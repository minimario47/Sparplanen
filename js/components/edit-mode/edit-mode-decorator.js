/**
 * Edit Mode Decorator
 *
 * Listens to `schedule:rendered` and stamps edit-state classes onto each
 * `.train-bar` from flags the projection set on its train record:
 *   • `_edited`         → `.is-edited`  (committed manual edit: left accent rail)
 *   • `_draft`          → `.is-draft`   (uncommitted this session: dashed outline)
 *   • `_liveDisagrees`  → a small chip: the live feed reports a different track
 *                          than where the controller placed the bar.
 *
 * Pure presentation; never mutates train data. The projection owns the flags;
 * this only reflects them in the DOM after every render.
 */
(function () {
    'use strict';

    const CHIP_CLASS = 'train-bar__live-chip';

    function getCanvas() { return document.getElementById('timeline-canvas'); }

    function trainFromId(id) {
        if (!Array.isArray(window.cachedTrains)) return null;
        return window.cachedTrains.find((t) => String(t.id) === String(id)) || null;
    }

    function decorateBar(bar) {
        if (!bar) return;
        const train = trainFromId(bar.dataset.trainId);
        if (!train) return;

        bar.classList.toggle('is-edited', train._edited === true);
        bar.classList.toggle('is-draft', train._draft === true);

        const existing = bar.querySelector(`.${CHIP_CLASS}`);
        if (train._liveDisagrees === true) {
            bar.dataset.liveDisagrees = 'true';
            if (!existing) {
                const chip = document.createElement('span');
                chip.className = CHIP_CLASS;
                chip.setAttribute('aria-hidden', 'true');
                chip.title = 'Live rapporterar ett annat spår än den manuella placeringen';
                chip.textContent = '⚡';
                bar.appendChild(chip);
            }
        } else {
            bar.removeAttribute('data-live-disagrees');
            if (existing) existing.remove();
        }
    }

    function decorateAll() {
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.querySelectorAll('.train-bar').forEach(decorateBar);
    }

    function init() {
        window.addEventListener('schedule:rendered', decorateAll);
        decorateAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
