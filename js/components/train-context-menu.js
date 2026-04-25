/**
 * Train Context Menu — registry-driven shell
 *
 * Owns the menu DOM, positioning, lifecycle and item helpers.
 * Items are contributed by other modules via:
 *
 *   window.TrainContextMenu.register({
 *     id: 'string',           // unique
 *     order: number,          // smaller renders first; built-ins live in 100-block windows
 *     build(train, ctx) → MenuItem | MenuItem[] | null
 *   })
 *
 * MenuItem = HTMLElement (use createItem / createSeparator).
 *
 * The four legacy items (slopa/återställ försening, visa info, kopiera tågnummer)
 * are registered inside this same file to preserve historic behaviour.
 */
(function () {
    'use strict';

    const MENU_ID = 'train-context-menu';
    let menu = null;
    let activeTrainBar = null;
    let activeContext = null;
    const registry = [];

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

    /**
     * Public helper — exposed for action modules.
     */
    function createItem(label, action, options = {}) {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'menuitem';
        button.className = 'train-context-menu__item';
        if (options.icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'train-context-menu__icon';
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.textContent = options.icon;
            button.appendChild(iconEl);
        }
        const labelEl = document.createElement('span');
        labelEl.className = 'train-context-menu__label';
        labelEl.textContent = label;
        button.appendChild(labelEl);
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
                try {
                    action();
                } catch (error) {
                    console.error('[TrainContextMenu] action failed', error);
                }
            }
        });
        return button;
    }

    function createSeparator() {
        const separator = document.createElement('div');
        separator.className = 'train-context-menu__separator';
        separator.setAttribute('role', 'separator');
        return separator;
    }

    function register(entry) {
        if (!entry || typeof entry.build !== 'function') return;
        const order = Number.isFinite(entry.order) ? entry.order : 1000;
        const id = String(entry.id || `entry-${registry.length}`);
        const existingIdx = registry.findIndex((e) => e.id === id);
        if (existingIdx >= 0) {
            registry[existingIdx] = { ...entry, order, id };
        } else {
            registry.push({ ...entry, order, id });
        }
    }

    function renderMenu(trainBar) {
        if (!menu) return;
        menu.innerHTML = '';

        const train = getTrainFromBar(trainBar);
        if (!train) return;

        activeContext = {
            train,
            trainBar,
            trainNumber: getTrainNumber(train),
            isSuppressed: isSuppressed(train),
            hasDelayData: hasDelayData(train)
        };

        const sorted = registry.slice().sort((a, b) => a.order - b.order);
        let lastGroup = null;
        sorted.forEach((entry) => {
            let result;
            try {
                result = entry.build(train, activeContext);
            } catch (error) {
                console.error('[TrainContextMenu] entry build failed', entry.id, error);
                return;
            }
            if (!result) return;
            const items = Array.isArray(result) ? result : [result];
            if (items.length === 0) return;
            const group = Math.floor(entry.order / 100);
            if (lastGroup !== null && group !== lastGroup) {
                menu.appendChild(createSeparator());
            }
            items.forEach((node) => {
                if (node instanceof HTMLElement) menu.appendChild(node);
            });
            lastGroup = group;
        });
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
        const firstItem = menu.querySelector('.train-context-menu__item:not(:disabled)');
        if (firstItem) {
            setTimeout(() => firstItem.focus(), 0);
        }
    }

    function hideMenu() {
        if (!menu) return;
        menu.style.display = 'none';
        activeTrainBar = null;
        activeContext = null;
    }

    function focusSibling(direction) {
        if (!menu || menu.style.display !== 'block') return;
        const items = Array.from(menu.querySelectorAll('.train-context-menu__item:not(:disabled)'));
        if (items.length === 0) return;
        const idx = items.indexOf(document.activeElement);
        let next = idx + direction;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        items[next].focus();
    }

    function initDom() {
        if (document.getElementById(MENU_ID)) {
            menu = document.getElementById(MENU_ID);
            return;
        }
        menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.className = 'train-context-menu';
        menu.setAttribute('role', 'menu');
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
            if (!menu || menu.style.display !== 'block') return;
            if (e.key === 'Escape') {
                hideMenu();
                if (activeTrainBar) activeTrainBar.focus?.();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusSibling(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusSibling(-1);
            }
        });

        window.addEventListener('scroll', hideMenu, true);
        window.addEventListener('resize', hideMenu);
        window.addEventListener('suppressed-delays-changed', () => {
            if (activeTrainBar && menu && menu.style.display === 'block') {
                renderMenu(activeTrainBar);
            }
        });
        window.addEventListener('train-notes-changed', () => {
            if (activeTrainBar && menu && menu.style.display === 'block') {
                renderMenu(activeTrainBar);
            }
        });
        window.addEventListener('train-checks-changed', () => {
            if (activeTrainBar && menu && menu.style.display === 'block') {
                renderMenu(activeTrainBar);
            }
        });
        window.addEventListener('user-trains-changed', () => {
            hideMenu();
        });
    }

    /**
     * Built-in items (delay suppression, copy, show info).
     * Order numbers leave room for new groups: 100s = delay ops,
     * 200s reserved for note/record/check actions in train-context-menu-actions.js,
     * 300s = info.
     */
    function registerBuiltins() {
        register({
            id: 'builtin.suppress',
            order: 100,
            build: (train, ctx) => {
                const canSuppress = ctx.trainNumber && ctx.hasDelayData && !ctx.isSuppressed;
                return createItem('Slopa försening', () => {
                    if (!ctx.trainNumber) return;
                    window.suppressedDelays.add(ctx.trainNumber);
                    refreshVisuals();
                }, { disabled: !canSuppress });
            }
        });

        register({
            id: 'builtin.restore',
            order: 110,
            build: (train, ctx) => createItem('Återställ försening', () => {
                if (!ctx.trainNumber) return;
                window.suppressedDelays.delete(ctx.trainNumber);
                refreshVisuals();
            }, { disabled: !ctx.isSuppressed })
        });

        register({
            id: 'builtin.show-info',
            order: 300,
            build: (train, ctx) => createItem('Visa info', () => {
                const event = new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 });
                if (window.trainTooltip?.showForTrainBar) {
                    window.trainTooltip.showForTrainBar(ctx.trainBar, event);
                }
            })
        });

        register({
            id: 'builtin.copy-number',
            order: 310,
            build: (train, ctx) => createItem('Kopiera tågnummer', async () => {
                if (!ctx.trainNumber) return;
                try {
                    await navigator.clipboard.writeText(ctx.trainNumber);
                    if (window.showNotification) {
                        window.showNotification(`Kopierade tågnummer ${ctx.trainNumber}`, 'success');
                    }
                } catch (_) {
                    if (window.showNotification) {
                        window.showNotification('Kunde inte kopiera tågnummer', 'error');
                    }
                }
            }, { disabled: !ctx.trainNumber })
        });
    }

    function init() {
        initDom();
        attachListeners();
        registerBuiltins();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TrainContextMenu = {
        register,
        createItem,
        createSeparator,
        hide: hideMenu
    };
})();
