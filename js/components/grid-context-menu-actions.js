/**
 * Grid Context Menu — built-in actions
 *
 * Registers the three default empty-grid items:
 *   100: Lägg till tåg/växling här…   → AddTrainModal
 *   110: Lägg till spåravstängning…   → AddClosureModal
 *   200: Centrera tid här              → TimeManager.centerOnTime
 */
(function () {
    'use strict';

    function ready() {
        if (!window.GridContextMenu || typeof window.GridContextMenu.register !== 'function') {
            console.warn('[grid-context-menu-actions] GridContextMenu not ready');
            return;
        }
        const { register, createItem } = window.GridContextMenu;

        register({
            id: 'grid.add-train',
            order: 100,
            target: 'empty',
            build: (coords, ctx) => {
                if (ctx?.target && ctx.target !== 'empty') return null;
                return createItem('Lägg till tåg/växling här…', () => {
                    if (!window.AddTrainModal || !coords) return;
                    window.AddTrainModal.open({
                        trackId: coords.trackId,
                        startTime: coords.snappedTime || coords.time
                    });
                }, { icon: '+' });
            }
        });

        register({
            id: 'grid.add-closure',
            order: 110,
            build: (coords, ctx) => {
                if (ctx?.target && ctx.target !== 'empty') return null;
                return createItem('Lägg till spåravstängning här…', () => {
                    if (!window.AddClosureModal || !coords) return;
                    window.AddClosureModal.open({
                        trackId: coords.trackId,
                        startTime: coords.snappedTime || coords.time
                    });
                }, { icon: '⊘' });
            }
        });

        register({
            id: 'grid.center-time',
            order: 200,
            build: (coords) => createItem('Centrera tid här', () => {
                if (!window.TimeManager || typeof window.TimeManager.centerOnTime !== 'function' || !coords) return;
                const target = coords.snappedTime || coords.time;
                if (target) window.TimeManager.centerOnTime(target);
            }, { icon: '◎' })
        });

        register({
            id: 'grid.closure-edit',
            order: 300,
            build: (coords, ctx) => {
                if (ctx?.target !== 'closure') return null;
                if (!ctx.closure?.userAdded) return null;
                return createItem('Redigera spåravstängning…', () => {
                    if (!window.AddClosureModal || !ctx.closure?.id) return;
                    window.AddClosureModal.open({ editId: ctx.closure.id });
                }, { icon: '✎' });
            }
        });

        register({
            id: 'grid.closure-delete',
            order: 310,
            build: (coords, ctx) => {
                if (ctx?.target !== 'closure') return null;
                if (!ctx.closure?.userAdded) return null;
                return createItem('Radera spåravstängning', () => {
                    if (!window.UserClosuresStore || !ctx.closure?.id) return;
                    if (!window.confirm('Vill du verkligen radera den här avstängningen?')) return;
                    window.UserClosuresStore.remove(ctx.closure.id);
                    if (window.showNotification) {
                        window.showNotification('Avstängning raderad', 'info');
                    }
                }, { icon: '✕', danger: true });
            }
        });

        register({
            id: 'grid.closure-info',
            order: 320,
            build: (coords, ctx) => {
                if (ctx?.target !== 'closure') return null;
                if (ctx.closure?.userAdded) return null;
                return createItem('Förinställd avstängning', () => {}, { icon: 'ⓘ', disabled: true });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
