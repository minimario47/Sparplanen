/**
 * Edit Mode — context-menu twin "Flytta till spår…".
 *
 * Registers a re-track entry on the train context menu (available regardless of
 * edit mode) and renders a small track-picker popover. Picking a track commits
 * a one-op `retrack` directly via EditModeInteractions.retrack(..., {commitNow})
 * — the discrete, complete action doesn't need a bounded edit session.
 *
 * This is the WCAG-friendly twin of the drag/keyboard paths: same op, same
 * projection, same live-truce side effects.
 */
(function () {
    'use strict';

    let picker = null;

    function orderedTracks() {
        const st = window.scheduleState;
        if (!st || !Array.isArray(st.trackLayouts)) return [];
        return st.trackLayouts.map((l) => l.id).filter((id) => id != null);
    }

    function closePicker() {
        if (picker && picker.parentNode) picker.parentNode.removeChild(picker);
        picker = null;
        document.removeEventListener('click', onDocClick, true);
        document.removeEventListener('keydown', onPickerKey, true);
    }

    function onDocClick(e) {
        if (picker && !picker.contains(e.target)) closePicker();
    }
    function onPickerKey(e) {
        if (!picker) return;
        if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
        const items = Array.from(picker.querySelectorAll('.edit-track-picker__item'));
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1 + items.length) % items.length || 0].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    }

    function openPicker(train, anchorRect) {
        closePicker();
        const tracks = orderedTracks();
        if (!tracks.length) return;

        picker = document.createElement('div');
        picker.className = 'edit-track-picker';
        picker.setAttribute('role', 'menu');
        picker.setAttribute('aria-label', 'Flytta till spår');

        const head = document.createElement('div');
        head.className = 'edit-track-picker__head';
        head.textContent = 'Flytta till spår';
        picker.appendChild(head);

        const cur = parseInt(train.trackId, 10);
        tracks.forEach((id) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'edit-track-picker__item';
            btn.setAttribute('role', 'menuitem');
            btn.textContent = `Spår ${id}`;
            if (id === cur) btn.classList.add('is-current');
            btn.addEventListener('click', () => {
                closePicker();
                if (window.EditModeInteractions && typeof window.EditModeInteractions.retrack === 'function') {
                    window.EditModeInteractions.retrack(train, { trackId: id, subTrackIndex: 0 }, { commitNow: true });
                }
            });
            picker.appendChild(btn);
        });

        document.body.appendChild(picker);
        // Position near the bar, clamped to the viewport.
        const margin = 8;
        const rect = picker.getBoundingClientRect();
        let left = anchorRect ? anchorRect.left : margin;
        let top = anchorRect ? anchorRect.bottom + 4 : margin;
        left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - rect.width - margin));
        top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - rect.height - margin));
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;

        const first = picker.querySelector('.edit-track-picker__item');
        if (first) setTimeout(() => first.focus(), 0);
        setTimeout(() => {
            document.addEventListener('click', onDocClick, true);
            document.addEventListener('keydown', onPickerKey, true);
        }, 0);
    }

    function ready() {
        if (!window.TrainContextMenu || typeof window.TrainContextMenu.register !== 'function') {
            console.warn('[edit-mode-context] TrainContextMenu not ready');
            return;
        }
        const { register, createItem } = window.TrainContextMenu;
        register({
            id: 'edits.retrack',
            order: 250,
            build: (train, ctx) => {
                if (!train) return null;
                const anchor = ctx && ctx.trainBar ? ctx.trainBar.getBoundingClientRect() : null;
                return createItem('Flytta till spår…', () => openPicker(train, anchor), { icon: '⇅' });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
