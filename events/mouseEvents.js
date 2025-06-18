// Mouse Events, Drag/Drop, and Resize Handlers
(function() {
    'use strict';

    function handleGridMouseDown(e) {
        const trainBar = e.target.closest('.train-bar');
        if (!trainBar) {
            return;
        }
        e.preventDefault(); 
        e.stopPropagation();

        const trainId = parseInt(trainBar.dataset.trainId);
        window.setSelectedTrain(trainId);

        const state = window.AppState;
        if (state.swappingState.active && state.swappingState.sourceTrainId !== trainId) {
            window.handleSwap(state.swappingState.sourceTrainId, trainId); 
            return;
        }

        const isResizeLeft = e.target.classList.contains('resize-handle') && e.target.classList.contains('left');
        const isResizeRight = e.target.classList.contains('resize-handle') && e.target.classList.contains('right');

        if (isResizeLeft || isResizeRight) {
            initResize(e, trainId, isResizeLeft ? 'left' : 'right');
        } else {
            // Store initial mouse position to detect if this is a click or drag
            trainBar._mouseDownPos = { x: e.pageX, y: e.pageY };
            trainBar._mouseDownTime = Date.now();
            initDrag(e, trainId);
        }
    }

    function handleGridDoubleClick(e) {
        const trainBar = e.target.closest('.train-bar');
        if (trainBar && typeof openTrainModalForEdit !== 'undefined') {
            openTrainModalForEdit(parseInt(trainBar.dataset.trainId));
        }
    }

    function handleGridContextMenu(e) {
        e.preventDefault();
        const trainBar = e.target.closest('.train-bar');
        if (trainBar) {
            const trainId = parseInt(trainBar.dataset.trainId);
            window.setSelectedTrain(trainId);
            window.showContextMenu(e.pageX, e.pageY, trainId);
        } else {
            window.hideContextMenu();
        }
    }

    function initDrag(e, trainId) {
        const state = window.AppState;
        const service = state.trains.find(t => t.id === trainId);
        if (!service) {
            console.warn(`Cannot find train with ID: ${trainId}`);
            if (typeof showNotification !== 'undefined') {
                showNotification('Fel: Kan inte hitta tågtjänsten', 'error');
            }
            return;
        }

        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));
        const trainBar = document.querySelector(`.train-bar[data-train-id='${trainId}']`);
        const startYmouse = e.pageY;
        const initialTop = trainBar.offsetTop;
        trainBar.style.zIndex = '100';
        
        // Pre-cache track containers for better performance
        const trackContainers = Array.from(window.AppElements.scheduleGrid.querySelectorAll('.track-container'));

        let lastUpdateTime = 0;
        function onMouseMove(moveEvent) {
            // Throttle updates to improve performance
            const now = Date.now();
            if (now - lastUpdateTime < 16) return; // ~60fps limit
            lastUpdateTime = now;
            
            trainBar.style.top = `${initialTop + (moveEvent.pageY - startYmouse)}px`;
        }

        function onMouseUp(upEvent) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            trainBar.style.zIndex = '10';

            // Check if this was a click rather than a drag
            const timeDiff = Date.now() - (trainBar._mouseDownTime || 0);
            const mousePos = trainBar._mouseDownPos || { x: 0, y: 0 };
            const distanceMoved = Math.sqrt(
                Math.pow(upEvent.pageX - mousePos.x, 2) + 
                Math.pow(upEvent.pageY - mousePos.y, 2)
            );

            // If it was a quick click with minimal movement, show train data panel
            if (timeDiff < 300 && distanceMoved < 5) {
                if (typeof showTrainDataPanel === 'function') {
                    showTrainDataPanel(trainId);
                }
                if (typeof render !== 'undefined') render();
                return;
            }

            const newTop = trainBar.offsetTop;

            let newTrackIdNumeric = service.trackId;
            let newSubTrackIndex = service.subTrackIndex;

            const targetTrackContainer = trackContainers.find(tc =>
                newTop >= tc.offsetTop && newTop < tc.offsetTop + tc.offsetHeight
            );

            if (targetTrackContainer) {
                newTrackIdNumeric = parseInt(targetTrackContainer.dataset.trackId);
                const trackDef = getTrackDefinition(newTrackIdNumeric);
                if (trackDef) {
                    const subTrackPixelHeight = state.trackHeight;
                    let relativeTopInTrack = newTop - targetTrackContainer.offsetTop;
                    newSubTrackIndex = Math.floor(relativeTopInTrack / subTrackPixelHeight);
                    newSubTrackIndex = Math.max(0, Math.min(trackDef.subTrackCount - 1, newSubTrackIndex));
                } else {
                    console.warn(`Could not find track definition for dragged track ID: ${newTrackIdNumeric}`);
                    if (typeof render !== 'undefined') render();
                    return;
                }
            } else {
                if (typeof render !== 'undefined') render();
                return;
            }

            const oldTrackId = service.trackId;
            const oldSubTrackIndex = service.subTrackIndex;

            // Only update track position, not time - times can be adjusted via resize handles or editing
            if (newTrackIdNumeric !== oldTrackId || newSubTrackIndex !== oldSubTrackIndex) {
                service.trackId = newTrackIdNumeric;
                service.subTrackIndex = newSubTrackIndex;

                const displayNumber = service.arrivalTrainNumber || service.trainNumber || service.id;
                const publicTrackNumForLog = getTrackDefinition(newTrackIdNumeric)?.publicTrackNumber || newTrackIdNumeric;
                
                if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
                    window.saveAndLog(historyEngine.actionTypes.TRAIN_MOVE,
                        `Flyttade ${displayNumber} till spår ${publicTrackNumForLog}-${newSubTrackIndex + 1}`, dataBefore);
                }
            }
            if (typeof render !== 'undefined') render();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function initResize(e, trainId, handle) {
        const state = window.AppState;
        const service = state.trains.find(t => t.id === trainId);
        if (!service) return;

        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));
        const trainBar = document.querySelector(`.train-bar[data-train-id='${trainId}']`);
        const startX = e.pageX;
        const initialWidth = trainBar.offsetWidth;
        const initialLeft = trainBar.offsetLeft;
        trainBar.style.zIndex = '100';

        function onMouseMove(moveEvent) {
            const dx = moveEvent.pageX - startX;
            const minWidthPixels = window.AppConfig.snapMinutes * state.pixelsPerMinute;

            if (handle === 'right') {
                const newWidth = initialWidth + dx;
                trainBar.style.width = `${Math.max(minWidthPixels, newWidth)}px`;
            } else {
                const newWidth = initialWidth - dx;
                const newLeft = initialLeft + dx;
                if (newWidth >= minWidthPixels) {
                    trainBar.style.left = `${newLeft}px`;
                    trainBar.style.width = `${newWidth}px`;
                } else {
                    trainBar.style.left = `${initialLeft + initialWidth - minWidthPixels}px`;
                    trainBar.style.width = `${minWidthPixels}px`;
                }
            }
        }

        function onMouseUp(upEvent) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            trainBar.style.zIndex = '10';

            let startPixelOffset = trainBar.offsetLeft;
            let endPixelOffset = trainBar.offsetLeft + trainBar.offsetWidth;

            let newStartMinutes = Math.round((startPixelOffset / state.pixelsPerMinute) / window.AppConfig.snapMinutes) * window.AppConfig.snapMinutes;
            let newEndMinutes = Math.round((endPixelOffset / state.pixelsPerMinute) / window.AppConfig.snapMinutes) * window.AppConfig.snapMinutes;

            newStartMinutes += state.currentStartHour * 60;
            newEndMinutes += state.currentStartHour * 60;

            if (newEndMinutes <= newStartMinutes) {
                newEndMinutes = newStartMinutes + window.AppConfig.snapMinutes;
            }

            const oldStartMinutes = window.timeToMinutes(service.scheduledArrivalTime);
            const oldEndMinutes = window.timeToMinutes(service.scheduledDepartureTime);

            if (Math.abs(newStartMinutes - oldStartMinutes) >= window.AppConfig.snapMinutes ||
                Math.abs(newEndMinutes - oldEndMinutes) >= window.AppConfig.snapMinutes) {

                service.scheduledArrivalTime = window.minutesToTime(newStartMinutes);
                service.scheduledDepartureTime = window.minutesToTime(newEndMinutes);
                service.startTime = service.scheduledArrivalTime;
                service.endTime = service.scheduledDepartureTime;

                const displayNumber = service.arrivalTrainNumber || service.trainNumber || service.id;
                const duration = Math.round((newEndMinutes - newStartMinutes));
                
                if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
                    window.saveAndLog(historyEngine.actionTypes.TRAIN_RESIZE,
                        `Ändrade längd på ${displayNumber} till ${duration} minuter`, dataBefore);
                }
            }
            if (typeof render !== 'undefined') render();
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function handleSwap(trainIdA, trainIdB) {
        const state = window.AppState;
        const serviceAIndex = state.trains.findIndex(t => t.id === trainIdA);
        const serviceBIndex = state.trains.findIndex(t => t.id === trainIdB);

        if (serviceAIndex === -1 || serviceBIndex === -1) {
            state.swappingState.active = false;
            state.swappingState.sourceTrainId = null;
            if (typeof render !== 'undefined') render();
            return;
        }

        const dataBefore = (typeof historyEngine !== 'undefined') ? historyEngine.deepClone(state.trains) : JSON.parse(JSON.stringify(state.trains));

        const serviceA = state.trains[serviceAIndex];
        const serviceB = state.trains[serviceBIndex];

        const barA = document.querySelector(`.train-bar[data-train-id='${trainIdA}']`);
        const barB = document.querySelector(`.train-bar[data-train-id='${trainIdB}']`);
        if (barA) barA.classList.add('swapped-out');
        if (barB) barB.classList.add('swapped-out');

        const tempTimesAndPosition = {
            scheduledArrivalTime: serviceA.scheduledArrivalTime,
            scheduledDepartureTime: serviceA.scheduledDepartureTime,
            trackId: serviceA.trackId,
            subTrackIndex: serviceA.subTrackIndex,
            startTime: serviceA.startTime,
            endTime: serviceA.endTime
        };

        serviceA.scheduledArrivalTime = serviceB.scheduledArrivalTime;
        serviceA.scheduledDepartureTime = serviceB.scheduledDepartureTime;
        serviceA.trackId = serviceB.trackId;
        serviceA.subTrackIndex = serviceB.subTrackIndex;
        serviceA.startTime = serviceB.startTime;
        serviceA.endTime = serviceB.endTime;

        serviceB.scheduledArrivalTime = tempTimesAndPosition.scheduledArrivalTime;
        serviceB.scheduledDepartureTime = tempTimesAndPosition.scheduledDepartureTime;
        serviceB.trackId = tempTimesAndPosition.trackId;
        serviceB.subTrackIndex = tempTimesAndPosition.subTrackIndex;
        serviceB.startTime = tempTimesAndPosition.startTime;
        serviceB.endTime = tempTimesAndPosition.endTime;

        state.swappingState.active = false;
        state.swappingState.sourceTrainId = null;
        window.clearSelection();

        const displayA = serviceA.arrivalTrainNumber || serviceA.trainNumber || trainIdA;
        const displayB = serviceB.arrivalTrainNumber || serviceB.trainNumber || trainIdB;

        if (typeof window.saveAndLog !== 'undefined' && typeof historyEngine !== 'undefined') {
            window.saveAndLog(historyEngine.actionTypes.TRAIN_SWAP,
                `Bytte plats mellan ${displayA} och ${displayB}`, dataBefore);
        }
        
        if (typeof showNotification !== 'undefined') {
            showNotification(`Bytte plats mellan ${displayA} och ${displayB}`, 'success');
        }

        setTimeout(() => {
            if (typeof render !== 'undefined') render();
            const newBarA = document.querySelector(`.train-bar[data-train-id='${trainIdA}']`);
            const newBarB = document.querySelector(`.train-bar[data-train-id='${trainIdB}']`);
            if (newBarA) { newBarA.classList.remove('swapped-out'); newBarA.classList.add('swapped-in'); }
            if (newBarB) { newBarB.classList.remove('swapped-out'); newBarB.classList.add('swapped-in'); }

            setTimeout(() => {
                if (newBarA) newBarA.classList.remove('swapped-in');
                if (newBarB) newBarB.classList.remove('swapped-in');
            }, 500);
        }, 50);
    }

    // Expose functions globally
    window.handleGridMouseDown = handleGridMouseDown;
    window.handleGridDoubleClick = handleGridDoubleClick;
    window.handleGridContextMenu = handleGridContextMenu;
    window.initDrag = initDrag;
    window.initResize = initResize;
    window.handleSwap = handleSwap;

})(); 