// Main Event Setup Coordinates all event handlers
(function() {
    'use strict';

    function setupEventListeners() {
        // Basic UI event listeners
        document.getElementById('addTrainButton').addEventListener('click', window.handleAddTrainClick);
        document.getElementById('exportButton').addEventListener('click', window.handleExportClick);
        document.getElementById('undoButton').addEventListener('click', window.handleUndo);
        document.getElementById('redoButton').addEventListener('click', window.handleRedo);
        document.getElementById('historyButton').addEventListener('click', window.toggleHistoryPanel);
        document.getElementById('closeHistoryPanelButton').addEventListener('click', window.toggleHistoryPanel);
        document.getElementById('closeTrackDataPanelButton').addEventListener('click', window.closeTrackDataPanel);
        document.getElementById('closeTrainDataPanelButton').addEventListener('click', window.closeTrainDataPanel);
        document.getElementById('importFileInput').addEventListener('change', window.handleFileImport);

        document.getElementById('trackLabels').addEventListener('click', window.handleTrackClick);

        // Global click handler for clearing selections and closing menus
        document.addEventListener('click', (e) => {
            if (!window.AppElements.contextMenu.contains(e.target)) {
                window.hideContextMenu();
            }
            
            // Close track data panel when clicking outside
            const trackDataPanel = document.getElementById('trackDataPanel');
            if (trackDataPanel && trackDataPanel.classList.contains('visible') && 
                !trackDataPanel.contains(e.target) && 
                !e.target.closest('.track-label')) {
                window.closeTrackDataPanel();
            }

            // Close train data panel when clicking outside
            const trainDataPanel = document.getElementById('trainDataPanel');
            if (trainDataPanel && trainDataPanel.classList.contains('visible') && 
                !trainDataPanel.contains(e.target) && 
                !e.target.closest('.train-bar')) {
                window.closeTrainDataPanel();
            }
            
            if (!e.target.closest('.train-bar') && 
                !window.AppElements.contextMenu.contains(e.target) && 
                !window.AppElements.trainModal.contains(e.target) && 
                !e.target.closest('.app-header') &&
                !e.target.closest('#trackDataPanel') &&
                !e.target.closest('#trainDataPanel')) {
                window.clearSelection();
            }
        });

        // Grid event listeners
        window.AppElements.scheduleGrid.addEventListener('mousedown', window.handleGridMouseDown);
        window.AppElements.scheduleGrid.addEventListener('dblclick', window.handleGridDoubleClick);
        window.AppElements.scheduleGrid.addEventListener('contextmenu', window.handleGridContextMenu);
        window.AppElements.contextMenu.addEventListener('click', window.handleContextMenuAction);

        // Time navigation listeners
        document.getElementById('prevTimeButton').addEventListener('click', window.handlePrevTime);
        document.getElementById('nextTimeButton').addEventListener('click', window.handleNextTime);
        document.getElementById('viewHoursSelect').addEventListener('change', window.handleViewHoursChange);

        // Global listeners
        document.addEventListener('keydown', window.handleKeyboardShortcuts);

        // Window resize handler
        window.addEventListener('resize', () => {
            if (typeof render !== 'undefined') render();
        });

        // Auto-save interval
        setInterval(() => {
            const state = window.AppState;
            if (state.isLoaded && typeof persistenceEngine !== 'undefined') {
                persistenceEngine.saveStateToLocalStorage(state);
            }
        }, 30000);
    }

    // Expose the main setup function globally
    window.setupEventListeners = setupEventListeners;

})(); 