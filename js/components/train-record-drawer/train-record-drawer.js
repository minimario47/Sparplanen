/**
 * Train Record Drawer
 *
 * Right-side drawer that shows the full record for a single train from
 * `window.cachedTrains` — useful for operators who want to see every
 * field at once without diving into the tooltip.
 *
 * Public API (window.TrainRecordDrawer):
 *   open(trainId)   → void
 *   close()         → void
 *
 * The drawer is created lazily and reused; data is grouped into sections
 * (Identitet, Tider, Rutt, Fordon, Försening, Anteckningar) and the raw
 * record is collapsed into a `<details>` block at the bottom for
 * power users.
 */
(function () {
    'use strict';

    const STATE = {
        backdrop: null,
        drawer: null,
        body: null,
        titleEl: null,
        currentTrainId: null,
        previousFocus: null,
        unsubscribe: []
    };

    function ensureDom() {
        if (STATE.drawer) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'train-record-drawer__backdrop hidden';
        backdrop.setAttribute('aria-hidden', 'true');

        const drawer = document.createElement('aside');
        drawer.className = 'train-record-drawer hidden';
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'false');
        drawer.setAttribute('aria-labelledby', 'train-record-drawer-title');
        drawer.tabIndex = -1;

        drawer.innerHTML = `
            <header class="train-record-drawer__header">
                <div>
                    <div class="train-record-drawer__eyebrow">Visa i tabell</div>
                    <h2 id="train-record-drawer-title" class="train-record-drawer__title">Tåg</h2>
                </div>
                <button type="button" class="train-record-drawer__close" aria-label="Stäng">✕</button>
            </header>
            <div class="train-record-drawer__body" data-role="body"></div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        STATE.backdrop = backdrop;
        STATE.drawer = drawer;
        STATE.body = drawer.querySelector('[data-role="body"]');
        STATE.titleEl = drawer.querySelector('.train-record-drawer__title');

        backdrop.addEventListener('click', close);
        drawer.querySelector('.train-record-drawer__close').addEventListener('click', close);

        document.addEventListener('keydown', (e) => {
            if (!isOpen()) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
    }

    function isOpen() {
        return STATE.drawer && !STATE.drawer.classList.contains('hidden');
    }

    function fmtTime(value) {
        if (!value) return '–';
        if (value instanceof Date) {
            return value.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        }
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) return value;
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        }
        return String(value);
    }

    function escape(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderRow(label, value, options = {}) {
        if (value === null || value === undefined || value === '') {
            if (!options.showEmpty) return '';
            value = '–';
        }
        const cls = options.mono ? 'train-record-drawer__value train-record-drawer__value--mono' : 'train-record-drawer__value';
        return `
            <div class="train-record-drawer__row">
                <span class="train-record-drawer__label">${escape(label)}</span>
                <span class="${cls}">${escape(value)}</span>
            </div>
        `;
    }

    function renderSection(title, rows) {
        const filled = rows.filter(Boolean);
        if (!filled.length) return '';
        return `
            <section class="train-record-drawer__section">
                <h3 class="train-record-drawer__section-title">${escape(title)}</h3>
                <div class="train-record-drawer__rows">${filled.join('')}</div>
            </section>
        `;
    }

    function renderRawSection(train) {
        let json;
        try {
            json = JSON.stringify(train, (key, val) => {
                if (val instanceof Date) return val.toISOString();
                return val;
            }, 2);
        } catch (e) {
            json = '⚠ Kunde inte serialisera record.';
        }
        return `
            <details class="train-record-drawer__raw">
                <summary>Rådata (JSON)</summary>
                <pre class="train-record-drawer__pre"><code>${escape(json)}</code></pre>
            </details>
        `;
    }

    function getDelayInfoFor(train) {
        try {
            const dm = window.delayIntegration?.dataManager;
            if (!dm || !train) return null;
            const arr = train.arrivalTrainNumber ? dm.getDelayInfo(train.arrivalTrainNumber) : null;
            const dep = train.departureTrainNumber ? dm.getDelayInfo(train.departureTrainNumber) : null;
            return arr || dep || null;
        } catch (_) { return null; }
    }

    function renderForTrain(train) {
        if (!STATE.body) return;
        if (!train) {
            STATE.body.innerHTML = `<div class="train-record-drawer__empty">Tåget hittades inte.</div>`;
            return;
        }

        const number = train.arrivalTrainNumber || train.departureTrainNumber || '';
        STATE.titleEl.textContent = number ? `Tåg ${number}` : `ID ${train.id}`;

        const note = window.TrainNotesStore ? window.TrainNotesStore.getMeta(train.id) : null;
        const checked = window.TrainChecksStore ? window.TrainChecksStore.isChecked(train.id) : false;
        const checkMeta = checked && window.TrainChecksStore ? window.TrainChecksStore.getMeta(train.id) : null;
        const delay = getDelayInfoFor(train);

        const sections = [
            renderSection('Identitet', [
                renderRow('Intern ID', train.id, { mono: true }),
                renderRow('Ankomsttågnr', train.arrivalTrainNumber, { showEmpty: true }),
                renderRow('Avgångstågnr', train.departureTrainNumber, { showEmpty: true }),
                renderRow('Typ', train.type, { showEmpty: true }),
                renderRow('Användartillagd', train.userAdded ? 'Ja' : 'Nej', { showEmpty: true })
            ]),
            renderSection('Tider', [
                renderRow('Ankomst', fmtTime(train.arrTime), { showEmpty: true }),
                renderRow('Avgång', fmtTime(train.depTime), { showEmpty: true }),
                renderRow('Spår', train.trackId, { showEmpty: true }),
                renderRow('Status', train.status, { showEmpty: true }),
                renderRow('Konflikt', train.hasConflict ? 'Ja' : 'Nej')
            ]),
            renderSection('Rutt', [
                renderRow('Ursprung', train.origin),
                renderRow('Destination', train.dest),
                renderRow('Kopplad till', train.connectedTo)
            ]),
            renderSection('Fordon', [
                renderRow('Längd (m)', train.lengthMeters, { showEmpty: true }),
                renderRow('Längdklass', train.lengthClass)
            ])
        ];

        if (delay) {
            sections.push(renderSection('Försening', [
                renderRow('Försening (min)', Number.isFinite(delay.delayMinutes) ? delay.delayMinutes : '–', { showEmpty: true }),
                renderRow('Inställt', delay.isCanceled ? 'Ja' : 'Nej'),
                renderRow('Ersatt', delay.isReplaced ? 'Ja' : 'Nej'),
                renderRow('Källa', delay.source)
            ]));
        }

        sections.push(renderSection('Anteckningar', [
            renderRow('Anteckning', note?.text || '', { showEmpty: true }),
            note?.updatedAt ? renderRow('Uppdaterad', new Date(note.updatedAt).toLocaleString('sv-SE')) : '',
            renderRow('Kontrollerad', checked ? 'Ja' : 'Nej'),
            checkMeta?.checkedAt ? renderRow('Kontrollerad vid', new Date(checkMeta.checkedAt).toLocaleString('sv-SE')) : ''
        ]));

        STATE.body.innerHTML = sections.join('') + renderRawSection(train);
    }

    function rerender() {
        if (STATE.currentTrainId === null || STATE.currentTrainId === undefined) return;
        const train = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.find((t) => String(t.id) === String(STATE.currentTrainId))
            : null;
        renderForTrain(train);
    }

    function attachLiveListeners() {
        const handler = () => rerender();
        window.addEventListener('train-notes-changed', handler);
        window.addEventListener('train-checks-changed', handler);
        window.addEventListener('schedule:rendered', handler);
        STATE.unsubscribe.push(() => {
            window.removeEventListener('train-notes-changed', handler);
            window.removeEventListener('train-checks-changed', handler);
            window.removeEventListener('schedule:rendered', handler);
        });
    }

    function detachLiveListeners() {
        STATE.unsubscribe.forEach((fn) => { try { fn(); } catch (_) {} });
        STATE.unsubscribe = [];
    }

    function open(trainId) {
        ensureDom();
        STATE.currentTrainId = trainId;
        STATE.previousFocus = document.activeElement;

        const train = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.find((t) => String(t.id) === String(trainId))
            : null;
        renderForTrain(train);

        STATE.backdrop.classList.remove('hidden');
        STATE.drawer.classList.remove('hidden');
        STATE.backdrop.removeAttribute('aria-hidden');
        document.body.classList.add('train-record-drawer-open');

        attachLiveListeners();

        setTimeout(() => STATE.drawer.focus(), 80);
    }

    function close() {
        if (!STATE.drawer) return;
        STATE.drawer.classList.add('hidden');
        STATE.backdrop.classList.add('hidden');
        STATE.backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('train-record-drawer-open');
        detachLiveListeners();
        STATE.currentTrainId = null;
        if (STATE.previousFocus && typeof STATE.previousFocus.focus === 'function') {
            try { STATE.previousFocus.focus(); } catch (_) { /* ignore */ }
        }
    }

    window.TrainRecordDrawer = { open, close };
})();
