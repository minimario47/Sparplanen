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
    const REATTACH_CHIP_CLASS = 'train-bar__reattach-chip';
    const RETIME_CHIP_CLASS = 'train-bar__retime-chip';
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
    // Which edges are re-timeable is owned by the interactions module's single
    // `retimeableEdges` gate (Phase 5): cut/re-paired products expose only the
    // edge anchored to a real planned time — never a synthetic cut boundary or a
    // re-paired bar's adopted departure.
    function retimeableEdges(train) {
        const I = window.EditModeInteractions;
        if (I && typeof I.retimeableEdges === 'function') return I.retimeableEdges(train);
        return { start: train.arrTime instanceof Date, end: train.depTime instanceof Date };
    }
    function syncHandles(bar, train) {
        bar.querySelectorAll(`.${HANDLE_CLASS}`).forEach((el) => el.remove());
        if (!isEditing()) return;
        const edges = retimeableEdges(train);
        if (edges.start) bar.appendChild(makeHandle('start'));
        if (edges.end) bar.appendChild(makeHandle('end'));
    }

    function decorateBar(bar) {
        if (!bar) return;
        const train = trainFromId(bar.dataset.trainId);
        if (!train) return;

        bar.classList.toggle('is-edited', train._edited === true);
        bar.classList.toggle('is-draft', train._draft === true);
        bar.classList.toggle('is-inverted', train._inverted === true);

        // Manual cut seam (tinted distinctly from the live-API split tear). A
        // time-split half carries the seam on its synthetic-boundary edge.
        bar.classList.toggle('is-edit-cut', train.editDerived === true);
        if (train.editDerived === true) {
            bar.dataset.cutSeam = train.depSynthetic ? 'right' : (train.arrSynthetic ? 'left' : 'none');
        } else {
            bar.removeAttribute('data-cut-seam');
        }

        // Phase-4 attach state: a re-paired turn (adopted a new departure) and a
        // consumed provider (gave its departure away). Both read-only for now.
        bar.classList.toggle('is-reattached', train._repaired === true);
        bar.classList.toggle('is-consumed', train._repairConsumed === true);
        bar.classList.toggle('is-coupled', train._coupled === true);

        // Re-pair chip: the departure number changed, so the live-delay match is
        // re-derived against the adopted number (the truce protects the bar).
        const reChip = bar.querySelector(`.${REATTACH_CHIP_CLASS}`);
        if (train._repaired === true) {
            if (!reChip) {
                const chip = document.createElement('span');
                chip.className = REATTACH_CHIP_CLASS;
                chip.setAttribute('aria-hidden', 'true');
                chip.title = 'Vändning ändrad: förseningsdata omkopplad till nytt avgångståg.';
                chip.textContent = '🔗';
                bar.appendChild(chip);
            }
        } else if (reChip) {
            reChip.remove();
        }

        // Re-time delay-decoupled chip: a re-timed bar sits off its planned slot,
        // so the live-delay match re-derives. Explanatory only (the truce protects
        // the bar). Suppressed when inverted — the ⚠ warn chip already speaks.
        const retimeChip = bar.querySelector(`.${RETIME_CHIP_CLASS}`);
        if (train._retimed === true && train._inverted !== true) {
            if (!retimeChip) {
                const chip = document.createElement('span');
                chip.className = RETIME_CHIP_CLASS;
                chip.setAttribute('aria-hidden', 'true');
                chip.title = 'Tid ändrad.';
                chip.textContent = '⏱';
                bar.appendChild(chip);
            }
        } else if (retimeChip) {
            retimeChip.remove();
        }

        // Inverted-duration warn chip (soft-warn only — the bar stays visible).
        const warn = bar.querySelector(`.${WARN_CHIP_CLASS}`);
        if (train._inverted === true) {
            if (!warn) {
                const chip = document.createElement('span');
                chip.className = WARN_CHIP_CLASS;
                chip.setAttribute('aria-hidden', 'true');
                chip.title = 'Avgång före ankomst. Kontrollera.';
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
