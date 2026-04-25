/**
 * Train Notes Decorator
 *
 * Listens to `schedule:rendered` and `train-notes-changed` events and
 * applies a small note badge + `data-has-note` attribute to every
 * `.train-bar` whose ID has a stored note.
 *
 * Pure presentation; never mutates the underlying train data.
 */
(function () {
    'use strict';

    const BADGE_CLASS = 'train-bar__note-badge';

    function getCanvas() {
        return document.getElementById('timeline-canvas');
    }

    function decorateBar(bar) {
        if (!bar) return;
        const id = bar.dataset.trainId;
        if (!id || !window.TrainNotesStore) return;

        const meta = window.TrainNotesStore.getMeta(id);
        const existingBadge = bar.querySelector(`.${BADGE_CLASS}`);

        if (meta && meta.text) {
            bar.dataset.hasNote = 'true';
            bar.setAttribute('data-note-preview', meta.text.slice(0, 80));
            if (!existingBadge) {
                const badge = document.createElement('span');
                badge.className = BADGE_CLASS;
                badge.setAttribute('aria-hidden', 'true');
                badge.title = 'Anteckning';
                badge.textContent = '✎';
                bar.appendChild(badge);
            }
        } else {
            bar.removeAttribute('data-has-note');
            bar.removeAttribute('data-note-preview');
            if (existingBadge) existingBadge.remove();
        }
    }

    function decorateAll() {
        const canvas = getCanvas();
        if (!canvas) return;
        const bars = canvas.querySelectorAll('.train-bar');
        bars.forEach(decorateBar);
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
        if (!window.TrainNotesStore) return;
        window.addEventListener('schedule:rendered', decorateAll);
        window.addEventListener('train-notes-changed', (e) => {
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
