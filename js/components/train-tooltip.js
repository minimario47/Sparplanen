/**
 * Train Tooltip - Beautiful, comprehensive tooltip for train bars
 * Shows train data, delay info, and all available information
 */

class TrainTooltip {
    constructor() {
        this.tooltip = null;
        this.currentTrain = null;
        this.isVisible = false;
        
        this.createTooltip();
        this.attachGlobalListeners();
        
        logger.info('TrainTooltip', 'Train tooltip system initialized (click-to-show)');
    }
    
    /**
     * Create tooltip DOM element
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'train-info-tooltip';
        this.tooltip.style.display = 'none';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tooltip-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'Stäng');
        closeBtn.addEventListener('click', () => this.hide());
        this.tooltip.appendChild(closeBtn);
        
        document.body.appendChild(this.tooltip);
    }
    
    /**
     * Attach global event listeners
     */
    attachGlobalListeners() {
        // Listen for train bar click events
        document.addEventListener('click', (e) => {
            const trainBar = e.target.closest('.train-bar');
            
            if (trainBar) {
                // Toggle tooltip for this train
                e.stopPropagation();
                logger.debug('TrainTooltip', 'Clicked train bar', { trainId: trainBar.dataset.trainId });
                this.showForTrainBar(trainBar, e);
            } else if (!this.tooltip.contains(e.target)) {
                // Click outside - hide tooltip
                this.hide();
            }
        });
        
        // Listen for conflict warning click events
        document.addEventListener('show-conflict-tooltip', (e) => {
            const { trainBar, conflicts } = e.detail;
            this.showConflictInfo(trainBar, conflicts, e);
        });
        
        // Allow clicking inside tooltip without closing
        this.tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    /**
     * Show tooltip for a train bar
     */
    showForTrainBar(trainBar, event) {
        const trainId = trainBar.dataset.trainId;
        if (!trainId) return;
        
        // If clicking the same train, toggle off
        if (this.isVisible && this.currentTrain?.id === parseInt(trainId)) {
            this.hide();
            return;
        }
        
        // Find train data
        const train = window.cachedTrains?.find(t => String(t.id) === String(trainId));
        if (!train) {
            logger.warn('TrainTooltip', 'Train not found', { trainId });
            return;
        }
        
        const selectedTrainNumber = this.resolveTrainNumberByClickSide(train, trainBar, event);
        const delayInfo = this.getDelayInfoForTrain(train, selectedTrainNumber);
        
        this.show(train, delayInfo, event, trainBar, selectedTrainNumber);
    }

    resolveTrainNumberByClickSide(train, trainBar, event) {
        const arrival = String(train.arrivalTrainNumber || train.arrivalLabel || '').trim();
        const departure = String(train.departureTrainNumber || train.departureLabel || '').trim();
        if (!arrival) return departure;
        if (!departure) return arrival;

        if (!event || typeof event.clientX !== 'number') {
            return arrival;
        }

        const rect = trainBar.getBoundingClientRect();
        const clickOffset = event.clientX - rect.left;
        const clickedRightSide = clickOffset >= rect.width / 2;
        return clickedRightSide ? departure : arrival;
    }

    getDelayInfoForTrain(train, preferredTrainNumber = '') {
        const dataManager = window.delayIntegration?.dataManager;
        if (!dataManager) return null;

        const preferred = String(preferredTrainNumber || '').trim();
        const arrival = String(train.arrivalTrainNumber || '').trim();
        const departure = String(train.departureTrainNumber || '').trim();

        if (preferred) {
            const preferredLeg = (preferred === departure && preferred !== arrival) ? 'departure' : 'arrival';
            const preferredInfo = dataManager.getDelayInfo(preferred, preferredLeg);
            if (preferredInfo) return preferredInfo;
        }
        if (arrival && arrival !== preferred) {
            const arrivalInfo = dataManager.getDelayInfo(arrival, 'arrival');
            if (arrivalInfo) return arrivalInfo;
        }
        if (departure && departure !== preferred) {
            const departureInfo = dataManager.getDelayInfo(departure, 'departure');
            if (departureInfo) return departureInfo;
        }
        return null;
    }
    
    /**
     * Show tooltip with train data
     */
    show(train, delayInfo, event, trainBar, selectedTrainNumber = '') {
        this.currentTrain = train;
        this.isVisible = true;
        
        // Build tooltip content
        const content = this.buildContent(train, delayInfo, selectedTrainNumber);
        
        // Find or create content container (preserve close button)
        let contentContainer = this.tooltip.querySelector('.tooltip-content');
        if (!contentContainer) {
            contentContainer = document.createElement('div');
            contentContainer.className = 'tooltip-content';
            this.tooltip.appendChild(contentContainer);
        }
        contentContainer.innerHTML = content;
        
        // Position tooltip near the clicked train bar
        this.position(event, trainBar);
        
        // Show tooltip. Force a reflow so the CSS opacity transition can play,
        // then reveal SYNCHRONOUSLY. The previous setTimeout(…,10) proved
        // unreliable on locked-down / power-managed work machines, where short
        // timers get throttled — the timer could be delayed (or coalesced with
        // the dismiss click) and leave the tooltip stuck at opacity:0. The
        // track tooltip, which adds `.visible` synchronously, never had this
        // problem; mirror that here.
        this.tooltip.style.display = 'block';
        void this.tooltip.offsetHeight; // flush layout so the transition animates
        this.tooltip.classList.add('visible');
        
        logger.info('TrainTooltip', 'Tooltip shown', { 
            trainId: train.id, 
            trainNumber: selectedTrainNumber || train.arrivalTrainNumber || train.departureTrainNumber 
        });
    }
    
    /**
     * Show conflict information tooltip
     */
    showConflictInfo(trainBar, conflicts, event) {
        const trainId = trainBar.dataset.trainId;
        if (!trainId) return;
        
        // Find train data
        const train = window.cachedTrains?.find(t => String(t.id) === String(trainId));
        if (!train) {
            logger.warn('TrainTooltip', 'Train not found for conflict', { trainId });
            return;
        }
        
        const delayInfo = this.getDelayInfoForTrain(train);
        
        this.currentTrain = train;
        this.isVisible = true;
        
        // Build conflict-specific content
        const content = this.buildConflictContent(train, delayInfo, conflicts);
        
        // Find or create content container (preserve close button)
        let contentContainer = this.tooltip.querySelector('.tooltip-content');
        if (!contentContainer) {
            contentContainer = document.createElement('div');
            contentContainer.className = 'tooltip-content';
            this.tooltip.appendChild(contentContainer);
        }
        contentContainer.innerHTML = content;
        
        // Position tooltip near the warning icon
        this.position(event, trainBar);
        
        // Show tooltip. Force a reflow so the CSS opacity transition can play,
        // then reveal SYNCHRONOUSLY. The previous setTimeout(…,10) proved
        // unreliable on locked-down / power-managed work machines, where short
        // timers get throttled — the timer could be delayed (or coalesced with
        // the dismiss click) and leave the tooltip stuck at opacity:0. The
        // track tooltip, which adds `.visible` synchronously, never had this
        // problem; mirror that here.
        this.tooltip.style.display = 'block';
        void this.tooltip.offsetHeight; // flush layout so the transition animates
        this.tooltip.classList.add('visible');
        
        logger.info('TrainTooltip', 'Conflict tooltip shown', { 
            trainId: train.id, 
            conflictType: conflicts.conflictType,
            affectedTrains: conflicts.affectedTrains.length
        });
    }
    
    /**
     * Build tooltip content HTML - Clean, professional design
     */
    buildContent(train, delayInfo, selectedTrainNumber = '') {
        const trainNumber = selectedTrainNumber || train.arrivalTrainNumber || train.departureTrainNumber || train.arrivalLabel || train.departureLabel;
        const trackInfo = train.trackId ? `Spår ${train.trackId}` : 'Okänt spår';

        // Train number - prominent display
        const trainNumberHTML = `
            <div class="tooltip-train-number">Tåg ${trainNumber}</div>
        `;
        
        // Schedule times. Only the ARRIVAL row carries a live-status line
        // ("I tid" / "Sen" / "Tidig", or "Ingen API-data på detta tåg"); the
        // departure row shows just its scheduled time. We resolve the delay for
        // the arrival train number specifically so the status always reflects
        // arrival regardless of which side of the bar was clicked.
        const dataManager = window.delayIntegration?.dataManager;
        const arrivalNum = String(train.arrivalTrainNumber || train.arrivalLabel || '').trim();
        const arrivalDelay = (dataManager && arrivalNum) ? dataManager.getDelayInfo(arrivalNum, 'arrival') : null;

        const arrRow = train.arrTime
            ? this.buildScheduleRow('Ankomst', this.formatTime(train.arrTime), train.arrTime, arrivalDelay, true)
            : '';
        const depRow = train.depTime
            ? this.buildScheduleRow('Avgång', this.formatTime(train.depTime), train.depTime, null, false)
            : '';
        const scheduleHTML = (arrRow || depRow)
            ? `<div class="tooltip-schedule">${arrRow}${depRow}</div>`
            : '';

        // Route information
        let routeHTML = '';
        if (train.origin || train.dest) {
            routeHTML = `
                <div class="tooltip-route">
                    ${train.origin ? `<span class="route-from">${train.origin}</span>` : ''}
                    ${train.origin && train.dest ? '<span class="route-arrow">→</span>' : ''}
                    ${train.dest ? `<span class="route-to">${train.dest}</span>` : ''}
                </div>
            `;
        }
        
        // Technical details - just the track (train type row removed as redundant)
        const detailsHTML = `
            <div class="tooltip-details">
                <div class="detail-item">
                    <span class="detail-label">Spår</span>
                    <span class="detail-value">${trackInfo}</span>
                </div>
            </div>
        `;
        
        let noteHTML = '';
        try {
            const meta = window.TrainNotesStore && window.TrainNotesStore.getMeta(train.id);
            if (meta && meta.text) {
                const safe = String(meta.text)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/\n/g, '<br>');
                noteHTML = `
                    <div class="tooltip-note" role="note">
                        <div class="tooltip-note__title">
                            <span class="tooltip-note__icon" aria-hidden="true">✎</span>
                            Anteckning
                        </div>
                        <div class="tooltip-note__body">${safe}</div>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('[TrainTooltip] note render failed', e);
        }

        let checkHTML = '';
        try {
            if (window.TrainChecksStore && window.TrainChecksStore.isChecked(train.id)) {
                const meta = window.TrainChecksStore.getMeta(train.id);
                const when = meta?.checkedAt ? new Date(meta.checkedAt).toLocaleString('sv-SE') : '';
                checkHTML = `
                    <div class="tooltip-check" role="status">
                        <span class="tooltip-check__icon" aria-hidden="true">✓</span>
                        <span class="tooltip-check__label">Kontrollerad${when ? ` · ${when}` : ''}</span>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('[TrainTooltip] check render failed', e);
        }

        return `
            ${trainNumberHTML}
            ${scheduleHTML}
            ${routeHTML}
            ${detailsHTML}
            ${noteHTML}
            ${checkHTML}
        `;
    }
    
    /**
     * Build conflict information content HTML
     */
    buildConflictContent(train, delayInfo, conflicts) {
        const trainNumber = train.arrivalTrainNumber || train.departureTrainNumber;
        const trackInfo = train.trackId ? `Spår ${train.trackId}` : 'Okänt spår';
        
        // Conflict severity header
        const severityMap = {
            'red': { class: 'conflict-red', icon: '🔴', text: 'Röd varning' },
            'orange': { class: 'conflict-orange', icon: '🟠', text: 'Orange varning' },
            'yellow': { class: 'conflict-yellow', icon: '🟡', text: 'Gul varning' }
        };
        const severity = severityMap[conflicts.conflictType] || severityMap['yellow'];
        
        // Header with conflict warning
        const headerHTML = `
            <div class="tooltip-header ${severity.class}">
                <div class="status-indicator">
                    <span class="status-icon">${severity.icon}</span>
                    <span class="status-text">${severity.text}</span>
                </div>
            </div>
            <div class="tooltip-train-number">Tåg ${trainNumber}</div>
        `;
        
        // Delay information
        let delayHTML = '';
        if (delayInfo && delayInfo.delayMinutes && Math.abs(delayInfo.delayMinutes) > 2) {
            const delayText = delayInfo.delayMinutes > 0 
                ? `Försenat ${delayInfo.delayMinutes} min` 
                : `Tidigt ${Math.abs(delayInfo.delayMinutes)} min`;
            const delayClass = delayInfo.delayMinutes > 0 ? 'delayed' : 'early';
            
            delayHTML = `
                <div class="tooltip-delay ${delayClass}">
                    <span class="delay-text">${delayText}</span>
                </div>
            `;
        }
        
        // Affected trains - clean list
        let affectedHTML = '';
        if (conflicts.affectedTrains && conflicts.affectedTrains.length > 0) {
            affectedHTML = `
                <div class="conflict-section">
                    <div class="section-title">Påverkade tåg</div>
                    <div class="affected-list">
            `;
            
            conflicts.affectedTrains.forEach(affected => {
                const zoneLabelMap = {
                    'red': 'Röd',
                    'orange': 'Orange', 
                    'yellow': 'Gul'
                };
                const zoneLabel = zoneLabelMap[affected.zone] || affected.zone;
                const trainNumText = affected.trainNumber || `Tåg ${affected.trainId}`;
                
                affectedHTML += `
                    <div class="affected-item">
                        <div class="affected-train">
                            <span class="train-number">${trainNumText}</span>
                            <span class="zone-badge ${affected.zone}">${zoneLabel}</span>
                        </div>
                        <div class="overlap-info">${affected.overlap} min överlapp</div>
                    </div>
                `;
            });
            
            affectedHTML += `
                    </div>
                </div>
            `;
        }
        
        // Technical details
        const detailsHTML = `
            <div class="tooltip-details">
                <div class="detail-item">
                    <span class="detail-label">Spår</span>
                    <span class="detail-value">${trackInfo}</span>
                </div>
            </div>
        `;
        
        return `
            ${headerHTML}
            ${delayHTML}
            ${affectedHTML}
            ${detailsHTML}
        `;
    }
    
    /**
     * Get train type display name
     */
    getTrainType(type) {
        const types = {
            'regional': 'Regionaltåg',
            'long-distance': 'Fjärrtåg',
            'freight': 'Godståg'
        };
        return types[type] || 'Okänd';
    }
    
    /**
     * Get status class based on delay info
     */
    getStatusClass(delayInfo) {
        if (delayInfo.isCanceled) return 'status-canceled';
        if (delayInfo.isReplaced) return 'status-replaced';
        if (delayInfo.delayMinutes > 10) return 'status-delayed-severe';
        if (delayInfo.delayMinutes > 5) return 'status-delayed-moderate';
        if (delayInfo.delayMinutes > 2) return 'status-delayed-minor';
        if (delayInfo.delayMinutes < -2) return 'status-early';
        return 'status-on-time';
    }
    
    /**
     * Get status text
     */
    getStatusText(delayInfo) {
        if (delayInfo.isCanceled) return 'Inställt';
        if (delayInfo.isReplaced) return 'Ersatt';
        if (delayInfo.delayMinutes > 10) return 'Kraftigt försenat';
        if (delayInfo.delayMinutes > 5) return 'Försenat';
        if (delayInfo.delayMinutes > 2) return 'Lätt försenat';
        if (delayInfo.delayMinutes < -2) return 'Tidigt';
        return 'I tid';
    }
    
    /**
     * Get status icon
     */
    getStatusIcon(delayInfo) {
        if (delayInfo.isCanceled) return '✗';
        if (delayInfo.isReplaced) return '🚌';
        if (delayInfo.delayMinutes > 10) return '🔴';
        if (delayInfo.delayMinutes > 5) return '🟠';
        if (delayInfo.delayMinutes > 2) return '🟡';
        if (delayInfo.delayMinutes < -2) return '🟢';
        return '✓';
    }
    
    /**
     * Format time string
     */
    formatTime(timeString) {
        if (!timeString) return '';
        try {
            const date = new Date(timeString);
            return date.toTimeString().substring(0, 5);
        } catch (e) {
            return timeString.substring(0, 5);
        }
    }

    /**
     * Scheduled time shifted by the delay (minutes), formatted HH:MM.
     */
    formatActualTime(baseTimeString, delayMinutes) {
        if (!baseTimeString) return '';
        try {
            const d = new Date(baseTimeString);
            d.setMinutes(d.getMinutes() + (delayMinutes || 0));
            return d.toTimeString().substring(0, 5);
        } catch (e) {
            return '';
        }
    }

    /**
     * One schedule row: label + scheduled time, with the actual (delay-adjusted)
     * time and signed offset (+65 min / -10 min) stacked underneath when the
     * train is off-schedule. Red for late, green for early; cancelled/replaced
     * shown as text. Nothing extra is added when the train runs on time.
     */
    buildScheduleRow(label, scheduledStr, baseTimeString, delayInfo, showStatus) {
        let statusHTML = '';
        if (showStatus) {
            if (!delayInfo) {
                statusHTML = `<span class="schedule-actual no-data">Ingen API-data på detta tåg</span>`;
            } else if (delayInfo.isCanceled) {
                statusHTML = `<span class="schedule-actual delayed"><span class="schedule-status-word">Inställt</span></span>`;
            } else if (delayInfo.isReplaced) {
                statusHTML = `<span class="schedule-actual delayed"><span class="schedule-status-word">Ersatt</span></span>`;
            } else if (typeof delayInfo.delayMinutes === 'number' && delayInfo.delayMinutes > 2) {
                const dm = delayInfo.delayMinutes;
                const actual = this.formatActualTime(baseTimeString, dm);
                statusHTML = `
                    <span class="schedule-actual delayed">
                        <span class="schedule-status-word">Sen</span>
                        ${actual ? `<span class="schedule-actual-time">${actual}</span>` : ''}
                        <span class="schedule-delta">+${dm} min</span>
                    </span>`;
            } else if (typeof delayInfo.delayMinutes === 'number' && delayInfo.delayMinutes < -2) {
                const dm = delayInfo.delayMinutes;
                const actual = this.formatActualTime(baseTimeString, dm);
                statusHTML = `
                    <span class="schedule-actual early">
                        <span class="schedule-status-word">Tidig</span>
                        ${actual ? `<span class="schedule-actual-time">${actual}</span>` : ''}
                        <span class="schedule-delta">-${Math.abs(dm)} min</span>
                    </span>`;
            } else {
                // Within ±2 min of plan → on time.
                statusHTML = `<span class="schedule-actual ontime"><span class="schedule-status-word">I tid</span></span>`;
            }
        }
        return `
            <div class="schedule-item">
                <span class="schedule-label">${label}</span>
                <span class="schedule-time-group">
                    <span class="schedule-time">${scheduledStr}</span>
                    ${statusHTML}
                </span>
            </div>
        `;
    }
    
    /**
     * Position tooltip near clicked element
     */
    position(event, trainBar) {
        const margin = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Wait for next frame to get accurate dimensions
        requestAnimationFrame(() => {
            const tooltipRect = this.tooltip.getBoundingClientRect();
            
            if (trainBar) {
                // Position relative to the train bar
                const trainRect = trainBar.getBoundingClientRect();
                
                // Try to position below the train bar first
                let left = trainRect.left + (trainRect.width / 2) - (tooltipRect.width / 2);
                let top = trainRect.bottom + margin;
                
                // If it goes off the bottom, position above
                if (top + tooltipRect.height > viewportHeight - margin) {
                    top = trainRect.top - tooltipRect.height - margin;
                }
                
                // If it goes off the right, align to right edge
                if (left + tooltipRect.width > viewportWidth - margin) {
                    left = viewportWidth - tooltipRect.width - margin;
                }
                
                // If it goes off the left, align to left edge
                if (left < margin) {
                    left = margin;
                }
                
                // If still off top, position at top
                if (top < margin) {
                    top = margin;
                }
                
                this.tooltip.style.left = `${left}px`;
                this.tooltip.style.top = `${top}px`;
            } else {
                // Fallback to mouse position
                let left = event.clientX + margin;
                let top = event.clientY + margin;
                
                // Adjust if tooltip goes off edges
                if (left + tooltipRect.width > viewportWidth - margin) {
                    left = event.clientX - tooltipRect.width - margin;
                }
                if (top + tooltipRect.height > viewportHeight - margin) {
                    top = event.clientY - tooltipRect.height - margin;
                }
                if (left < margin) left = margin;
                if (top < margin) top = margin;
                
                this.tooltip.style.left = `${left}px`;
                this.tooltip.style.top = `${top}px`;
            }
        });
    }
    
    /**
     * Hide tooltip
     */
    hide() {
        if (!this.isVisible) return;
        
        this.tooltip.classList.remove('visible');
        setTimeout(() => {
            this.tooltip.style.display = 'none';
            this.isVisible = false;
            this.currentTrain = null;
        }, 200);
        
        logger.debug('TrainTooltip', 'Tooltip hidden');
    }
}

// Initialize globally
window.trainTooltip = new TrainTooltip();
