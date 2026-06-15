/**
 * Edit Mode Decorator
 *
 * Listens to `schedule:rendered` and stamps edit-state classes onto each
 * `.train-bar` from flags the projection set on its train record:
 *   • `_edited`         → `.is-edited`  (committed manual edit: left accent rail)
 *   • `_draft`          → `.is-draft`   (uncommitted this session: dashed outline)
 *   • `_inverted`       → `.is-inverted` + a warn chip: a re-time pushed the
 *                          departure at/before the arrival (allowed — soft-warn).
 *   • `_liveDisagrees`  → a small chip: the live feed reports a different track
 *                          than where the controller placed the bar.
 * In edit mode it also injects the two re-time EDGE handles (left = arrival,
 * right = departure) on bars that have the corresponding time.
 *
 * Pure presentation; never mutates train data. The projection owns the flags;
 * this only reflects them in the DOM after every render.
 */
(function () {
    'use strict';

    const CHIP_CLASS = 'train-bar__live-chip';
    const WARN_CHIP_CLASS = 'train-bar__warn-chip';
    const HANDLE_CLASS = 'edit-resize-handle';

    function getCanvas() { return document.getElementById('timeline-canvas'); }
    function isEditing() { return document.body.classList.contains('is-editing'); }

    function trainFromId(id) {
        if (!Array.isArray(window.cachedTrains)) return null;
        return window.cachedTrains.find((t) => String(t.id) === String(id)) || null;
    }

    function makeHandle(side) {
        const h = document.createElement('div');
        h.className = `${HANDLE_CLASS} ${HANDLE_CLASS}--${side}`;
        h.setAttribute('aria-hidden', 'true');
        return h;
    }

    // Re-time handles only exist while editing; they're rebuilt each render so
    // they track the bar's current left/width without any geometry math here.
    function syncHandles(bar, train) {
        bar.querySelectorAll(`.${HANDLE_CLASS}`).forEach((el) => el.remove());
        if (!isEditing()) return;
        if (train.arrTime instanceof Date) bar.appendChild(makeHandle('start'));
        if (train.depTime instanceof Date) bar.appendChild(makeHandle('end'));
    }

    function decorateBar(bar) {
        if (!bar) return;
        const train = trainFromId(bar.dataset.trainId);
        if (!train) return;

        bar.classList.toggle('is-edited', train._edited === true);
        bar.classList.toggle('is-draft', train._draft === true);
        bar.classList.toggle('is-inverted', train._inverted === true);

        // Inverted-duration warn chip (soft-warn only — the bar stays visible).
        const warn = bar.querySelector(`.${WARN_CHIP_CLASS}`);
        if (train._inverted === true) {
            if (!warn) {
                const chip = document.createElement('span');
                chip.className = WARN_CHIP_CLASS;
                chip.setAttribute('aria-hidden', 'true');
                chip.title = 'Negativ varaktighet — avgång före ankomst. Kontrollera.';
                chip.textContent = '⚠';
                bar.appendChild(chip);
            }
        } else if (warn) {
            warn.remove();
        }

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

        syncHandles(bar, train);
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
