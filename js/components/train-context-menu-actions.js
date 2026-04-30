/**
 * Train Context Menu — extra actions
 *
 * Registers three new entries on `window.TrainContextMenu`:
 *   200: Anteckning…       → open TrainNoteModal
 *   210: Visa i tabell      → open TrainRecordDrawer
 *   220: Markera som …      → toggle TrainChecksStore
 *
 * Items live in the 200-block so they sit between the existing delay
 * actions (100-block) and the info / copy actions (300-block) and get
 * separated automatically by the renderer.
 */
(function () {
    'use strict';

    function ready() {
        if (!window.TrainContextMenu || typeof window.TrainContextMenu.register !== 'function') {
            console.warn('[train-context-menu-actions] TrainContextMenu not ready');
            return;
        }
        const { register, createItem } = window.TrainContextMenu;

        register({
            id: 'note.open',
            order: 200,
            build: (train, ctx) => {
                const has = window.TrainNotesStore && window.TrainNotesStore.has(train.id);
                const label = has ? 'Anteckning…' : 'Lägg till anteckning…';
                return createItem(label, () => {
                    if (window.TrainNoteModal) {
                        window.TrainNoteModal.open(train.id);
                    }
                }, { icon: '✎' });
            }
        });

        register({
            id: 'record.show',
            order: 210,
            build: (train) => createItem('Visa i tabell', () => {
                if (window.TrainRecordDrawer) {
                    window.TrainRecordDrawer.open(train.id);
                }
            }, { icon: '☰' })
        });

        register({
            id: 'check.toggle',
            order: 220,
            build: (train) => {
                const checked = window.TrainChecksStore && window.TrainChecksStore.isChecked(train.id);
                const label = checked ? 'Avmarkera "kontrollerad"' : 'Markera som "kontrollerad"';
                return createItem(label, () => {
                    if (!window.TrainChecksStore) return;
                    const nextState = window.TrainChecksStore.toggle(train.id);
                    if (window.showNotification) {
                        window.showNotification(nextState ? 'Markerad som kontrollerad' : 'Kontroll borttagen', 'success');
                    }
                }, { icon: checked ? '☑' : '☐' });
            }
        });

        register({
            id: 'track-change.hide',
            order: 230,
            build: (train) => {
                const store = window.TrackChangesStore;
                if (!store) return null;
                const active = store.getActive(train.id);
                if (!active) return null;
                return createItem('Dölj spårändring', () => {
                    store.hide(train.id);
                    if (window.showNotification) {
                        window.showNotification(`Spårändring dold för tåg ${train.arrivalTrainNumber || train.departureTrainNumber || train.id}`, 'info');
                    }
                }, { icon: '⤫' });
            }
        });

        register({
            id: 'user-train.edit',
            order: 400,
            build: (train) => {
                if (!train || !train.userAdded) return null;
                const isShunting = train.kind === 'shunting';
                const label = isShunting ? 'Redigera växling…' : 'Redigera tåg…';
                return createItem(label, () => {
                    if (!window.AddTrainModal) return;
                    window.AddTrainModal.open({ editId: train.id });
                }, { icon: '✎' });
            }
        });

        register({
            id: 'user-train.delete',
            order: 410,
            build: (train) => {
                if (!train || !train.userAdded) return null;
                const isShunting = train.kind === 'shunting';
                const label = isShunting ? 'Radera växling' : 'Radera tåg';
                return createItem(label, () => {
                    if (!window.UserTrainsStore) return;
                    const subject = isShunting ? 'växlingsrörelsen' : 'tåget';
                    if (!window.confirm(`Vill du verkligen radera ${subject}?`)) return;
                    window.UserTrainsStore.remove(train.id);
                    if (window.showNotification) {
                        window.showNotification('Posten raderad', 'info');
                    }
                }, { icon: '✕', danger: true });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
