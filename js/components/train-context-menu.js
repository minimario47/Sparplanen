(function () {
    'use strict';

    const MENU_ID = 'train-context-menu';
    let menu = null;
    let activeTrainBar = null;

    if (!window.suppressedDelays) {
        window.suppressedDelays = new Set();
    }

    function getTrainFromBar(trainBar) {
        if (!trainBar) return null;
        const trainId = trainBar.dataset.trainId;
        if (!trainId || !Array.isArray(window.cachedTrains)) return null;
        return window.cachedTrains.find((train) => String(train.id) === String(trainId)) || null;
    }

    function getTrainNumber(train) {
        if (!train) return '';
        return String(train.arrivalTrainNumber || train.departureTrainNumber || '').trim();
    }

    function isSuppressed(train) {
        const number = getTrainNumber(train);
        return !!number && window.suppressedDelays.has(number);
    }

    function hasDelayData(train) {
        const dataManager = window.delayIntegration?.dataManager;
        if (!dataManager || !train) return false;
        const arr = train.arrivalTrainNumber ? dataManager.getDelayInfo(train.arrivalTrainNumber) : null;
        const dep = train.departureTrainNumber ? dataManager.getDelayInfo(train.departureTrainNumber) : null;
        const info = arr || dep;
        if (!info) return false;
        return Boolean(info.isCanceled || info.isReplaced || (Number.isFinite(info.delayMinutes) && Math.abs(info.delayMinutes) > 2));
    }

    function refreshVisuals() {
        if (window.delayIntegration?.isInitialized) {
            window.delayIntegration.updateAllVisualizations();
        }
        window.dispatchEvent(new CustomEvent('suppressed-delays-changed'));
    }

    function createItem(label, action, options = {}) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'train-context-menu__item';
        button.textContent = label;
        if (options.disabled) {
            button.disabled = true;
        }
        if (options.danger) {
            button.classList.add('is-danger');
        }
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideMenu();
            if (!button.disabled) {
                action();
            }
        });
        return button;
    }

    function renderMenu(trainBar) {
        if (!menu) return;
        menu.innerHTML = '';

        const train = getTrainFromBar(trainBar);
        if (!train) return;
        const trainNumber = getTrainNumber(train);
        const suppressed = isSuppressed(train);
        const canSuppress = trainNumber && hasDelayData(train) && !suppressed;

        menu.appendChild(
            createItem('Slopa försening', () => {
                if (!trainNumber) return;
                window.suppressedDelays.add(trainNumber);
                refreshVisuals();
            }, { disabled: !canSuppress })
        );

        menu.appendChild(
            createItem('Återställ försening', () => {
                if (!trainNumber) return;
                window.suppressedDelays.delete(trainNumber);
                refreshVisuals();
            }, { disabled: !suppressed })
        );

        const separator = document.createElement('div');
        separator.className = 'train-context-menu__separator';
        menu.appendChild(separator);

        menu.appendChild(
            createItem('Visa info', () => {
                const event = new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 });
                if (window.trainTooltip?.showForTrainBar) {
                    window.trainTooltip.showForTrainBar(trainBar, event);
                }
            })
        );

        menu.appendChild(
            createItem('Kopiera tågnummer', async () => {
                if (!trainNumber) return;
                try {
                    await navigator.clipboard.writeText(trainNumber);
                    if (window.showNotification) {
                        window.showNotification(`Kopierade tågnummer ${trainNumber}`, 'success');
                    }
                } catch (_) {
                    if (window.showNotification) {
                        window.showNotification('Kunde inte kopiera tågnummer', 'error');
                    }
                }
            }, { disabled: !trainNumber })
        );
    }

    function positionMenu(x, y) {
        if (!menu) return;
        const margin = 8;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';

        const rect = menu.getBoundingClientRect();
        const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
        const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
        const left = Math.min(Math.max(margin, x), maxLeft);
        const top = Math.min(Math.max(margin, y), maxTop);

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function showMenu(trainBar, x, y) {
        activeTrainBar = trainBar;
        renderMenu(trainBar);
        positionMenu(x, y);
    }

    function hideMenu() {
        if (!menu) return;
        menu.style.display = 'none';
        activeTrainBar = null;
    }

    function initDom() {
        if (document.getElementById(MENU_ID)) {
            menu = document.getElementById(MENU_ID);
            return;
        }
        menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.className = 'train-context-menu';
        menu.style.display = 'none';
        menu.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        document.body.appendChild(menu);
    }

    function attachListeners() {
        document.addEventListener('contextmenu', (e) => {
            const trainBar = e.target.closest('.train-bar');
            if (!trainBar) {
                hideMenu();
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            showMenu(trainBar, e.clientX, e.clientY);
        });

        document.addEventListener('click', (e) => {
            if (!menu || menu.style.display !== 'block') return;
            if (menu.contains(e.target)) return;
            hideMenu();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideMenu();
            }
        });

        window.addEventListener('scroll', hideMenu, true);
        window.addEventListener('resize', hideMenu);
        window.addEventListener('suppressed-delays-changed', () => {
            if (activeTrainBar && menu && menu.style.display === 'block') {
                renderMenu(activeTrainBar);
            }
        });
    }

    function init() {
        initDom();
        attachListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
