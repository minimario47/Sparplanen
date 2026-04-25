/**
 * Train Note Modal
 *
 * Lightweight modal for editing the free-text note attached to a single
 * train via TrainNotesStore.
 *
 * Public API (window.TrainNoteModal):
 *   open(trainId)   → Promise<{ saved: boolean, text: string }>
 *   close()         → void
 *
 * Behaviour:
 *   - Lazy DOM: created on first open(), reused thereafter.
 *   - Keyboard: Escape closes, Cmd/Ctrl+Enter saves.
 *   - Backdrop click closes (with mousedown/mouseup origin guard).
 *   - Persists via window.TrainNotesStore.set(id, text).
 *   - Notifies via window.showNotification when available.
 */
(function () {
    'use strict';

    const STATE = {
        backdrop: null,
        modal: null,
        textarea: null,
        counter: null,
        saveBtn: null,
        deleteBtn: null,
        titleEl: null,
        currentTrainId: null,
        previousFocus: null,
        mouseDownOnBackdrop: false,
        resolveFn: null
    };

    const MAX_LEN = (window.TrainNotesStore && window.TrainNotesStore.MAX_LENGTH) || 500;

    function trainLabel(train) {
        if (!train) return '';
        const num = train.arrivalTrainNumber || train.departureTrainNumber || '';
        const track = train.trackId ? `Spår ${train.trackId}` : '';
        return [num ? `Tåg ${num}` : '', track].filter(Boolean).join(' · ');
    }

    function ensureDom() {
        if (STATE.backdrop) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'train-note-modal__backdrop hidden';
        backdrop.setAttribute('aria-hidden', 'true');

        const modal = document.createElement('div');
        modal.className = 'train-note-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'train-note-modal-title');
        modal.tabIndex = -1;

        modal.innerHTML = `
            <header class="train-note-modal__header">
                <div>
                    <h2 id="train-note-modal-title" class="train-note-modal__title">Anteckning</h2>
                    <div class="train-note-modal__subtitle"></div>
                </div>
                <button type="button" class="train-note-modal__close" aria-label="Stäng">✕</button>
            </header>
            <div class="train-note-modal__body">
                <textarea
                    id="train-note-modal-textarea"
                    class="train-note-modal__textarea"
                    rows="6"
                    maxlength="${MAX_LEN}"
                    placeholder="Skriv en kort kommentar om tåget…"
                ></textarea>
                <div class="train-note-modal__meta">
                    <span class="train-note-modal__hint">Ctrl/⌘ + Enter för att spara</span>
                    <span class="train-note-modal__counter" aria-live="polite">0 / ${MAX_LEN}</span>
                </div>
            </div>
            <footer class="train-note-modal__footer">
                <button type="button" class="train-note-modal__btn train-note-modal__btn--ghost" data-action="delete">Radera</button>
                <div class="train-note-modal__footer-spacer"></div>
                <button type="button" class="train-note-modal__btn train-note-modal__btn--secondary" data-action="cancel">Avbryt</button>
                <button type="button" class="train-note-modal__btn train-note-modal__btn--primary" data-action="save">Spara</button>
            </footer>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        STATE.backdrop = backdrop;
        STATE.modal = modal;
        STATE.textarea = modal.querySelector('.train-note-modal__textarea');
        STATE.counter = modal.querySelector('.train-note-modal__counter');
        STATE.titleEl = modal.querySelector('.train-note-modal__subtitle');
        STATE.saveBtn = modal.querySelector('[data-action="save"]');
        STATE.deleteBtn = modal.querySelector('[data-action="delete"]');

        STATE.textarea.addEventListener('input', () => updateCounter());
        STATE.textarea.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
            }
        });

        STATE.saveBtn.addEventListener('click', handleSave);
        STATE.deleteBtn.addEventListener('click', handleDelete);
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ saved: false }));
        modal.querySelector('.train-note-modal__close').addEventListener('click', () => close({ saved: false }));

        backdrop.addEventListener('mousedown', (e) => {
            STATE.mouseDownOnBackdrop = (e.target === backdrop);
        });
        backdrop.addEventListener('mouseup', (e) => {
            if (STATE.mouseDownOnBackdrop && e.target === backdrop) {
                close({ saved: false });
            }
            STATE.mouseDownOnBackdrop = false;
        });

        document.addEventListener('keydown', (e) => {
            if (!isOpen()) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close({ saved: false });
            } else if (e.key === 'Tab') {
                trapFocus(e);
            }
        });
    }

    function trapFocus(e) {
        const focusables = STATE.modal.querySelectorAll('button, textarea');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function updateCounter() {
        const len = STATE.textarea.value.length;
        STATE.counter.textContent = `${len} / ${MAX_LEN}`;
        STATE.counter.classList.toggle('is-warning', len > MAX_LEN * 0.9);
    }

    function isOpen() {
        return STATE.backdrop && !STATE.backdrop.classList.contains('hidden');
    }

    function open(trainId) {
        ensureDom();
        STATE.currentTrainId = trainId;
        STATE.previousFocus = document.activeElement;

        const train = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.find((t) => String(t.id) === String(trainId))
            : null;
        STATE.titleEl.textContent = trainLabel(train) || `ID ${trainId}`;

        const existing = window.TrainNotesStore?.get(trainId) || '';
        STATE.textarea.value = existing;
        updateCounter();
        STATE.deleteBtn.style.display = existing ? '' : 'none';

        STATE.backdrop.classList.remove('hidden');
        STATE.backdrop.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');

        setTimeout(() => STATE.textarea.focus(), 50);

        return new Promise((resolve) => {
            STATE.resolveFn = resolve;
        });
    }

    function close(result) {
        if (!STATE.backdrop) return;
        STATE.backdrop.classList.add('hidden');
        STATE.backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (STATE.previousFocus && typeof STATE.previousFocus.focus === 'function') {
            try { STATE.previousFocus.focus(); } catch (_) { /* ignore */ }
        }
        const resolve = STATE.resolveFn;
        STATE.resolveFn = null;
        STATE.currentTrainId = null;
        if (resolve) resolve(result || { saved: false });
    }

    function handleSave() {
        if (!window.TrainNotesStore || STATE.currentTrainId === null) return;
        const text = STATE.textarea.value.trim();
        const changed = window.TrainNotesStore.set(STATE.currentTrainId, text);
        if (changed && window.showNotification) {
            window.showNotification(text ? 'Anteckning sparad' : 'Anteckning raderad', 'success');
        }
        close({ saved: true, text });
    }

    function handleDelete() {
        if (!window.TrainNotesStore || STATE.currentTrainId === null) return;
        window.TrainNotesStore.set(STATE.currentTrainId, '');
        if (window.showNotification) {
            window.showNotification('Anteckning raderad', 'info');
        }
        close({ saved: true, text: '' });
    }

    window.TrainNoteModal = { open, close: () => close({ saved: false }) };
})();
