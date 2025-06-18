// Modal Manager - Modal Dialogs, Form Handling, and Context Menus
(function() {
    'use strict';

    function openTrainModalForAdd() {
        const trainForm = window.AppElements.trainForm;
        const modalTitle = window.AppElements.modalTitle;
        const lang = window.AppLang;
        
        trainForm.reset();
        modalTitle.textContent = lang.modalTitleAdd;
        document.getElementById('trainId').value = '';
        document.getElementById('color').value = "#3498db";
        updateVehicleTypeInfo();
        updateTrackCapacityInfo();
        window.AppElements.trainModal.classList.add('visible');
    }

    function openTrainModalForEdit(trainId) {
        const state = window.AppState;
        const service = state.trains.find(t => t.id === trainId);
        if (!service) return;

        const modalTitle = window.AppElements.modalTitle;
        const lang = window.AppLang;

        modalTitle.textContent = lang.modalTitleEdit;
        document.getElementById('trainId').value = service.id;
        document.getElementById('arrivalTrainNumber').value = service.arrivalTrainNumber || service.trainNumber || '';
        document.getElementById('departureTrainNumber').value = service.departureTrainNumber || service.trainNumber || '';
        document.getElementById('origin').value = service.origin || '';
        document.getElementById('destination').value = service.destination || '';
        document.getElementById('startTime').value = service.scheduledArrivalTime || service.startTime || '';
        document.getElementById('endTime').value = service.scheduledDepartureTime || service.endTime || '';
        document.getElementById('trackSelect').value = `${service.trackId}-${service.subTrackIndex}`;

        if (service.trainSet) {
            document.getElementById('vehicleTypeSelect').value = service.trainSet.vehicleTypeID || '';
            document.getElementById('vehicleCount').value = service.trainSet.count || 1;
        } else {
            document.getElementById('vehicleTypeSelect').value = '';
            document.getElementById('vehicleCount').value = 1;
        }

        const defaultColor = service.trainSet ? window.getTrainSetColor(service.trainSet) : '#3498db';
        document.getElementById('color').value = service.color || defaultColor;

        updateVehicleTypeInfo();
        updateTrackCapacityInfo();

        window.AppElements.trainModal.classList.add('visible');
    }

    function closeTrainModal() { 
        window.AppElements.trainModal.classList.remove('visible'); 
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const state = window.AppState;
        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));

        const id = document.getElementById('trainId').value;
        const trackSelectValue = document.getElementById('trackSelect').value;
        
        if (!trackSelectValue || !trackSelectValue.includes('-')) {
            if (typeof showNotification !== 'undefined') {
                showNotification('⚠️ Spår måste väljas', 'warning', 5000);
            }
            return;
        }
        
        const [trackIdStr, subTrackIndexStr] = trackSelectValue.split('-');
        const trackId = parseInt(trackIdStr);
        const subTrackIndex = parseInt(subTrackIndexStr);

        const vehicleTypeID = document.getElementById('vehicleTypeSelect').value;
        const vehicleCount = parseInt(document.getElementById('vehicleCount').value) || 1;

        const serviceData = {
            arrivalTrainNumber: document.getElementById('arrivalTrainNumber').value,
            departureTrainNumber: document.getElementById('departureTrainNumber').value,
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value,
            scheduledArrivalTime: document.getElementById('startTime').value,
            scheduledDepartureTime: document.getElementById('endTime').value,
            trackId: trackId,
            subTrackIndex: subTrackIndex,
            trainSet: {
                vehicleTypeID: vehicleTypeID,
                count: vehicleCount
            }
        };
        serviceData.startTime = serviceData.scheduledArrivalTime;
        serviceData.endTime = serviceData.scheduledDepartureTime;
        serviceData.trainNumber = serviceData.arrivalTrainNumber;

        // Enhanced validation using utils.js
        if (typeof validateTrainData === 'function') {
            const validation = validateTrainData(serviceData);
            if (!validation.valid) {
                const errorMessage = validation.errors.length > 1 
                    ? `⚠️ Flera fel:\n• ${validation.errors.join('\n• ')}`
                    : `⚠️ ${validation.errors[0]}`;
                
                if (typeof showNotification !== 'undefined') {
                    showNotification(errorMessage, 'warning', 6000);
                }
                return;
            }
        }

        const customColor = document.getElementById('color').value;
        const defaultColor = window.getTrainSetColor(serviceData.trainSet);
        if (customColor.toLowerCase() !== defaultColor.toLowerCase()) {
            serviceData.color = customColor;
        } else {
            delete serviceData.color;
        }

        if (id) {
            const index = state.trains.findIndex(t => t.id == id);
            if (index !== -1) {
                const oldService = state.trains[index];
                state.trains[index] = { ...oldService, ...serviceData };
                if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
                    window.saveAndLog(historyEngine.actionTypes.TRAIN_EDIT,
                        `Redigerade tjänst ${serviceData.arrivalTrainNumber}`, dataBefore);
                }
                if (typeof showNotification !== 'undefined') showNotification('Tjänst uppdaterad', 'success');
            }
        } else {
            serviceData.id = state.nextTrainId++;
            state.trains.push(serviceData);
            if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
                window.saveAndLog(historyEngine.actionTypes.TRAIN_ADD,
                    `Lade till tjänst ${serviceData.arrivalTrainNumber}`, dataBefore);
            }
            if (typeof showNotification !== 'undefined') showNotification('Tjänst tillagd', 'success');
        }

        closeTrainModal();
        if (typeof render !== 'undefined') render();
    }

    function handleDeleteTrain(trainId) {
        const state = window.AppState;
        const lang = window.AppLang;
        
        if (confirm(lang.confirmDelete)) {
            const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));
            const service = state.trains.find(t => t.id === trainId);
            const displayNumber = service ? (service.arrivalTrainNumber || service.trainNumber || trainId) : trainId;

            state.trains = state.trains.filter(t => t.id !== trainId);
            if (state.selectedTrainId === trainId) {
                if (typeof clearSelection !== 'undefined') clearSelection();
            }
            if (typeof render !== 'undefined') render();

            if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
                window.saveAndLog(historyEngine.actionTypes.TRAIN_DELETE,
                    `Tog bort tjänst ${displayNumber}`, dataBefore);
            }
            if (typeof showNotification !== 'undefined') showNotification('Tjänst borttagen', 'success');
        }
    }

    function handleSplitTrain(trainId) {
        const state = window.AppState;
        const originalServiceIndex = state.trains.findIndex(t => t.id === trainId);
        if (originalServiceIndex === -1) return;

        const originalService = state.trains[originalServiceIndex];

        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));
        const start = window.timeToMinutes(originalService.scheduledArrivalTime);
        const end = window.timeToMinutes(originalService.scheduledDepartureTime);
        const duration = end - start;

        if (duration < 20) {
            alert('Tjänsten är för kort för att delas (minst 20 minuter).');
            return;
        }

        const splitPoint = start + Math.floor(duration / 2);

        // Store original train numbers for connection history
        const originalArrivalNumber = originalService.arrivalTrainNumber || originalService.trainNumber;
        const originalDepartureNumber = originalService.departureTrainNumber || originalService.trainNumber;

        // First part (arrival service) - keeps arrival number only
        const arrivalService = {
            ...originalService,
            scheduledDepartureTime: window.minutesToTime(splitPoint),
            endTime: window.minutesToTime(splitPoint),
            departureTrainNumber: '', // Remove departure number
            // Add connection history
            connectionHistory: {
                type: 'split_from',
                originalService: {
                    arrivalNumber: originalArrivalNumber,
                    departureNumber: originalDepartureNumber
                },
                connectedTo: originalDepartureNumber,
                splitTimestamp: new Date().toISOString()
            }
        };

        // Second part (departure service) - keeps departure number only  
        const departureService = {
            ...originalService,
            id: state.nextTrainId++,
            scheduledArrivalTime: window.minutesToTime(splitPoint),
            startTime: window.minutesToTime(splitPoint),
            scheduledDepartureTime: window.minutesToTime(end),
            endTime: window.minutesToTime(end),
            arrivalTrainNumber: '', // Remove arrival number
            // Add connection history
            connectionHistory: {
                type: 'split_from',
                originalService: {
                    arrivalNumber: originalArrivalNumber,
                    departureNumber: originalDepartureNumber
                },
                connectedTo: originalArrivalNumber,
                splitTimestamp: new Date().toISOString()
            }
        };

        state.trains.splice(originalServiceIndex, 1, arrivalService, departureService);
        state.nextTrainId = window.calculateNextId(state.trains);

        if (typeof render !== 'undefined') render();

        const displayNumber = originalArrivalNumber || trainId;
        if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
            window.saveAndLog(historyEngine.actionTypes.TRAIN_SPLIT,
                `Delade tjänst ${displayNumber}`, dataBefore);
        }
        if (typeof showNotification !== 'undefined') showNotification(`Tjänst ${displayNumber} delad i två separata tjänster`, 'success');
    }

    function initiateSwap(trainId) {
        const state = window.AppState;
        const lang = window.AppLang;
        
        state.swappingState.active = true;
        state.swappingState.sourceTrainId = trainId;
        if (typeof setSelectedTrain !== 'undefined') setSelectedTrain(trainId);
        if (typeof showNotification !== 'undefined') showNotification(lang.swapPrompt, 'info', 10000);
        if (typeof render !== 'undefined') render();
    }

    function populateVehicleTypeSelect() {
        const select = document.getElementById('vehicleTypeSelect');
        select.innerHTML = '<option value="">Välj fordonstyp</option>';
        if (typeof vehicleDefinitions === 'undefined') { 
            console.error("vehicleDefinitions not loaded."); 
            return; 
        }
        Object.entries(vehicleDefinitions).forEach(([id, def]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${def.name} - ${def.description}`;
            select.appendChild(option);
        });
    }

    function updateVehicleTypeInfo() {
        const select = document.getElementById('vehicleTypeSelect');
        const infoDiv = document.getElementById('vehicleTypeInfo');
        const countInput = document.getElementById('vehicleCount');

        if (!select.value || typeof getVehicleDefinition === 'undefined') {
            infoDiv.style.display = 'none'; 
            return;
        }
        const vehicleDef = getVehicleDefinition(select.value);
        if (vehicleDef) {
            const count = parseInt(countInput.value) || 1;
            const totalLength = vehicleDef.baseLengthMeters * count;
            infoDiv.style.display = 'block';
            infoDiv.innerHTML = `<strong>${vehicleDef.name}</strong> - ${vehicleDef.description}<br>
                               Längd per enhet: ${vehicleDef.baseLengthMeters}m<br>
                               Total längd: ${totalLength}m<br>
                               Kan multipliceras: ${vehicleDef.canBeMultiple ? 'Ja' : 'Nej'}`;
            countInput.max = vehicleDef.canBeMultiple ? 3 : 1;
            if (!vehicleDef.canBeMultiple && count > 1) {
                countInput.value = 1; 
                updateVehicleTypeInfo();
            }
        } else { 
            infoDiv.style.display = 'none'; 
        }
    }

    function updateTrackCapacityInfo() {
        const trackSelect = document.getElementById('trackSelect');
        const vehicleSelect = document.getElementById('vehicleTypeSelect');
        const countInput = document.getElementById('vehicleCount');
        const infoDiv = document.getElementById('trackCapacityInfo');

        if (!trackSelect.value || !vehicleSelect.value || typeof getTrackCapacityStatus === 'undefined') {
            infoDiv.style.display = 'none'; 
            return;
        }
        const [trackIdStr] = trackSelect.value.split('-');
        const trackId = parseInt(trackIdStr);
        const count = parseInt(countInput.value) || 1;
        const trainSet = { vehicleTypeID: vehicleSelect.value, count: count };
        const capacityStatus = getTrackCapacityStatus(trainSet, trackId);

        infoDiv.style.display = 'block';
        infoDiv.className = `track-capacity-info ${capacityStatus.status}`;
        infoDiv.textContent = capacityStatus.message;
    }

    function updateUndoRedoButtons() {
        if (typeof historyEngine === 'undefined') return;
        const state = window.AppState;
        const status = historyEngine.getUndoRedoStatus(state);
        const undoButton = document.getElementById('undoButton');
        const redoButton = document.getElementById('redoButton');
        undoButton.disabled = !status.canUndo;
        redoButton.disabled = !status.canRedo;
        undoButton.title = status.canUndo ? `Ångra: ${status.undoDescription}` : 'Inga åtgärder att ångra';
        redoButton.title = status.canRedo ? `Gör om: ${status.redoDescription}` : 'Inga åtgärder att upprepa';
    }

    function updateHistoryPanel() {
        console.log('🔄 updateHistoryPanel called');
        if (typeof historyEngine === 'undefined') {
            console.warn('historyEngine is undefined');
            return;
        }
        const state = window.AppState;
        const content = document.getElementById('historyContent');
        if (!content) {
            console.error('historyContent element not found');
            return;
        }
        const summary = historyEngine.getHistorySummary(state);
        console.log('📋 History summary:', summary);
        content.innerHTML = '';
        if (summary.length === 0) {
            content.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary);">Ingen historik ännu. Utför några åtgärder så fylls denna lista.</div>'; 
            return;
        }
        summary.slice().reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = `history-item ${item.isCurrent ? 'current' : ''}`;
            div.innerHTML = `<div class="history-item-time">${item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                             <div class="history-item-description">${item.description}</div>
                             <div class="history-item-type">${item.type}</div>`;
            div.addEventListener('click', () => {
                if (confirm(`Återgå till: ${item.description}? Nuvarande ändringar efter detta kommer att förloras om du gör nya ändringar.`)) {
                    historyEngine.revertToAction(state, item.index);
                    if (typeof render !== 'undefined') render(); 
                    updateUndoRedoButtons(); 
                    updateHistoryPanel();
                    if (typeof showNotification !== 'undefined') {
                        showNotification(`Återgick till: ${item.description}`, 'success');
                    }
                }
            });
            content.appendChild(div);
        });
    }

    function setupModalEventListeners() {
        const trainForm = window.AppElements.trainForm;
        const cancelButton = document.getElementById('cancelButton');
        const vehicleTypeSelect = document.getElementById('vehicleTypeSelect');
        const vehicleCount = document.getElementById('vehicleCount');
        const trackSelect = document.getElementById('trackSelect');

        trainForm.addEventListener('submit', handleFormSubmit);
        cancelButton.addEventListener('click', closeTrainModal);

        vehicleTypeSelect.addEventListener('change', updateVehicleTypeInfo);
        vehicleCount.addEventListener('input', updateVehicleTypeInfo);
        trackSelect.addEventListener('change', updateTrackCapacityInfo);
        vehicleTypeSelect.addEventListener('change', updateTrackCapacityInfo);
        vehicleCount.addEventListener('input', updateTrackCapacityInfo);
    }

    // Expose functions globally
    window.openTrainModalForAdd = openTrainModalForAdd;
    window.openTrainModalForEdit = openTrainModalForEdit;
    window.closeTrainModal = closeTrainModal;
    window.handleFormSubmit = handleFormSubmit;
    window.handleDeleteTrain = handleDeleteTrain;
    window.handleSplitTrain = handleSplitTrain;
    window.initiateSwap = initiateSwap;
    window.populateVehicleTypeSelect = populateVehicleTypeSelect;
    window.updateVehicleTypeInfo = updateVehicleTypeInfo;
    window.updateTrackCapacityInfo = updateTrackCapacityInfo;
    window.updateUndoRedoButtons = updateUndoRedoButtons;
    window.updateHistoryPanel = updateHistoryPanel;
    window.setupModalEventListeners = setupModalEventListeners;

})(); 