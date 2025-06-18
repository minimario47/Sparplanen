// History Operation Handlers
(function() {
    'use strict';

    function handleUndo() {
        if (typeof historyEngine === 'undefined') {
            if (typeof showNotification !== 'undefined') {
                showNotification('Ånger-funktion inte tillgänglig', 'error');
            }
            return;
        }
        
        const state = window.AppState;
        const undoButton = document.getElementById('undoButton');
        
        if (historyEngine.undoLastAction(state)) {
            // Get the action description for better feedback
            const status = historyEngine.getUndoRedoStatus(state);
            const actionDescription = status.redoDescription || 'åtgärd';
            
            if (typeof render !== 'undefined') render(); 
            if (typeof updateUndoRedoButtons !== 'undefined') updateUndoRedoButtons(); 
            if (typeof updateHistoryPanel !== 'undefined') updateHistoryPanel();
            if (typeof showNotification !== 'undefined') {
                showNotification(`↶ Ångrade: ${actionDescription}`, 'success');
            }
            
            // Brief visual feedback
            const originalText = undoButton.innerHTML;
            undoButton.innerHTML = '<span>✓</span> Ångrad';
            setTimeout(() => {
                undoButton.innerHTML = originalText;
            }, 1000);
        } else { 
            if (typeof showNotification !== 'undefined') {
                showNotification('Inga åtgärder att ångra', 'info'); 
            }
        }
    }

    function handleRedo() {
        if (typeof historyEngine === 'undefined') {
            if (typeof showNotification !== 'undefined') {
                showNotification('Gör om-funktion inte tillgänglig', 'error');
            }
            return;
        }
        
        const state = window.AppState;
        const redoButton = document.getElementById('redoButton');
        
        if (historyEngine.redoNextAction(state)) {
            // Get the action description for better feedback
            const status = historyEngine.getUndoRedoStatus(state);
            const actionDescription = status.undoDescription || 'åtgärd';
            
            if (typeof render !== 'undefined') render(); 
            if (typeof updateUndoRedoButtons !== 'undefined') updateUndoRedoButtons(); 
            if (typeof updateHistoryPanel !== 'undefined') updateHistoryPanel();
            if (typeof showNotification !== 'undefined') {
                showNotification(`↷ Upprepade: ${actionDescription}`, 'success');
            }
            
            // Brief visual feedback
            const originalText = redoButton.innerHTML;
            redoButton.innerHTML = '<span>✓</span> Gjord';
            setTimeout(() => {
                redoButton.innerHTML = originalText;
            }, 1000);
        } else { 
            if (typeof showNotification !== 'undefined') {
                showNotification('Inga åtgärder att upprepa', 'info'); 
            }
        }
    }

    function toggleHistoryPanel() {
        console.log('🔄 toggleHistoryPanel called');
        const panel = document.getElementById('historyPanel');
        if (!panel) {
            console.error('historyPanel element not found');
            return;
        }
        panel.classList.toggle('visible');
        console.log('📋 History panel visible:', panel.classList.contains('visible'));
        if (panel.classList.contains('visible') && typeof updateHistoryPanel !== 'undefined') {
            updateHistoryPanel();
        } else if (panel.classList.contains('visible')) {
            console.warn('updateHistoryPanel function not found');
        }
    }

    // Expose functions globally
    window.handleUndo = handleUndo;
    window.handleRedo = handleRedo;
    window.toggleHistoryPanel = toggleHistoryPanel;

})(); 