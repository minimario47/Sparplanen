// Track Data Handlers
(function() {
    'use strict';

    function handleTrackClick(e) {
        const trackLabel = e.target.closest('.track-label');
        if (!trackLabel) return;
        
        const trackId = parseInt(trackLabel.dataset.trackId);
        if (trackId) {
            showTrackDataPanel(trackId);
        }
    }

    function showTrackDataPanel(trackId) {
        const trackDef = getTrackDefinition(trackId);
        if (!trackDef) {
            if (typeof showNotification !== 'undefined') {
                showNotification('Spårdata inte tillgänglig', 'error');
            }
            return;
        }

        const panel = document.getElementById('trackDataPanel');
        const title = document.getElementById('trackDataTitle');
        const content = document.getElementById('trackDataContent');
        
        if (!panel || !title || !content) {
            console.error('Track data panel elements not found');
            return;
        }

        title.textContent = `Spår ${trackDef.publicTrackNumber} - Data`;

        const state = window.AppState;
        const trainsOnTrack = state.trains.filter(train => train.trackId === trackId);
        
        // Sort trains by arrival time
        const sortedTrains = trainsOnTrack.sort((a, b) => 
            window.timeToMinutes(a.scheduledArrivalTime) - window.timeToMinutes(b.scheduledArrivalTime)
        );

        // Build track data content
        content.innerHTML = `
            <div class="track-info-section">
                <h3>Grundläggande information</h3>
                <div class="track-info-item">
                    <span class="track-info-label">Spårnummer:</span>
                    <span class="track-info-value">${trackDef.publicTrackNumber}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Total längd:</span>
                    <span class="track-info-value">${trackDef.totalLengthMeters}m</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Signalsikt:</span>
                    <span class="track-info-value">${trackDef.signalVisibleLengthMeters}m</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Antal delspår:</span>
                    <span class="track-info-value">${trackDef.subTrackCount}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Beskrivning:</span>
                    <span class="track-info-value">${trackDef.description}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Egenskaper:</span>
                    <span class="track-info-value">${trackDef.properties.join(', ')}</span>
                </div>
            </div>

            <div class="track-info-section">
                <h3>Aktuell användning</h3>
                <div class="track-info-item">
                    <span class="track-info-label">Antal tjänster:</span>
                    <span class="track-info-value">${trainsOnTrack.length}</span>
                </div>
                ${generateUtilizationInfo(trackDef, trainsOnTrack)}
            </div>

            <div class="track-info-section">
                <h3>Tjänster på spåret</h3>
                <div class="track-trains-list">
                    ${sortedTrains.length > 0 ? 
                        sortedTrains.map(train => generateTrainItem(train)).join('') :
                        '<div class="no-trains">Inga tjänster på detta spår just nu</div>'
                    }
                </div>
            </div>
        `;

        // Add click event listeners to train items
        setTimeout(() => {
            const trainItems = content.querySelectorAll('.track-train-item');
            trainItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const trainId = parseInt(item.dataset.trainId);
                    if (trainId && typeof setSelectedTrain === 'function') {
                        setSelectedTrain(trainId);
                        if (typeof render === 'function') render();
                        if (typeof showNotification === 'function') {
                            const train = window.AppState.trains.find(t => t.id === trainId);
                            const displayNumber = train ? (train.arrivalTrainNumber || train.trainNumber || trainId) : trainId;
                            showNotification(`Valde tjänst ${displayNumber}`, 'info', 2000);
                        }
                    }
                });
            });
        }, 0);

        panel.classList.add('visible');
    }

    function generateUtilizationInfo(trackDef, trains) {
        if (trains.length === 0) {
            return `
                <div class="track-info-item">
                    <span class="track-info-label">Utnyttjande:</span>
                    <span class="track-info-value">0%</span>
                </div>
            `;
        }

        // Calculate total train length
        const totalTrainLength = trains.reduce((sum, train) => {
            return sum + calculateTrainSetLength(train.trainSet);
        }, 0);

        const utilization = Math.round((totalTrainLength / trackDef.signalVisibleLengthMeters) * 100);
        const utilizationClass = utilization > 100 ? 'error' : utilization > 80 ? 'warning' : 'success';

        return `
            <div class="track-info-item">
                <span class="track-info-label">Total tåglängd:</span>
                <span class="track-info-value">${totalTrainLength}m</span>
            </div>
            <div class="track-info-item">
                <span class="track-info-label">Utnyttjande:</span>
                <span class="track-info-value ${utilizationClass}">${utilization}%</span>
            </div>
        `;
    }

    function generateTrainItem(train) {
        const trainLength = calculateTrainSetLength(train.trainSet);
        const trainSetName = getTrainSetDisplayName(train.trainSet);
        
        // Handle split trains properly
        const hasArrival = train.arrivalTrainNumber && train.arrivalTrainNumber.trim() !== '';
        const hasDeparture = train.departureTrainNumber && train.departureTrainNumber.trim() !== '';
        let displayNumber;
        
        if (hasArrival && hasDeparture && train.arrivalTrainNumber !== train.departureTrainNumber) {
            displayNumber = `${train.arrivalTrainNumber}/${train.departureTrainNumber}`;
        } else {
            displayNumber = train.arrivalTrainNumber || train.departureTrainNumber || train.trainNumber || train.id;
        }

        return `
            <div class="track-train-item" data-train-id="${train.id}">
                <div class="train-item-header">
                    <span class="train-number">${displayNumber}</span>
                    <span class="train-time">${train.scheduledArrivalTime} - ${train.scheduledDepartureTime}</span>
                </div>
                <div class="train-item-details">
                    <div class="train-detail">
                        <span class="train-detail-label">Från:</span>
                        <span class="train-detail-value">${train.origin}</span>
                    </div>
                    <div class="train-detail">
                        <span class="train-detail-label">Till:</span>
                        <span class="train-detail-value">${train.destination}</span>
                    </div>
                    <div class="train-detail">
                        <span class="train-detail-label">Fordon:</span>
                        <span class="train-detail-value">${trainSetName}</span>
                    </div>
                    <div class="train-detail">
                        <span class="train-detail-label">Längd:</span>
                        <span class="train-detail-value">${trainLength}m</span>
                    </div>
                    <div class="train-detail">
                        <span class="train-detail-label">Delspår:</span>
                        <span class="train-detail-value">${train.subTrackIndex + 1}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function toggleTrackDataPanel() {
        const panel = document.getElementById('trackDataPanel');
        if (!panel) {
            console.error('trackDataPanel element not found');
            return;
        }
        panel.classList.toggle('visible');
    }

    function closeTrackDataPanel() {
        const panel = document.getElementById('trackDataPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    function handleTrainClick(e) {
        const trainBar = e.target.closest('.train-bar');
        if (!trainBar) return;
        
        const trainId = parseInt(trainBar.dataset.trainId);
        if (trainId) {
            showTrainDataPanel(trainId);
        }
    }

    function showTrainDataPanel(trainId) {
        const state = window.AppState;
        const train = state.trains.find(t => t.id === trainId);
        
        if (!train) {
            if (typeof showNotification !== 'undefined') {
                showNotification('Tågdata inte tillgänglig', 'error');
            }
            return;
        }

        const panel = document.getElementById('trainDataPanel');
        const title = document.getElementById('trainDataTitle');
        const content = document.getElementById('trainDataContent');
        
        if (!panel || !title || !content) {
            console.error('Train data panel elements not found');
            return;
        }

        // Create display number for title, handling split trains
        const hasArrival = train.arrivalTrainNumber && train.arrivalTrainNumber.trim() !== '';
        const hasDeparture = train.departureTrainNumber && train.departureTrainNumber.trim() !== '';
        let displayNumber;
        
        if (hasArrival && hasDeparture && train.arrivalTrainNumber !== train.departureTrainNumber) {
            displayNumber = `${train.arrivalTrainNumber}/${train.departureTrainNumber}`;
        } else {
            displayNumber = train.arrivalTrainNumber || train.departureTrainNumber || train.trainNumber || train.id;
        }
        
        const trackDef = getTrackDefinition(train.trackId);
        const trainLength = calculateTrainSetLength(train.trainSet);
        const trainSetName = getTrainSetDisplayName(train.trainSet);
        const capacityStatus = getTrackCapacityStatus(train.trainSet, train.trackId);

        title.textContent = `Tjänst ${displayNumber} - Data`;

        const conflicts = findTrainConflicts(train);

        const startMinutes = window.timeToMinutes(train.scheduledArrivalTime);
        const endMinutes = window.timeToMinutes(train.scheduledDepartureTime);
        const durationMinutes = endMinutes - startMinutes;

        content.innerHTML = `
            <div class="track-info-section">
                <h3>Grundläggande information</h3>
                <div class="track-info-item">
                    <span class="track-info-label">Ankomst tågnummer:</span>
                    <span class="track-info-value">${hasArrival ? train.arrivalTrainNumber : (train.connectionHistory ? 'Ej tillämpligt (delad tjänst)' : 'Ej angivet')}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Avgång tågnummer:</span>
                    <span class="track-info-value">${hasDeparture ? train.departureTrainNumber : (train.connectionHistory ? 'Ej tillämpligt (delad tjänst)' : 'Ej angivet')}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Från:</span>
                    <span class="track-info-value">${train.origin}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Till:</span>
                    <span class="track-info-value">${train.destination}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Ankomsttid:</span>
                    <span class="track-info-value">${train.scheduledArrivalTime}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Avgångstid:</span>
                    <span class="track-info-value">${train.scheduledDepartureTime}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Uppehållstid:</span>
                    <span class="track-info-value">${durationMinutes} minuter</span>
                </div>
            </div>

            <div class="track-info-section">
                <h3>Spårtilldelning</h3>
                <div class="track-info-item">
                    <span class="track-info-label">Spår:</span>
                    <span class="track-info-value">${trackDef ? trackDef.publicTrackNumber : train.trackId}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Delspår:</span>
                    <span class="track-info-value">${train.subTrackIndex + 1}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Spårtyp:</span>
                    <span class="track-info-value">${trackDef ? trackDef.description : 'Okänt'}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Spårlängd:</span>
                    <span class="track-info-value">${trackDef ? trackDef.signalVisibleLengthMeters + 'm' : 'Okänt'}</span>
                </div>
            </div>

            <div class="track-info-section">
                <h3>Fordonsinformation</h3>
                <div class="track-info-item">
                    <span class="track-info-label">Fordonstyp:</span>
                    <span class="track-info-value">${trainSetName}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Tåglängd:</span>
                    <span class="track-info-value">${trainLength}m</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Kapacitetsstatus:</span>
                    <span class="track-info-value ${capacityStatus.status}">${capacityStatus.status === 'ok' ? 'OK' : capacityStatus.status === 'warning' ? 'Varning' : 'Omöjligt'}</span>
                </div>
                <div class="track-info-item">
                    <span class="track-info-label">Kapacitetsdetaljer:</span>
                    <span class="track-info-value">${capacityStatus.message}</span>
                </div>
            </div>

            ${train.connectionHistory ? `
                <div class="track-info-section">
                    <h3>Kopplingshistorik</h3>
                    <div class="track-info-item">
                        <span class="track-info-label">Status:</span>
                        <span class="track-info-value">${getConnectionHistoryDescription(train.connectionHistory)}</span>
                    </div>
                </div>
            ` : ''}

            ${conflicts.length > 0 ? `
                <div class="track-info-section">
                    <h3>Konflikter och varningar</h3>
                    <div class="conflicts-list">
                        ${conflicts.map(conflict => `
                            <div class="conflict-item ${conflict.type}">
                                <div class="conflict-header">
                                    <span class="conflict-type">${getConflictTypeName(conflict.type)}</span>
                                    <span class="conflict-train">${conflict.otherTrain}</span>
                                </div>
                                <div class="conflict-description">${conflict.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="track-info-section">
                    <h3>Konflikter och varningar</h3>
                    <div class="no-conflicts">Inga konflikter eller varningar upptäckta</div>
                </div>
            `}

            <div class="track-info-section">
                <h3>Åtgärder</h3>
                <div class="train-actions">
                    <button class="action-button" onclick="editTrain(${train.id})">
                        ✏️ Redigera tjänst
                    </button>
                    <button class="action-button" onclick="initiateTrinSwap(${train.id})">
                        🔄 Byt plats
                    </button>
                    <button class="action-button" onclick="splitTrain(${train.id})">
                        ✂️ Dela tjänst
                    </button>
                </div>
            </div>
        `;

        // Show panel
        panel.classList.add('visible');
    }

    function findTrainConflicts(train) {
        const state = window.AppState;
        const conflicts = [];
        const startMinutes = window.timeToMinutes(train.scheduledArrivalTime);
        const endMinutes = window.timeToMinutes(train.scheduledDepartureTime);

        // Find trains on the same track and subtrack
        const sameTrackTrains = state.trains.filter(t => 
            t.id !== train.id && 
            t.trackId === train.trackId && 
            t.subTrackIndex === train.subTrackIndex
        );

        sameTrackTrains.forEach(otherTrain => {
            const otherStart = window.timeToMinutes(otherTrain.scheduledArrivalTime);
            const otherEnd = window.timeToMinutes(otherTrain.scheduledDepartureTime);
            const otherDisplay = otherTrain.arrivalTrainNumber || otherTrain.trainNumber || otherTrain.id;

            // Check for overlap
            if (startMinutes < otherEnd && endMinutes > otherStart) {
                conflicts.push({
                    type: 'conflicting',
                    otherTrain: otherDisplay,
                    description: `Tid överlappar med tjänst ${otherDisplay} (${otherTrain.scheduledArrivalTime} - ${otherTrain.scheduledDepartureTime})`
                });
            } else {
                // Check for proximity warnings
                const timeBetween = Math.min(
                    Math.abs(startMinutes - otherEnd),
                    Math.abs(endMinutes - otherStart)
                );
                
                if (timeBetween <= window.AppConfig.proximityWarningMinutes) {
                    conflicts.push({
                        type: 'proximity-warning',
                        otherTrain: otherDisplay,
                        description: `Kort vändtid (${timeBetween} min) med tjänst ${otherDisplay}`
                    });
                }
            }
        });

        // Check length warnings
        const capacityStatus = getTrackCapacityStatus(train.trainSet, train.trackId);
        if (capacityStatus.status === 'warning') {
            conflicts.push({
                type: 'length-warning',
                otherTrain: '',
                description: 'Tåget är längre än spårets signalsikt'
            });
        } else if (capacityStatus.status === 'impossible') {
            conflicts.push({
                type: 'length-impossible',
                otherTrain: '',
                description: 'Tåget är för långt för spåret'
            });
        }

        return conflicts;
    }

    function getConflictTypeName(type) {
        switch (type) {
            case 'conflicting': return '⚠️ Tidskonflikt';
            case 'proximity-warning': return '⏰ Kort vändtid';
            case 'length-warning': return '📏 Längdvarning';
            case 'length-impossible': return '🚫 Längdproblem';
            default: return '❓ Okänt';
        }
    }

    function getConnectionHistoryDescription(connectionHistory) {
        if (!connectionHistory) return '';
        
        switch (connectionHistory.type) {
            case 'split_from':
                const originalNumbers = connectionHistory.originalService;
                const originalCombined = originalNumbers.arrivalNumber && originalNumbers.departureNumber && 
                                       originalNumbers.arrivalNumber !== originalNumbers.departureNumber 
                                       ? `${originalNumbers.arrivalNumber}/${originalNumbers.departureNumber}`
                                       : (originalNumbers.arrivalNumber || originalNumbers.departureNumber);
                
                return `Var planlagd ihopkopplad med ${connectionHistory.connectedTo} som tjänst ${originalCombined}`;
            default:
                return 'Okänd kopplingshistorik';
        }
    }

    function closeTrainDataPanel() {
        const panel = document.getElementById('trainDataPanel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    function toggleTrainDataPanel() {
        const panel = document.getElementById('trainDataPanel');
        if (!panel) {
            console.error('trainDataPanel element not found');
            return;
        }
        panel.classList.toggle('visible');
    }

    // Action button functions (these will call existing functions)
    window.editTrain = function(trainId) {
        if (typeof openTrainModalForEdit === 'function') {
            openTrainModalForEdit(trainId);
            closeTrainDataPanel();
        }
    };

    window.initiateTrinSwap = function(trainId) {
        if (typeof initiateSwap === 'function') {
            initiateSwap(trainId);
            closeTrainDataPanel();
        }
    };

    window.splitTrain = function(trainId) {
        if (typeof handleSplitTrain === 'function') {
            handleSplitTrain(trainId);
            closeTrainDataPanel();
        }
    };

    // Expose functions globally
    window.handleTrackClick = handleTrackClick;
    window.showTrackDataPanel = showTrackDataPanel;
    window.toggleTrackDataPanel = toggleTrackDataPanel;
    window.closeTrackDataPanel = closeTrackDataPanel;
    window.handleTrainClick = handleTrainClick;
    window.showTrainDataPanel = showTrainDataPanel;
    window.closeTrainDataPanel = closeTrainDataPanel;
    window.toggleTrainDataPanel = toggleTrainDataPanel;

})(); 