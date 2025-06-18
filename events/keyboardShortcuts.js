// Keyboard Shortcuts and Help
(function() {
    'use strict';

    function handleKeyboardShortcuts(e) {
        const lang = window.AppLang;
        const state = window.AppState;
        
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
        
        if (isTyping && e.key !== 'Escape') {
            return;
        }

        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault(); 
            e.shiftKey ? window.handleRedo() : window.handleUndo();
            return;
        }
        
        if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault(); 
            window.handleRedo();
            return;
        }
        
        if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault(); 
            window.handleSaveNow();
            return;
        }
        
        if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            if (typeof openTrainModalForAdd !== 'undefined') {
                openTrainModalForAdd();
                if (typeof showNotification !== 'undefined') {
                    showNotification('Nytt tåg - fyll i formuläret', 'info', 2000);
                }
            }
            return;
        }
        
        if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            window.handleExportClick();
            return;
        }
        
        if (e.key === 'Delete' && state.selectedTrainId && !isTyping) {
            e.preventDefault();
            if (typeof handleDeleteTrain !== 'undefined') {
                handleDeleteTrain(state.selectedTrainId);
            }
            return;
        }
        
        if (e.key === 'ArrowLeft' && e.ctrlKey && !isTyping) {
            e.preventDefault();
            window.handlePrevTime();
            return;
        }
        
        if (e.key === 'ArrowRight' && e.ctrlKey && !isTyping) {
            e.preventDefault();
            window.handleNextTime();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault(); 
            let actionPerformed = false;
            
            if (state.swappingState.active) {
                state.swappingState.active = false; 
                state.swappingState.sourceTrainId = null;
                window.clearSelection(); 
                if (typeof render !== 'undefined') render(); 
                if (typeof showNotification !== 'undefined') showNotification(lang.swapCancel, 'info'); 
                actionPerformed = true;
            }
            
            if (window.AppElements.trainModal.classList.contains('visible')) { 
                if (typeof closeTrainModal !== 'undefined') closeTrainModal(); 
                if (typeof showNotification !== 'undefined') {
                    showNotification('Formulär stängt', 'info', 1500);
                }
                actionPerformed = true; 
            }

            if (window.AppElements.contextMenu.style.display === 'block') { 
                window.hideContextMenu(); 
                actionPerformed = true; 
            }
            
            if (document.getElementById('historyPanel').classList.contains('visible')) { 
                window.toggleHistoryPanel(); 
                actionPerformed = true; 
            }
            
            if (!actionPerformed) { 
                window.clearSelection(); 
                if (typeof render !== 'undefined') render(); 
            }
        }
        
        if (e.key === 'F1' || (e.key === '?' && !isTyping)) {
            e.preventDefault();
            showKeyboardHelp();
        }
        
        if (e.ctrlKey && (e.key === 't' || e.key === 'T')) {
            e.preventDefault();
            if (typeof toggleTheme === 'function') {
                toggleTheme();
            }
        }
    }
    
    function showKeyboardHelp() {
        const helpMessage = `Tangentbordsgenvägar:

🔄 Ångra/Gör om:
   Ctrl+Z - Ångra senaste åtgärd
   Ctrl+Shift+Z / Ctrl+Y - Gör om åtgärd

💾 Data:
   Ctrl+S - Spara data
   Ctrl+N - Lägg till nytt tåg
   Ctrl+E - Exportera som bild

🧭 Navigation:
   Ctrl+← - Föregående tidsperiod  
   Ctrl+→ - Nästa tidsperiod

✏️ Redigering:
   Delete - Ta bort valt tåg
   Escape - Avbryt pågående åtgärd

🎨 Utseende:
   Ctrl+T - Växla mellan ljust/mörkt tema

❓ Hjälp:
   F1 eller ? - Visa denna hjälp`;

        if (typeof showNotification !== 'undefined') {
            showNotification(helpMessage, 'info', 8000);
        } else {
            alert(helpMessage);
        }
    }

    window.handleKeyboardShortcuts = handleKeyboardShortcuts;
    window.showKeyboardHelp = showKeyboardHelp;

})(); 