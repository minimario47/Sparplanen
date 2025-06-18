// Main Application - Configuration, State Management, and Initialization
document.addEventListener('DOMContentLoaded', () => {

    //  CONFIGURATION AND STATE 
    const config = {
        basePixelsPerMinute: 4,
        totalHours: 24,
        subTracksPerTrack: 3,
        snapMinutes: 5,
        baseTrackHeight: 40,
        defaultViewHours: 3,
        minViewHours: 1,
        maxViewHours: 24,
        proximityWarningMinutes: 2,
    };

    const lang = {
        modalTitleAdd: 'Lägg till ny tjänst',
        modalTitleEdit: 'Redigera tjänst',
        track: 'Spår',
        confirmDelete: 'Är du säker på att du vill ta bort denna tjänst?',
        swapPrompt: 'Klicka på en annan tjänst för att byta plats med.',
        swapCancel: 'Byte avbrutet.',
        splitPrompt: 'Tjänsten har delats. Den nya delen är placerad efter originalet.',
        proximityWarning: 'Kort vändtid',
        lengthWarning: 'För långt för spår',
        lengthImpossible: 'Får ej plats på spår',
    };

    const calculateNextId = (trains) => {
        if (!trains || trains.length === 0) return 1;
        const maxId = Math.max(...trains.map(t => Number(t.id) || 0));
        return maxId + 1;
    };

    let state = {
        trains: [],
        nextTrainId: 1,
        selectedTrainId: null,
        swappingState: { active: false, sourceTrainId: null },
        currentStartHour: 9,
        viewHours: config.defaultViewHours,
        pixelsPerMinute: 4,
        trackHeight: 40,
        actionHistory: [],
        historyPointer: -1,
        isLoaded: false
    };

    //  DOM ELEMENT REFERENCES 
    const elements = {
        timelineHeader: document.getElementById('timelineHeader'),
        trackLabelsContainer: document.getElementById('trackLabels'),
        scheduleGrid: document.getElementById('scheduleGrid'),
        trainModal: document.getElementById('trainModal'),
        trainForm: document.getElementById('trainForm'),
        modalTitle: document.getElementById('modalTitle'),
        contextMenu: document.getElementById('contextMenu'),
        appContainer: document.getElementById('appContainer')
    };

    //  CORE UTILITIES 
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const minutesToTime = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = Math.round(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    function calculateDynamicSizing() {
        const viewportWidth = window.innerWidth;
        const trackLabelWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--track-label-width')) || 120;
        const padding = 40;
        const availableWidth = viewportWidth - trackLabelWidth - padding;

        const totalMinutes = state.viewHours * 60;
        state.pixelsPerMinute = Math.max(1, Math.round((availableWidth / totalMinutes) * 100) / 100);

        const viewportHeight = window.innerHeight;
        const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;
        const timelineHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--timeline-height')) || 40;
        const padding2 = 20;
        const availableHeight = viewportHeight - headerHeight - timelineHeight - padding2;

        const totalTrackDefinitionsCount = typeof trackDefinitions !== 'undefined' ? trackDefinitions.length : 0;
        if (totalTrackDefinitionsCount === 0) {
            state.trackHeight = config.baseTrackHeight;
            console.warn("trackDefinitions is empty or not loaded. Using default track height.");
        } else {
            const assumedVisualSubTracksPerTrack = 3;
            const trackContainerHeight = availableHeight / totalTrackDefinitionsCount;
            state.trackHeight = Math.max(15, Math.round(trackContainerHeight / assumedVisualSubTracksPerTrack));
        }

        document.documentElement.style.setProperty('--track-height', `${state.trackHeight}px`);
        
        const hourGridSize = Math.round(60 * state.pixelsPerMinute);
        const quarterHourGridSize = Math.round(15 * state.pixelsPerMinute);
        document.documentElement.style.setProperty('--hour-grid-size', `${hourGridSize}px`);
        document.documentElement.style.setProperty('--quarter-hour-grid-size', `${quarterHourGridSize}px`);
    }

    function saveAndLog(actionType, description, dataBefore = null) {
        if (!state.isLoaded || typeof historyEngine === 'undefined' || typeof persistenceEngine === 'undefined') return;
        const beforeData = dataBefore || historyEngine.deepClone(state.trains);
        historyEngine.smartLogAction(state, actionType, description, beforeData);
        persistenceEngine.saveStateToLocalStorage(state);
        if (typeof updateUndoRedoButtons !== 'undefined') updateUndoRedoButtons();
        if (typeof updateHistoryPanel !== 'undefined') updateHistoryPanel();
    }

    //  INITIALIZATION 
    function init() {
        console.log('Initializing Enhanced Dispatch System...');
        if (typeof persistenceEngine === 'undefined' || typeof historyEngine === 'undefined' || typeof vehicleDefinitions === 'undefined' || typeof trackDefinitions === 'undefined') {
            if (typeof showNotification !== 'undefined') {
                showNotification("Nödvändiga dataskript kunde inte laddas. Applikationen kanske inte fungerar korrekt.", "error", 10000);
            }
            console.error("One or more external data/engine scripts are missing.");
        }

        const savedState = (typeof persistenceEngine !== 'undefined') ? persistenceEngine.loadStateFromLocalStorage() : null;
        if (savedState) {
            state.trains = savedState.trains || [];
            state.nextTrainId = savedState.nextTrainId || calculateNextId(state.trains);
            state.currentStartHour = typeof savedState.currentStartHour === 'number' ? savedState.currentStartHour : config.currentStartHour;
            state.viewHours = savedState.viewHours || config.defaultViewHours;
            console.log('Loaded saved state with', state.trains.length, 'services');
            if (typeof showNotification !== 'undefined') showNotification('Sparad data laddad', 'success');
        } else {
            state.trains = (typeof initialServiceData !== 'undefined' && Array.isArray(initialServiceData)) ? [...initialServiceData] : [];
            state.nextTrainId = calculateNextId(state.trains);
            console.log('Using initial service data with', state.trains.length, 'services');
        }
        document.getElementById('viewHoursSelect').value = state.viewHours;

        if (typeof historyEngine !== 'undefined') {
            historyEngine.initializeHistory(state, savedState ? savedState.actionHistory : null, savedState ? savedState.historyPointer : null);
        }

        if (typeof populateVehicleTypeSelect !== 'undefined') populateVehicleTypeSelect();
        if (typeof render !== 'undefined') render();
        if (typeof setupEventListeners !== 'undefined') setupEventListeners();
        if (typeof setupModalEventListeners !== 'undefined') setupModalEventListeners();
        if (typeof updateUndoRedoButtons !== 'undefined') updateUndoRedoButtons();
        if (typeof updateHistoryPanel !== 'undefined') updateHistoryPanel();
        
        if (typeof startCurrentTimeUpdates === 'function') {
            startCurrentTimeUpdates();
        }

        if (!savedState && typeof persistenceEngine !== 'undefined') {
            persistenceEngine.saveStateToLocalStorage(state);
        }
        state.isLoaded = true;
        
        if (typeof showWelcomeGuide === 'function') {
            showWelcomeGuide();
        }
        
        console.log('Initialization complete');
    }

    window.AppState = state;
    window.AppConfig = config;
    window.AppLang = lang;
    window.AppElements = elements;
    window.timeToMinutes = timeToMinutes;
    window.minutesToTime = minutesToTime;
    window.calculateDynamicSizing = calculateDynamicSizing;
    window.saveAndLog = saveAndLog;
    window.calculateNextId = calculateNextId;

    init();
}); 