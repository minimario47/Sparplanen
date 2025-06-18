// Rendering Logic - Timeline, Tracks, and Trains Visualization
(function() {
    'use strict';

    function render() {
        if (typeof trackDefinitions === 'undefined' || typeof vehicleDefinitions === 'undefined') {
            console.warn("Data definitions not yet loaded. Aborting render.");
            return;
        }
        if (typeof calculateDynamicSizing !== 'undefined') calculateDynamicSizing();
        renderTimeline();
        renderTracks();
        renderAllTrains();
        detectAllConflicts();
        updateCurrentTimeLine();
    }

    function renderTimeline() {
        const timelineHeader = window.AppElements.timelineHeader;
        const scheduleGrid = window.AppElements.scheduleGrid;
        const state = window.AppState;
        
        timelineHeader.innerHTML = '';
        
        const totalWidthPx = Math.round(state.viewHours * 60 * state.pixelsPerMinute);
        scheduleGrid.style.width = `${totalWidthPx}px`;

        const endHour = (state.currentStartHour + state.viewHours);
        const displayEndHour = endHour % 24 || (endHour > 0 ? 24 : 0);

        document.getElementById('currentTimeRange').textContent =
            `${String(state.currentStartHour).padStart(2, '0')}:00 - ${String(displayEndHour).padStart(2, '0')}:00`;

        for (let i = 0; i < state.viewHours; i++) {
            const actualHour = (state.currentStartHour + i) % 24;
            const hourMarker = document.createElement('div');
            hourMarker.className = 'hour-marker';
            hourMarker.textContent = `${String(actualHour).padStart(2, '0')}:00`;
            
            const hourWidthPx = Math.round(60 * state.pixelsPerMinute);
            hourMarker.style.width = `${hourWidthPx}px`;
            hourMarker.style.minWidth = `${hourWidthPx}px`;
            hourMarker.style.maxWidth = `${hourWidthPx}px`;
            hourMarker.style.flexShrink = '0';
            
            timelineHeader.appendChild(hourMarker);
        }
        
        // Force exact timeline width to match grid width
        timelineHeader.style.width = `${totalWidthPx}px`;
        timelineHeader.style.minWidth = `${totalWidthPx}px`;
    }

    function renderTracks() {
        const trackLabelsContainer = window.AppElements.trackLabelsContainer;
        const scheduleGrid = window.AppElements.scheduleGrid;
        const lang = window.AppLang;
        
        trackLabelsContainer.innerHTML = '';
        scheduleGrid.innerHTML = '';
        const trackSelect = document.getElementById('trackSelect');
        trackSelect.innerHTML = '';

        if (typeof trackDefinitions === 'undefined') {
            console.error("trackDefinitions is not available.");
            return;
        }

        trackDefinitions.forEach(trackDef => {
            const label = document.createElement('div');
            label.className = 'track-label';
            label.innerHTML = `
                <div class="track-name">${lang.track} ${trackDef.publicTrackNumber}</div>
                <div class="track-length">${trackDef.signalVisibleLengthMeters}m</div>
            `;
            label.title = `${trackDef.description}\nLängd: ${trackDef.totalLengthMeters}m\nSignalsikt: ${trackDef.signalVisibleLengthMeters}m`;
            label.dataset.trackId = trackDef.publicTrackNumber;
            label.style.cursor = 'pointer';
            trackLabelsContainer.appendChild(label);

            const trackContainer = document.createElement('div');
            trackContainer.className = 'track-container';
            trackContainer.dataset.trackId = trackDef.publicTrackNumber;
            scheduleGrid.appendChild(trackContainer);

            for (let j = 0; j < trackDef.subTrackCount; j++) {
                const option = document.createElement('option');
                option.value = `${trackDef.publicTrackNumber}-${j}`;
                option.textContent = `${lang.track} ${trackDef.publicTrackNumber} (Del ${j + 1}) - ${trackDef.signalVisibleLengthMeters}m`;
                trackSelect.appendChild(option);
            }
        });
    }

    function renderAllTrains() {
        const state = window.AppState;
        const scheduleGrid = window.AppElements.scheduleGrid;
        
        document.querySelectorAll('.train-bar').forEach(bar => bar.remove());
        state.trains.forEach(train => {
            const trainBar = createTrainBar(train);
            if (trainBar) {
                scheduleGrid.appendChild(trainBar);
            }
        });
    }

    function createTrainBar(service) {
        const state = window.AppState;
        const timeToMinutes = window.timeToMinutes;
        const scheduleGrid = window.AppElements.scheduleGrid;

        const startMinutes = timeToMinutes(service.scheduledArrivalTime);
        const endMinutes = timeToMinutes(service.scheduledDepartureTime);

        const windowStartMinutes = state.currentStartHour * 60;
        const windowEndMinutes = windowStartMinutes + (state.viewHours * 60);

        if (endMinutes <= windowStartMinutes || startMinutes >= windowEndMinutes) {
            return null;
        }

        const trackContainer = document.querySelector(`.track-container[data-track-id='${service.trackId}']`);
        if (!trackContainer) {
            console.error(`Could not find track container for trackId: ${service.trackId} (Service ID: ${service.id})`);
            return null;
        }

        const trainBar = document.createElement('div');
        trainBar.className = 'train-bar';
        trainBar.dataset.trainId = service.id;

        const relativeStartMinutes = Math.max(0, startMinutes - windowStartMinutes);
        const visibleEndMinutes = Math.min(endMinutes, windowEndMinutes);
        const visibleStartMinutes = Math.max(startMinutes, windowStartMinutes);
        const visibleDuration = visibleEndMinutes - visibleStartMinutes;

        // Ensure pixel-perfect alignment with timeline
        const leftPx = Math.round(relativeStartMinutes * state.pixelsPerMinute);
        const widthPx = Math.round(Math.max(0, visibleDuration * state.pixelsPerMinute));
        const topPx = Math.round(trackContainer.offsetTop + (service.subTrackIndex * state.trackHeight));

        trainBar.style.left = `${leftPx}px`;
        trainBar.style.width = `${widthPx}px`;
        trainBar.style.top = `${topPx}px`;

        const color = service.color || getTrainSetColor(service.trainSet);
        const trainSetName = getTrainSetDisplayName(service.trainSet);
        const trainLength = calculateTrainSetLength(service.trainSet);

        trainBar.style.backgroundColor = color;
        trainBar.style.borderColor = darkenColor(color, 20);

        // Extract arrival and departure train numbers
        const arrivalNumber = service.arrivalTrainNumber || service.trainNumber || '';
        const departureNumber = service.departureTrainNumber || service.trainNumber || '';
        
        // Handle cases where only one number exists (after splitting)
        const hasArrival = arrivalNumber && arrivalNumber.trim() !== '';
        const hasDeparture = departureNumber && departureNumber.trim() !== '';
        
        // Extract minutes from times for display
        const arrivalMinutes = service.scheduledArrivalTime ? service.scheduledArrivalTime.split(':')[1] : '00';
        const departureMinutes = service.scheduledDepartureTime ? service.scheduledDepartureTime.split(':')[1] : '00';

        // Display train numbers based on what's available
        let trainNumbersHTML;
        if (hasArrival && hasDeparture && arrivalNumber !== departureNumber) {
            // Both numbers exist and are different (normal case)
            trainNumbersHTML = `
                <span class="arrival-number">${arrivalNumber}</span>
                <span class="departure-number">${departureNumber}</span>
            `;
        } else if (hasArrival && !hasDeparture) {
            // Only arrival number (arrival service after split)
            trainNumbersHTML = `<span class="arrival-number">${arrivalNumber}</span>`;
        } else if (!hasArrival && hasDeparture) {
            // Only departure number (departure service after split)
            trainNumbersHTML = `<span class="departure-number">${departureNumber}</span>`;
        } else {
            // Same number for both or fallback
            trainNumbersHTML = `<span class="arrival-number">${arrivalNumber || departureNumber}</span>`;
        }

        trainBar.innerHTML = `
            <div class="resize-handle left"></div>
            <div class="train-numbers">
                ${trainNumbersHTML}
            </div>
            <div class="resize-handle right"></div>
            <div class="time-indicators">
                <span class="arrival-minutes">${arrivalMinutes}</span>
                <span class="departure-minutes">${departureMinutes}</span>
            </div>
        `;

        const trackDef = getTrackDefinition(service.trackId);
        const capacityStatus = getTrackCapacityStatus(service.trainSet, service.trackId);
        const publicTrackNum = trackDef ? trackDef.publicTrackNumber : service.trackId;

        // Create display number for tooltip
        let displayNumber;
        if (hasArrival && hasDeparture && arrivalNumber !== departureNumber) {
            displayNumber = `${arrivalNumber}/${departureNumber}`;
        } else {
            displayNumber = arrivalNumber || departureNumber || `Tjänst ${service.id}`;
        }
        trainBar.title = `Tjänst: ${displayNumber}
Från: ${service.origin}
Till: ${service.destination}
Ankomst: ${service.scheduledArrivalTime}
Avgång: ${service.scheduledDepartureTime}
Spår: ${publicTrackNum}-${service.subTrackIndex + 1}
Fordon: ${trainSetName}
Längd: ${trainLength}m
${capacityStatus.message}`;

        if (service.id === state.selectedTrainId) trainBar.classList.add('selected');
        if (state.swappingState.active && service.id === state.swappingState.sourceTrainId) {
            trainBar.classList.add('swapping');
        }

        return trainBar;
    }

    function detectAllConflicts() {
        const state = window.AppState;
        const config = window.AppConfig;
        const timeToMinutes = window.timeToMinutes;

        document.querySelectorAll('.train-bar').forEach(bar => {
            bar.classList.remove('conflicting', 'proximity-warning', 'length-warning', 'length-impossible');
        });

        const trackMap = new Map();
        state.trains.forEach(service => {
            const key = `${service.trackId}-${service.subTrackIndex}`;
            if (!trackMap.has(key)) trackMap.set(key, []);
            trackMap.get(key).push(service);
        });

        trackMap.forEach((servicesOnTrack) => {
            servicesOnTrack.sort((a, b) =>
                timeToMinutes(a.scheduledArrivalTime) - timeToMinutes(b.scheduledArrivalTime)
            );

            for (let i = 0; i < servicesOnTrack.length; i++) {
                const service1 = servicesOnTrack[i];
                checkLengthConstraints(service1);

                if (i < servicesOnTrack.length - 1) {
                    const service2 = servicesOnTrack[i+1];
                    const service1End = timeToMinutes(service1.scheduledDepartureTime);
                    const service2Start = timeToMinutes(service2.scheduledArrivalTime);
                    const turnaroundTime = service2Start - service1End;

                    if (turnaroundTime < 0) {
                        document.querySelector(`.train-bar[data-train-id='${service1.id}']`)?.classList.add('conflicting');
                        document.querySelector(`.train-bar[data-train-id='${service2.id}']`)?.classList.add('conflicting');
                    } else if (turnaroundTime >= 0 && turnaroundTime <= config.proximityWarningMinutes) {
                        document.querySelector(`.train-bar[data-train-id='${service1.id}']`)?.classList.add('proximity-warning');
                        document.querySelector(`.train-bar[data-train-id='${service2.id}']`)?.classList.add('proximity-warning');
                    }
                }
            }
        });
    }

    function checkLengthConstraints(service) {
        const capacityStatus = getTrackCapacityStatus(service.trainSet, service.trackId);
        const trainBar = document.querySelector(`.train-bar[data-train-id='${service.id}']`);
        if (!trainBar) return;

        if (capacityStatus.status === 'impossible') {
            trainBar.classList.add('length-impossible');
        } else if (capacityStatus.status === 'warning') {
            trainBar.classList.add('length-warning');
        }
    }

    // Helper functions for train visualization
    function getTrainSetColor(trainSet) {
        if (!trainSet || !trainSet.vehicleTypeID || typeof getVehicleDefinition === 'undefined') return '#3498db';
        const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
        return vehicleDef ? (vehicleDef.color || '#3498db') : '#3498db';
    }

    function getTrainSetDisplayName(trainSet) {
        if (!trainSet || !trainSet.vehicleTypeID || typeof getVehicleDefinition === 'undefined') return 'Okänt';
        const vehicleDef = getVehicleDefinition(trainSet.vehicleTypeID);
        let name = vehicleDef ? vehicleDef.name : 'Okänt fordon';
        if (trainSet.count > 1) name += ` x${trainSet.count}`;
        return name;
    }

    function darkenColor(hex, percent) {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 4) return '#000000';
        let R = 0, G = 0, B = 0;
        if (hex.length === 4) {
            R = parseInt(hex[1] + hex[1], 16); G = parseInt(hex[2] + hex[2], 16); B = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            R = parseInt(hex.slice(1, 3), 16); G = parseInt(hex.slice(3, 5), 16); B = parseInt(hex.slice(5, 7), 16);
        } else { return '#000000'; }
        R = Math.max(0, Math.floor(R * (100 - percent) / 100));
        G = Math.max(0, Math.floor(G * (100 - percent) / 100));
        B = Math.max(0, Math.floor(B * (100 - percent) / 100));
        return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`;
    }

    // Expose functions globally
    // Current time indicator functionality
    let currentTimeUpdateInterval;
    
    function createCurrentTimeIndicators() {
        // Create current time line for timeline header
        let timelineIndicator = document.querySelector('.timeline-current-time');
        if (!timelineIndicator) {
            timelineIndicator = document.createElement('div');
            timelineIndicator.className = 'timeline-current-time';
            window.AppElements.timelineHeader.appendChild(timelineIndicator);
        }
        
        // Create current time line for schedule grid
        let gridIndicator = document.querySelector('.current-time-line');
        if (!gridIndicator) {
            gridIndicator = document.createElement('div');
            gridIndicator.className = 'current-time-line';
            window.AppElements.scheduleGrid.appendChild(gridIndicator);
        }
        
        return { timelineIndicator, gridIndicator };
    }
    
    function updateCurrentTimeLine() {
        const state = window.AppState;
        const timeToMinutes = window.timeToMinutes;
        
        if (!state || !timeToMinutes) return;
        
        const indicators = createCurrentTimeIndicators();
        
        // Get current time
        const now = new Date();
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentMinutes = timeToMinutes(currentTimeStr);
        
        // Calculate window boundaries
        const windowStartMinutes = state.currentStartHour * 60;
        const windowEndMinutes = windowStartMinutes + (state.viewHours * 60);
        
        // Check if current time is within visible window
        const isVisible = currentMinutes >= windowStartMinutes && currentMinutes <= windowEndMinutes;
        
        if (isVisible) {
            // Calculate position
            const relativeMinutes = currentMinutes - windowStartMinutes;
            const leftPosition = Math.round(relativeMinutes * state.pixelsPerMinute);
            
            // Show tip first time current time line becomes visible
            const wasHidden = indicators.gridIndicator.classList.contains('hidden');
            
            // Update position for both indicators
            indicators.timelineIndicator.style.left = `${leftPosition}px`;
            indicators.gridIndicator.style.left = `${leftPosition}px`;
            
            // Add current time text
            indicators.gridIndicator.setAttribute('data-time', currentTimeStr);
            
            // Show indicators
            indicators.timelineIndicator.classList.remove('hidden');
            indicators.gridIndicator.classList.remove('hidden');
            
            // Show feature tip when current time line first appears
            if (wasHidden && typeof showFeatureTip === 'function') {
                setTimeout(() => {
                    showFeatureTip('currenttime');
                }, 1000);
            }
        } else {
            // Hide indicators when current time is outside visible window
            indicators.timelineIndicator.classList.add('hidden');
            indicators.gridIndicator.classList.add('hidden');
        }
    }
    
    function startCurrentTimeUpdates() {
        // Clear any existing interval
        if (currentTimeUpdateInterval) {
            clearInterval(currentTimeUpdateInterval);
        }
        
        // Update immediately
        updateCurrentTimeLine();
        
        // Update every 15 seconds
        currentTimeUpdateInterval = setInterval(() => {
            updateCurrentTimeLine();
        }, 15000);
    }
    
    function stopCurrentTimeUpdates() {
        if (currentTimeUpdateInterval) {
            clearInterval(currentTimeUpdateInterval);
            currentTimeUpdateInterval = null;
        }
    }

    window.render = render;
    window.renderTimeline = renderTimeline;
    window.renderTracks = renderTracks;
    window.renderAllTrains = renderAllTrains;
    window.createTrainBar = createTrainBar;
    window.detectAllConflicts = detectAllConflicts;
    window.checkLengthConstraints = checkLengthConstraints;
    window.getTrainSetColor = getTrainSetColor;
    window.getTrainSetDisplayName = getTrainSetDisplayName;
    window.darkenColor = darkenColor;
    window.updateCurrentTimeLine = updateCurrentTimeLine;
    window.startCurrentTimeUpdates = startCurrentTimeUpdates;
    window.stopCurrentTimeUpdates = stopCurrentTimeUpdates;

})(); 