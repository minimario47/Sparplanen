/**
 * Grid Context Menu — registry-driven shell
 *
 * Right-click on the empty area of the schedule timeline (i.e. NOT a
 * `.train-bar`) opens this menu. Items contributed via:
 *
 *   window.GridContextMenu.register({
 *     id: 'string',
 *     order: number,
 *     build(coords, ctx) → MenuItem | MenuItem[] | null
 *   })
 *
 * The renderer hands each item the `coords` object produced by
 * `window.GridCoords.fromEvent`, so action modules don't have to do their
 * own DOM math.
 *
 * The menu yields to the train context menu — if the right-click landed
 * on a train bar, this menu does not open.
 */
(function () {
    'use strict';

    const MENU_ID = 'grid-context-menu';
    let menu = null;
    let activeCoords = null;
    const registry = [];

    function createItem(label, action, options = {}) {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'menuitem';
        button.className = 'grid-context-menu__item';
        if (options.icon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'grid-context-menu__icon';
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.textContent = options.icon;
            button.appendChild(iconEl);
        }
        const labelEl = document.createElement('span');
        labelEl.className = 'grid-context-menu__label';
        labelEl.textContent = label;
        button.appendChild(labelEl);
        if (options.hint) {
            const hintEl = document.createElement('span');
            hintEl.className = 'grid-context-menu__hint';
            hintEl.textContent = options.hint;
            button.appendChild(hintEl);
        }
        if (options.disabled) {
            button.disabled = true;
        }
        if (options.danger) {
            button.classList.add('is-danger');
        }
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideMenu();
            if (!button.disabled) {
                try {
                    action(activeCoords);
                } catch (error) {
                    console.error('[GridContextMenu] action failed', error);
                }
            }
        });
        return button;
    }

    function createSeparator() {
        const sep = document.createElement('div');
        sep.className = 'grid-context-menu__separator';
        sep.setAttribute('role', 'separator');
        return sep;
    }

    function register(entry) {
        if (!entry || typeof entry.build !== 'function') return;
        const order = Number.isFinite(entry.order) ? entry.order : 1000;
        const id = String(entry.id || `entry-${registry.length}`);
        const idx = registry.findIndex((e) => e.id === id);
        if (idx >= 0) registry[idx] = { ...entry, order, id };
        else registry.push({ ...entry, order, id });
    }

    function buildContext(coords) {
        const ctx = { coords, target: coords?.target || 'empty', closure: coords?.closure || null };
        if (coords && Array.isArray(window.cachedTracks)) {
            ctx.track = window.cachedTracks.find((t) => Number(t.id) === Number(coords.trackId)) || null;
        }
        return ctx;
    }

    function renderMenu(coords) {
        if (!menu) return;
        menu.innerHTML = '';
        activeCoords = coords;
        const ctx = buildContext(coords);

        const sorted = registry.slice().sort((a, b) => a.order - b.order);
        let lastGroup = null;
        sorted.forEach((entry) => {
            let result;
            try {
                result = entry.build(coords, ctx);
            } catch (error) {
                console.error('[GridContextMenu] build failed', entry.id, error);
                return;
            }
            if (!result) return;
            const items = Array.isArray(result) ? result : [result];
            if (!items.length) return;
            const group = Math.floor(entry.order / 100);
            if (lastGroup !== null && group !== lastGroup) {
                menu.appendChild(createSeparator());
            }
            items.forEach((node) => { if (node instanceof HTMLElement) menu.appendChild(node); });
            lastGroup = group;
        });

        if (coords) {
            const meta = document.createElement('div');
            meta.className = 'grid-context-menu__meta';
            if (ctx.target === 'closure' && ctx.closure?.data) {
                const c = ctx.closure.data;
                const trackLabel = ctx.track?.name || `Spår ${c.trackId}`;
                meta.textContent = `${trackLabel} · ${c.startTime}–${c.endTime}`;
            } else {
                const time = coords.snappedTime || coords.time;
                const trackLabel = ctx.track?.name || (coords.trackId ? `Spår ${coords.trackId}` : '');
                meta.textContent = [trackLabel, time ? time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '']
                    .filter(Boolean)
                    .join(' · ');
            }
            if (meta.textContent) menu.appendChild(meta);
        }
    }

    function positionMenu(x, y) {
        if (!menu) return;
        const margin = 8;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';

        const rect = menu.getBoundingClientRect();
        const left = Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - rect.width - margin));
        const top = Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - rect.height - margin));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    function showMenu(coords, x, y) {
        renderMenu(coords);
        positionMenu(x, y);
        const firstItem = menu.querySelector('.grid-context-menu__item:not(:disabled)');
        if (firstItem) setTimeout(() => firstItem.focus(), 0);
    }

    function hideMenu() {
        if (!menu) return;
        menu.style.display = 'none';
        activeCoords = null;
    }

    function focusSibling(direction) {
        if (!menu || menu.style.display !== 'block') return;
        const items = Array.from(menu.querySelectorAll('.grid-context-menu__item:not(:disabled)'));
        if (!items.length) return;
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
        menu.className = 'grid-context-menu';
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
            if (e.target.closest('.train-bar')) return;
            const canvas = e.target.closest('#timeline-canvas, .timeline-canvas, .schedule-canvas');
            if (!canvas) return;

            if (!window.GridCoords) return;
            const coords = window.GridCoords.fromEvent(e);
            if (!coords) return;

            const closureEl = e.target.closest('.closure-band');
            if (closureEl) {
                const idAttr = closureEl.dataset.closureId;
                const id = idAttr !== undefined ? Number(idAttr) : null;
                const closureData = (id !== null && Number.isFinite(id) && window.UserClosuresStore)
                    ? window.UserClosuresStore.get(id)
                    : null;
                coords.target = 'closure';
                coords.closure = {
                    id,
                    userAdded: closureEl.dataset.userAdded === 'true',
                    data: closureData
                };
            } else {
                coords.target = 'empty';
            }

            e.preventDefault();
            e.stopPropagation();
            if (window.TrainContextMenu?.hide) window.TrainContextMenu.hide();
            showMenu(coords, e.clientX, e.clientY);
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
        window.addEventListener('user-closures-changed', hideMenu);
        window.addEventListener('user-trains-changed', hideMenu);
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

    window.GridContextMenu = {
        register,
        createItem,
        createSeparator,
        hide: hideMenu
    };
})();
