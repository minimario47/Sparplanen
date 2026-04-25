/**
 * Add Closure Modal
 *
 * Pre-fills track / start-time and lets the operator add a temporary
 * track closure that gets persisted via UserClosuresStore and rendered
 * by closure-renderer.js.
 *
 * Public API (window.AddClosureModal):
 *   open(prefill)   → Promise<{ saved: boolean, deleted: boolean, record: any }>
 *     prefill = { editId?, trackId?, subTrackIndex?, startTime?: Date|'HH:MM', endTime?, reason? }
 *   close()         → void
 */
(function () {
    'use strict';

    const STATE = {
        backdrop: null,
        modal: null,
        previousFocus: null,
        resolveFn: null,
        elements: {}
    };

    function fmtHHMM(value) {
        if (!value) return '';
        if (value instanceof Date) {
            const h = String(value.getHours()).padStart(2, '0');
            const m = String(value.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        }
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) return value;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return fmtHHMM(d);
    }

    function ensureDom() {
        if (STATE.backdrop) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'add-closure-modal__backdrop hidden';
        backdrop.setAttribute('aria-hidden', 'true');

        const modal = document.createElement('div');
        modal.className = 'add-closure-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'add-closure-modal-title');
        modal.tabIndex = -1;

        modal.innerHTML = `
            <header class="add-closure-modal__header">
                <h2 id="add-closure-modal-title" class="add-closure-modal__title">Lägg till spåravstängning</h2>
                <button type="button" class="add-closure-modal__close" aria-label="Stäng">✕</button>
            </header>
            <form class="add-closure-modal__body" data-role="form" novalidate>
                <div class="add-closure-modal__grid">
                    <label class="add-closure-modal__field">
                        <span>Spår</span>
                        <select data-field="trackId" required></select>
                    </label>
                    <label class="add-closure-modal__field">
                        <span>Anledning</span>
                        <input type="text" data-field="reason" placeholder="t.ex. Banarbete" maxlength="120">
                    </label>
                    <label class="add-closure-modal__field">
                        <span>Starttid</span>
                        <input type="time" data-field="startTime" required>
                    </label>
                    <label class="add-closure-modal__field">
                        <span>Sluttid</span>
                        <input type="time" data-field="endTime" required>
                    </label>
                </div>
                <p class="add-closure-modal__error" data-role="error" role="alert" hidden></p>
            </form>
            <footer class="add-closure-modal__footer">
                <button type="button" class="add-closure-modal__btn add-closure-modal__btn--ghost" data-action="delete" hidden>Radera</button>
                <div class="add-closure-modal__footer-spacer"></div>
                <button type="button" class="add-closure-modal__btn add-closure-modal__btn--secondary" data-action="cancel">Avbryt</button>
                <button type="button" class="add-closure-modal__btn add-closure-modal__btn--primary" data-action="save">Lägg till</button>
            </footer>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        STATE.backdrop = backdrop;
        STATE.modal = modal;
        STATE.elements.form = modal.querySelector('[data-role="form"]');
        STATE.elements.error = modal.querySelector('[data-role="error"]');
        STATE.elements.fields = {
            trackId: modal.querySelector('[data-field="trackId"]'),
            reason: modal.querySelector('[data-field="reason"]'),
            startTime: modal.querySelector('[data-field="startTime"]'),
            endTime: modal.querySelector('[data-field="endTime"]')
        };

        STATE.elements.saveBtn = modal.querySelector('[data-action="save"]');
        STATE.elements.deleteBtn = modal.querySelector('[data-action="delete"]');
        STATE.elements.titleEl = modal.querySelector('.add-closure-modal__title');

        STATE.elements.saveBtn.addEventListener('click', save);
        STATE.elements.deleteBtn.addEventListener('click', handleDelete);
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ saved: false }));
        modal.querySelector('.add-closure-modal__close').addEventListener('click', () => close({ saved: false }));

        backdrop.addEventListener('mousedown', (e) => {
            STATE.mouseDownOnBackdrop = (e.target === backdrop);
        });
        backdrop.addEventListener('mouseup', (e) => {
            if (STATE.mouseDownOnBackdrop && e.target === backdrop) close({ saved: false });
            STATE.mouseDownOnBackdrop = false;
        });

        document.addEventListener('keydown', (e) => {
            if (!isOpen()) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close({ saved: false });
            } else if (e.key === 'Enter' && (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT')) {
                e.preventDefault();
                save();
            }
        });
    }

    function populateTracks(currentTrackId) {
        const select = STATE.elements.fields.trackId;
        select.innerHTML = '';
        const tracks = Array.isArray(window.cachedTracks) ? window.cachedTracks : [];
        if (!tracks.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Inga spår laddade';
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        tracks.forEach((track) => {
            const option = document.createElement('option');
            option.value = String(track.id);
            option.textContent = track.name || `Spår ${track.id}`;
            select.appendChild(option);
        });
        if (currentTrackId !== undefined && currentTrackId !== null) {
            select.value = String(currentTrackId);
        }
    }

    function isOpen() {
        return STATE.backdrop && !STATE.backdrop.classList.contains('hidden');
    }

    function showError(message) {
        STATE.elements.error.textContent = message || '';
        STATE.elements.error.hidden = !message;
    }

    function open(prefill = {}) {
        ensureDom();
        STATE.previousFocus = document.activeElement;

        let existing = null;
        if (prefill.editId !== undefined && prefill.editId !== null && window.UserClosuresStore) {
            existing = window.UserClosuresStore.get(prefill.editId);
        }
        STATE.editId = existing ? existing.id : null;
        const isEdit = Boolean(existing);

        const source = existing || prefill;

        populateTracks(source.trackId);
        STATE.elements.fields.reason.value = source.reason || '';

        const startStr = fmtHHMM(source.startTime);
        STATE.elements.fields.startTime.value = startStr || '';

        let endStr = fmtHHMM(source.endTime);
        if (!endStr && startStr) {
            const [h, m] = startStr.split(':').map(Number);
            const total = (h * 60) + m + 60;
            const eh = String(Math.floor((total / 60) % 24)).padStart(2, '0');
            const em = String(total % 60).padStart(2, '0');
            endStr = `${eh}:${em}`;
        }
        STATE.elements.fields.endTime.value = endStr || '';

        STATE.elements.titleEl.textContent = isEdit ? 'Redigera spåravstängning' : 'Lägg till spåravstängning';
        STATE.elements.saveBtn.textContent = isEdit ? 'Spara ändringar' : 'Lägg till';
        STATE.elements.deleteBtn.hidden = !isEdit;

        showError('');

        STATE.backdrop.classList.remove('hidden');
        STATE.backdrop.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');

        setTimeout(() => STATE.elements.fields.trackId.focus(), 50);

        return new Promise((resolve) => { STATE.resolveFn = resolve; });
    }

    function close(result) {
        if (!STATE.backdrop) return;
        STATE.backdrop.classList.add('hidden');
        STATE.backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        STATE.editId = null;
        if (STATE.previousFocus?.focus) {
            try { STATE.previousFocus.focus(); } catch (_) {}
        }
        const resolve = STATE.resolveFn;
        STATE.resolveFn = null;
        if (resolve) resolve(result || { saved: false });
    }

    function timeToMinutes(value) {
        if (!value) return null;
        const [h, m] = String(value).split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
    }

    function save() {
        const fields = STATE.elements.fields;
        const trackId = parseInt(fields.trackId.value, 10);
        const startTime = fields.startTime.value;
        const endTime = fields.endTime.value;
        const reason = fields.reason.value.trim();

        if (!Number.isFinite(trackId)) return showError('Välj ett spår.');
        if (!startTime) return showError('Ange en starttid.');
        if (!endTime) return showError('Ange en sluttid.');

        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);
        if (startMin === null || endMin === null) return showError('Felaktigt tidsformat.');
        if (endMin <= startMin) return showError('Sluttid måste vara efter starttid.');

        if (!window.UserClosuresStore) return showError('Lagring saknas.');

        const payload = {
            trackId,
            startTime,
            endTime,
            reason: reason || 'Spår avstängt'
        };

        let record;
        const isEdit = STATE.editId !== null && STATE.editId !== undefined;
        if (isEdit) {
            record = window.UserClosuresStore.update(STATE.editId, payload);
            if (!record) return showError('Avstängningen kunde inte hittas.');
        } else {
            record = window.UserClosuresStore.add(payload);
        }

        if (window.showNotification) {
            const verb = isEdit ? 'uppdaterad' : 'tillagd';
            window.showNotification(`Avstängning ${verb} på spår ${trackId} (${startTime}–${endTime})`, 'success');
        }
        close({ saved: true, record });
    }

    function handleDelete() {
        if (STATE.editId === null || STATE.editId === undefined) return;
        if (!window.UserClosuresStore) return;
        const record = window.UserClosuresStore.get(STATE.editId);
        if (!window.confirm('Vill du verkligen radera den här avstängningen?')) return;
        window.UserClosuresStore.remove(STATE.editId);
        if (window.showNotification) {
            window.showNotification('Avstängning raderad', 'info');
        }
        close({ saved: true, deleted: true, record });
    }

    window.AddClosureModal = { open, close: () => close({ saved: false }) };
})();
