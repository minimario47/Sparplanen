// File Operation Handlers
(function() {
    'use strict';

    function handleExportClick() {
        const exportButton = document.getElementById('exportButton');
        const selected = document.querySelector('.train-bar.selected');
        
        // Add loading state
        exportButton.classList.add('loading');
        exportButton.disabled = true;
        
        if (typeof showNotification !== 'undefined') {
            showNotification('Förbereder export...', 'info', 2000);
        }
        
        if (selected) selected.classList.remove('selected');

        html2canvas(window.AppElements.appContainer, {
            logging: false,
            useCORS: true,
            height: window.AppElements.appContainer.scrollHeight,
            width: window.AppElements.appContainer.scrollWidth,
            backgroundColor: '#ffffff',
            scale: 2 // Higher quality export
        }).then(canvas => {
            try {
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                link.download = `spardiagram-${timestamp}.png`;
                link.href = canvas.toDataURL('image/png', 0.9);
                link.click();
                
                if (typeof showNotification !== 'undefined') {
                    showNotification('Export slutförd! Bilden har laddats ner.', 'success');
                }
            } catch (downloadError) {
                console.error('Download failed:', downloadError);
                if (typeof showNotification !== 'undefined') {
                    showNotification('Export misslyckades vid nedladdning.', 'error');
                }
            }
            
            if (selected) selected.classList.add('selected');
        }).catch(err => {
            console.error("html2canvas export failed:", err);
            if (typeof showNotification !== 'undefined') {
                showNotification(`Export misslyckades: ${err.message || 'Okänt fel'}`, "error", 5000);
            }
            if (selected) selected.classList.add('selected');
        }).finally(() => {
            exportButton.classList.remove('loading');
            exportButton.disabled = false;
        });
    }

    function handleSaveNow() {
        if (typeof persistenceEngine === 'undefined') {
            if (typeof showNotification !== 'undefined') {
                showNotification('Sparfunktion inte tillgänglig', 'error');
            }
            return;
        }
        
        const saveButton = document.getElementById('saveButton');
        const originalText = saveButton.innerHTML;
        
        try {
            // Add loading state
            saveButton.classList.add('loading');
            saveButton.disabled = true;
            
            persistenceEngine.saveStateToLocalStorage(window.AppState, true);
            
            if (typeof showNotification !== 'undefined') {
                const trainCount = window.AppState.trains.length;
                showNotification(`Data sparad! ${trainCount} tjänster säkrade.`, 'success');
            }
            
            // Brief visual feedback
            saveButton.innerHTML = '<span>✓</span> Sparat!';
            setTimeout(() => {
                saveButton.innerHTML = originalText;
            }, 1500);
            
        } catch (error) {
            console.error('Save failed:', error);
            if (typeof showNotification !== 'undefined') {
                showNotification(`Sparning misslyckades: ${error.message}`, 'error');
            }
        } finally {
            // Remove loading state
            setTimeout(() => {
                saveButton.classList.remove('loading');
                saveButton.disabled = false;
            }, 500);
        }
    }

    function handleImportClick() { 
        document.getElementById('importFileInput').click(); 
    }

    async function handleFileImport(e) {
        if (typeof persistenceEngine === 'undefined' || typeof historyEngine === 'undefined') {
            if (typeof showNotification !== 'undefined') {
                showNotification('Import inte tillgänglig - systemfel', 'error');
            }
            return;
        }
        
        const file = e.target.files[0];
        if (!file) return;
        
        const importButton = document.getElementById('importButton');
        const originalText = importButton.innerHTML;
        
        try {
            // Validate file type
            if (!file.name.toLowerCase().endsWith('.json')) {
                if (typeof showNotification !== 'undefined') {
                    showNotification('Endast JSON-filer stöds för import', 'warning');
                }
                return;
            }
            
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                if (typeof showNotification !== 'undefined') {
                    showNotification('Filen är för stor (max 10MB)', 'warning');
                }
                return;
            }
            
            // Add loading state
            importButton.classList.add('loading');
            importButton.disabled = true;
            
            if (typeof showNotification !== 'undefined') {
                showNotification('Läser fil...', 'info', 2000);
            }
            
            const state = window.AppState;
            const config = window.AppConfig;
            const dataBefore = historyEngine.deepClone(state.trains);
            const importedState = await persistenceEngine.importStateFromFile(file);
            
            // Validate imported data
            if (!importedState || typeof importedState !== 'object') {
                throw new Error('Ogiltig filformat');
            }
            
            const trainCount = importedState.trains?.length || 0;
            const currentCount = state.trains.length;
            
            const confirmMessage = `Importera data från "${file.name}"?\n\n` +
                `Nya tjänster: ${trainCount}\n` +
                `Nuvarande tjänster: ${currentCount}\n\n` +
                `⚠️ Detta kommer att ersätta ALL nuvarande data och historik.`;
                
            if (confirm(confirmMessage)) {
                state.trains = importedState.trains || [];
                state.nextTrainId = importedState.nextTrainId || window.calculateNextId(state.trains);
                state.currentStartHour = typeof importedState.currentStartHour === 'number' ? importedState.currentStartHour : 0;
                state.viewHours = importedState.viewHours || config.defaultViewHours;
                historyEngine.initializeHistory(state);
                
                if (typeof render !== 'undefined') render();
                if (typeof window.saveAndLog !== 'undefined') {
                    window.saveAndLog(historyEngine.actionTypes.IMPORT_DATA, `Importerade ${state.trains.length} tjänster från fil`, []);
                }
                
                document.getElementById('viewHoursSelect').value = state.viewHours;
                
                if (typeof showNotification !== 'undefined') {
                    showNotification(`✅ Import slutförd! ${state.trains.length} tjänster laddade.`, 'success', 4000);
                }
                
                // Visual feedback
                importButton.innerHTML = '<span>✓</span> Importerat!';
                setTimeout(() => {
                    importButton.innerHTML = originalText;
                }, 2000);
            } else {
                if (typeof showNotification !== 'undefined') {
                    showNotification('Import avbruten', 'info');
                }
            }
            
        } catch (error) {
            console.error('Import failed:', error);
            if (typeof showNotification !== 'undefined') {
                let errorMessage = 'Import misslyckades';
                if (error.message.includes('JSON')) {
                    errorMessage += ': Ogiltig JSON-format';
                } else if (error.message.includes('network')) {
                    errorMessage += ': Nätverksfel';
                } else {
                    errorMessage += `: ${error.message}`;
                }
                showNotification(errorMessage, 'error', 5000);
            }
        } finally {
            // Remove loading state
            importButton.classList.remove('loading');
            importButton.disabled = false;
            // Clear file input
            e.target.value = '';
        }
    }

    // Expose functions globally
    window.handleExportClick = handleExportClick;
    window.handleSaveNow = handleSaveNow;
    window.handleImportClick = handleImportClick;
    window.handleFileImport = handleFileImport;

})(); 