/**
 * Add Train Modal
 *
 * Operator-side form for inserting a train (or shunting movement) at a
 * specific track and time. Persists via UserTrainsStore which is then
 * merged into `window.cachedTrains` by schedule-renderer.
 *
 * Public API (window.AddTrainModal):
 *   open(prefill)   → Promise<{ saved: boolean, deleted: boolean, record: any }>
 *     prefill = {
 *       editId?,                 // when set, modal acts as "edit existing"
 *       trackId?, startTime?: Date|'HH:MM',
 *       arrivalTrainNumber?, departureTrainNumber?, kind?
 *     }
 *   close()         → void
 */
(function () {
    'use strict';

    const STATE = {
        backdrop: null,
        modal: null,
        previousFocus: null,
        resolveFn: null,
        mouseDownOnBackdrop: false,
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
        backdrop.className = 'add-train-modal__backdrop hidden';
        backdrop.setAttribute('aria-hidden', 'true');

        const modal = document.createElement('div');
        modal.className = 'add-train-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'add-train-modal-title');
        modal.tabIndex = -1;

        modal.innerHTML = `
            <header class="add-train-modal__header">
                <h2 id="add-train-modal-title" class="add-train-modal__title">Lägg till tåg</h2>
                <button type="button" class="add-train-modal__close" aria-label="Stäng">✕</button>
            </header>
            <div class="add-train-modal__body" data-role="form">
                <div class="add-train-modal__tabs" role="tablist">
                    <button type="button" class="add-train-modal__tab is-active" role="tab" data-kind="train">Tåg</button>
                    <button type="button" class="add-train-modal__tab" role="tab" data-kind="shunting">Växling</button>
                </div>

                <fieldset class="add-train-modal__fieldset">
                    <legend>Identitet</legend>
                    <div class="add-train-modal__grid add-train-modal__grid--two">
                        <label class="add-train-modal__field">
                            <span>Ankomsttågnr</span>
                            <input type="text" data-field="arrivalTrainNumber" inputmode="numeric" maxlength="8" placeholder="t.ex. 12345">
                        </label>
                        <label class="add-train-modal__field">
                            <span>Avgångstågnr</span>
                            <input type="text" data-field="departureTrainNumber" inputmode="numeric" maxlength="8" placeholder="t.ex. 12346">
                        </label>
                    </div>
                </fieldset>

                <fieldset class="add-train-modal__fieldset">
                    <legend>Tider och spår</legend>
                    <div class="add-train-modal__grid add-train-modal__grid--three">
                        <label class="add-train-modal__field">
                            <span>Spår</span>
                            <select data-field="trackId" required></select>
                        </label>
                        <label class="add-train-modal__field">
                            <span>Ankomst</span>
                            <input type="time" data-field="scheduledArrivalTime">
                        </label>
                        <label class="add-train-modal__field">
                            <span>Avgång</span>
                            <input type="time" data-field="scheduledDepartureTime">
                        </label>
                    </div>
                </fieldset>

                <fieldset class="add-train-modal__fieldset">
                    <legend>Rutt</legend>
                    <div class="add-train-modal__grid add-train-modal__grid--two">
                        <label class="add-train-modal__field">
                            <span>Från</span>
                            <input type="text" data-field="origin" maxlength="80" placeholder="t.ex. Stockholm C">
                        </label>
                        <label class="add-train-modal__field">
                            <span>Till</span>
                            <input type="text" data-field="destination" maxlength="80" placeholder="t.ex. Göteborg C">
                        </label>
                    </div>
                </fieldset>

                <fieldset class="add-train-modal__fieldset">
                    <legend>Fordon</legend>
                    <div class="add-train-modal__grid add-train-modal__grid--two">
                        <label class="add-train-modal__field">
                            <span>Fordonstyp</span>
                            <select data-field="vehicleTypeID"></select>
                        </label>
                        <label class="add-train-modal__field">
                            <span>Antal enheter</span>
                            <input type="number" data-field="vehicleCount" min="1" max="6" value="1">
                        </label>
                    </div>
                </fieldset>

                <p class="add-train-modal__error" data-role="error" role="alert" hidden></p>
            </div>
            <footer class="add-train-modal__footer">
                <button type="button" class="add-train-modal__btn add-train-modal__btn--ghost" data-action="delete" hidden>Radera</button>
                <div class="add-train-modal__footer-spacer"></div>
                <button type="button" class="add-train-modal__btn add-train-modal__btn--secondary" data-action="cancel">Avbryt</button>
                <button type="button" class="add-train-modal__btn add-train-modal__btn--primary" data-action="save">Lägg till</button>
            </footer>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        STATE.backdrop = backdrop;
        STATE.modal = modal;
        STATE.elements.error = modal.querySelector('[data-role="error"]');
        STATE.elements.tabs = modal.querySelectorAll('.add-train-modal__tab');
        STATE.elements.fields = {
            arrivalTrainNumber: modal.querySelector('[data-field="arrivalTrainNumber"]'),
            departureTrainNumber: modal.querySelector('[data-field="departureTrainNumber"]'),
            trackId: modal.querySelector('[data-field="trackId"]'),
            scheduledArrivalTime: modal.querySelector('[data-field="scheduledArrivalTime"]'),
            scheduledDepartureTime: modal.querySelector('[data-field="scheduledDepartureTime"]'),
            origin: modal.querySelector('[data-field="origin"]'),
            destination: modal.querySelector('[data-field="destination"]'),
            vehicleTypeID: modal.querySelector('[data-field="vehicleTypeID"]'),
            vehicleCount: modal.querySelector('[data-field="vehicleCount"]')
        };

        STATE.elements.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                STATE.elements.tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
                STATE.elements.kind = tab.dataset.kind;
                applyKindStyling();
            });
        });

        STATE.elements.deleteBtn = modal.querySelector('[data-action="delete"]');
        STATE.elements.saveBtn = modal.querySelector('[data-action="save"]');

        STATE.elements.saveBtn.addEventListener('click', save);
        STATE.elements.deleteBtn.addEventListener('click', handleDelete);
        modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ saved: false }));
        modal.querySelector('.add-train-modal__close').addEventListener('click', () => close({ saved: false }));

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
            }
        });
    }

    function applyKindStyling() {
        const isShunting = STATE.elements.kind === 'shunting';
        const isEdit = Boolean(STATE.editId);
        STATE.modal.classList.toggle('is-shunting', isShunting);
        const title = STATE.modal.querySelector('.add-train-modal__title');
        if (title) {
            if (isEdit) {
                title.textContent = isShunting ? 'Redigera växlingsrörelse' : 'Redigera tåg';
            } else {
                title.textContent = isShunting ? 'Lägg till växlingsrörelse' : 'Lägg till tåg';
            }
        }
        if (STATE.elements.saveBtn) {
            STATE.elements.saveBtn.textContent = isEdit ? 'Spara ändringar' : 'Lägg till';
        }
        if (STATE.elements.deleteBtn) {
            STATE.elements.deleteBtn.hidden = !isEdit;
        }
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

    function populateVehicleTypes() {
        const select = STATE.elements.fields.vehicleTypeID;
        select.innerHTML = '';
        const defs = (typeof vehicleDefinitions !== 'undefined') ? vehicleDefinitions : null;
        const fallback = document.createElement('option');
        fallback.value = '';
        fallback.textContent = '— Ej angivet —';
        select.appendChild(fallback);
        if (!defs) return;
        Object.entries(defs).forEach(([id, def]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${def.name || id} (${def.baseLengthMeters}m)`;
            select.appendChild(option);
        });
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
        if (prefill.editId !== undefined && prefill.editId !== null && window.UserTrainsStore) {
            existing = window.UserTrainsStore.get(prefill.editId);
        }
        STATE.editId = existing ? existing.id : null;

        const source = existing
            ? { ...existing, startTime: existing.scheduledArrivalTime || existing.scheduledDepartureTime }
            : prefill;

        STATE.elements.kind = source.kind === 'shunting' ? 'shunting' : 'train';

        STATE.elements.tabs.forEach((tab) => {
            tab.classList.toggle('is-active', tab.dataset.kind === STATE.elements.kind);
        });
        applyKindStyling();

        populateTracks(source.trackId);
        populateVehicleTypes();

        const fields = STATE.elements.fields;
        fields.arrivalTrainNumber.value = source.arrivalTrainNumber || '';
        fields.departureTrainNumber.value = source.departureTrainNumber || '';
        fields.origin.value = source.origin || '';
        fields.destination.value = source.destination || '';

        if (existing && existing.trainSet) {
            fields.vehicleTypeID.value = existing.trainSet.vehicleTypeID || '';
            fields.vehicleCount.value = String(existing.trainSet.count || 1);
        } else {
            fields.vehicleTypeID.value = '';
            fields.vehicleCount.value = '1';
        }

        if (existing) {
            fields.scheduledArrivalTime.value = existing.scheduledArrivalTime || '';
            fields.scheduledDepartureTime.value = existing.scheduledDepartureTime || '';
        } else {
            const startStr = fmtHHMM(source.startTime);
            const offset = STATE.elements.kind === 'shunting' ? 10 : 5;
            fields.scheduledArrivalTime.value = startStr || '';
            if (startStr) {
                const [h, m] = startStr.split(':').map(Number);
                const total = (h * 60) + m + offset;
                const eh = String(Math.floor((total / 60) % 24)).padStart(2, '0');
                const em = String(total % 60).padStart(2, '0');
                fields.scheduledDepartureTime.value = `${eh}:${em}`;
            } else {
                fields.scheduledDepartureTime.value = '';
            }
        }

        showError('');

        STATE.backdrop.classList.remove('hidden');
        STATE.backdrop.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');

        setTimeout(() => fields.arrivalTrainNumber.focus(), 50);

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

    function save() {
        const fields = STATE.elements.fields;
        const trackId = parseInt(fields.trackId.value, 10);
        const arrivalTrainNumber = fields.arrivalTrainNumber.value.trim();
        const departureTrainNumber = fields.departureTrainNumber.value.trim();
        const arrTime = fields.scheduledArrivalTime.value || null;
        const depTime = fields.scheduledDepartureTime.value || null;
        const origin = fields.origin.value.trim();
        const destination = fields.destination.value.trim();
        const vehicleTypeID = fields.vehicleTypeID.value || '';
        const vehicleCount = Math.max(1, Math.min(6, parseInt(fields.vehicleCount.value, 10) || 1));
        const kind = STATE.elements.kind || 'train';

        if (!Number.isFinite(trackId)) return showError('Välj ett spår.');
        if (!arrTime && !depTime) return showError('Ange minst ankomst- eller avgångstid.');
        if (kind === 'train' && !arrivalTrainNumber && !departureTrainNumber) {
            return showError('Ange minst ett tågnummer.');
        }
        if (arrTime && depTime) {
            const [ah, am] = arrTime.split(':').map(Number);
            const [dh, dm] = depTime.split(':').map(Number);
            const arrMin = ah * 60 + am;
            const depMin = dh * 60 + dm;
            if (Math.abs(depMin - arrMin) > 18 * 60) {
                return showError('Tider är orealistiskt långt isär.');
            }
        }

        if (!window.UserTrainsStore) return showError('Lagring saknas.');

        const trainSet = vehicleTypeID
            ? { vehicleTypeID, count: vehicleCount }
            : null;

        const payload = {
            trackId,
            arrivalTrainNumber,
            departureTrainNumber,
            scheduledArrivalTime: arrTime,
            scheduledDepartureTime: depTime,
            origin,
            destination,
            kind,
            trainSet
        };

        let record;
        const isEdit = STATE.editId !== null && STATE.editId !== undefined;
        if (isEdit) {
            record = window.UserTrainsStore.update(STATE.editId, payload);
            if (!record) return showError('Posten kunde inte hittas.');
        } else {
            record = window.UserTrainsStore.add(payload);
        }

        if (window.showNotification) {
            const label = kind === 'shunting' ? 'Växlingsrörelse' : 'Tåg';
            const verb = isEdit ? 'uppdaterad' : 'tillagd';
            window.showNotification(`${label} ${verb} på spår ${trackId}`, 'success');
        }
        close({ saved: true, record });
    }

    function handleDelete() {
        if (STATE.editId === null || STATE.editId === undefined) return;
        if (!window.UserTrainsStore) return;
        const record = window.UserTrainsStore.get(STATE.editId);
        const label = record?.kind === 'shunting' ? 'växlingsrörelsen' : 'tåget';
        if (!window.confirm(`Vill du verkligen radera ${label}?`)) return;
        window.UserTrainsStore.remove(STATE.editId);
        if (window.showNotification) {
            window.showNotification('Posten raderad', 'info');
        }
        close({ saved: true, deleted: true, record });
    }

    window.AddTrainModal = { open, close: () => close({ saved: false }) };
})();
