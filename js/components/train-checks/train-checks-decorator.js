/**
 * Train Checks Decorator
 *
 * Adds a small checkmark badge + `data-checked` attribute on every
 * `.train-bar` whose ID is in TrainChecksStore. Re-runs on
 * `schedule:rendered` and `train-checks-changed`.
 */
(function () {
    'use strict';

    const BADGE_CLASS = 'train-bar__check-badge';

    function getCanvas() {
        return document.getElementById('timeline-canvas');
    }

    function decorateBar(bar) {
        if (!bar) return;
        const id = bar.dataset.trainId;
        if (!id || !window.TrainChecksStore) return;

        const checked = window.TrainChecksStore.isChecked(id);
        const existingBadge = bar.querySelector(`.${BADGE_CLASS}`);

        if (checked) {
            bar.dataset.checked = 'true';
            if (!existingBadge) {
                const badge = document.createElement('span');
                badge.className = BADGE_CLASS;
                badge.setAttribute('aria-hidden', 'true');
                badge.title = 'Kontrollerad';
                badge.textContent = '✓';
                bar.appendChild(badge);
            }
        } else {
            bar.removeAttribute('data-checked');
            if (existingBadge) existingBadge.remove();
        }
    }

    function decorateAll() {
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.querySelectorAll('.train-bar').forEach(decorateBar);
    }

    function decorateById(id) {
        const canvas = getCanvas();
        if (!canvas || id === undefined || id === null) {
            decorateAll();
            return;
        }
        const bar = canvas.querySelector(`.train-bar[data-train-id="${CSS.escape(String(id))}"]`);
        if (bar) decorateBar(bar);
    }

    function init() {
        if (!window.TrainChecksStore) return;
        window.addEventListener('schedule:rendered', decorateAll);
        window.addEventListener('train-checks-changed', (e) => {
            const id = e?.detail?.id;
            if (id !== undefined && id !== null) decorateById(id);
            else decorateAll();
        });
        decorateAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
