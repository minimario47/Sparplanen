/**
 * Icon Visualizer - Shows delay as small badge indicators
 * Alternative visualization mode that doesn't overlap train content
 */

class IconVisualizer {
    constructor(settings = {}) {
        this.settings = {
            colorThresholds: settings.colorThresholds || { minor: 3, moderate: 6, significant: 11, severe: 21 },
            showWarnings: settings.showWarnings !== false
        };
        
        logger.info('Visualizer', 'IconVisualizer initialized', this.settings);
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        logger.info('Visualizer', 'IconVisualizer settings updated', this.settings);
    }
    
    /**
     * Get severity level based on delay minutes
     */
    getSeverity(delayMinutes) {
        if (delayMinutes === null || delayMinutes === undefined) return null;
        
        const absDelay = Math.abs(delayMinutes);
        const thresholds = this.settings.colorThresholds;
        
        if (delayMinutes < 0) return 'early';
        if (absDelay <= 2) return null;
        if (absDelay < thresholds.moderate) return 'minor';
        if (absDelay < thresholds.significant) return 'moderate';
        if (absDelay < thresholds.severe) return 'significant';
        return 'severe';
    }
    
    /**
     * Calculate badge position to avoid overlapping train numbers
     */
    calculateBadgePosition(trainBar, side) {
        const trainBarHeight = trainBar.offsetHeight || 64;
        const numberElement = trainBar.querySelector(`.train-number-value`);
        
        // Default positions
        let top = -18;
        let horizontal = 4;
        
        // If train bar is narrow (stacked), position differently
        if (trainBarHeight < 40) {
            top = -16;
        }
        
        // Check if we have enough space above
        const rect = trainBar.getBoundingClientRect();
        if (rect.top < 30) {
            // Not enough space above, position beside or below
            top = trainBarHeight + 2;
        }
        
        return { top, [side]: horizontal };
    }
    
    /**
     * Create delay badge element
     */
    createBadge(delayMinutes, severity, side) {
        const badge = document.createElement('div');
        badge.className = `delay-badge-icon delay-badge-${side} severity-${severity}`;
        
        const prefix = delayMinutes > 0 ? '+' : '';
        badge.textContent = `${prefix}${delayMinutes}min`;
        badge.dataset.delayMinutes = delayMinutes;
        badge.dataset.severity = severity;
        
        return badge;
    }
    
    /**
     * Apply delay visualization to train bar
     */
    apply(trainBar, train, delayInfo, conflicts = null) {
        if (!trainBar || !train || !delayInfo) return;
        
        // Remove existing badges
        this.remove(trainBar);
        
        const delayMinutes = delayInfo.delayMinutes;
        const severity = this.getSeverity(delayMinutes);
        
        // Don't visualize if delay is too small
        if (!severity || Math.abs(delayMinutes) <= 2) {
            return;
        }
        
        // Determine if delay affects arrival, departure, or both
        const hasArrival = train.scheduledArrivalTime && train.arrivalTrainNumber;
        const hasDeparture = train.scheduledDepartureTime && train.departureTrainNumber;
        
        // Check if we have delay info for arrival or departure
        const arrivalDelayed = hasArrival && train.arrivalTrainNumber === delayInfo.trainNumber;
        const departureDelayed = hasDeparture && train.departureTrainNumber === delayInfo.trainNumber;
        
        // Add arrival badge if applicable
        if (arrivalDelayed || (hasArrival && !hasDeparture)) {
            const badge = this.createBadge(delayMinutes, severity, 'arrival');
            const position = this.calculateBadgePosition(trainBar, 'left');
            Object.assign(badge.style, {
                top: `${position.top}px`,
                left: `${position.left}px`
            });
            trainBar.appendChild(badge);
            
            logger.info('Visualizer', `Added arrival badge to train ${train.id}`, {
                delay: delayMinutes,
                severity
            });
        }
        
        // Add departure badge if delay extends to departure
        if (departureDelayed || (delayMinutes > 0 && Math.abs(delayMinutes) > 10)) {
            const badge = this.createBadge(delayMinutes, severity, 'departure');
            const position = this.calculateBadgePosition(trainBar, 'right');
            Object.assign(badge.style, {
                top: `${position.top}px`,
                right: `${position.right}px`
            });
            trainBar.appendChild(badge);
            
            logger.info('Visualizer', `Added departure badge to train ${train.id}`, {
                delay: delayMinutes,
                severity
            });
        }
        
        // Add conflict warning icon if needed
        if (conflicts && conflicts.hasConflict && this.settings.showWarnings) {
            this.addConflictWarning(trainBar, conflicts);
        }
    }
    
    /**
     * Add conflict warning icon
     */
    addConflictWarning(trainBar, conflicts) {
        // Store conflict data on train bar for tooltip access
        trainBar.dataset.conflictInfo = JSON.stringify(conflicts);
        
        const warningIcon = document.createElement('div');
        warningIcon.className = 'conflict-warning-icon severity-' + conflicts.conflictType;
        // Different icons for different severity levels
        const iconMap = {
            'red': '🔴',
            'orange': '🟠',
            'yellow': '🟡'
        };
        warningIcon.innerHTML = iconMap[conflicts.conflictType] || '⚠';
        warningIcon.title = conflicts.warning || 'Konflikt detekterad';
        
        // Add click handler to show conflict details
        warningIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            // Dispatch custom event for conflict tooltip
            const event = new CustomEvent('show-conflict-tooltip', {
                detail: { trainBar, conflicts }
            });
            document.dispatchEvent(event);
        });
        
        trainBar.appendChild(warningIcon);
        
        logger.info('Visualizer', 'Added conflict warning icon', {
            type: conflicts.conflictType,
            affected: conflicts.affectedTrains.length
        });
    }
    
    /**
     * Remove delay visualizations from train bar
     */
    remove(trainBar) {
        if (!trainBar) return;
        
        const badges = trainBar.querySelectorAll('.delay-badge-icon');
        const warnings = trainBar.querySelectorAll('.conflict-warning-icon');
        
        badges.forEach(el => el.remove());
        warnings.forEach(el => el.remove());
    }
    
    /**
     * Add cancellation overlay
     */
    addCancellationOverlay(trainBar, delayInfo) {
        if (!trainBar || !delayInfo) return;
        
        // Mark train bar as canceled/replaced
        if (delayInfo.isCanceled) {
            trainBar.classList.add('is-canceled');
        }
        if (delayInfo.isReplaced) {
            trainBar.classList.add('is-replaced');
        }
        
        // Add cancellation overlay
        const overlay = document.createElement('div');
        overlay.className = 'cancellation-overlay';
        if (delayInfo.isReplaced) {
            overlay.classList.add('is-replaced');
        }
        
        const trainBarVisual = trainBar.querySelector('.train-bar-visual');
        if (trainBarVisual) {
            trainBarVisual.appendChild(overlay);
        }
        
        logger.info('Visualizer', `Added cancellation overlay`, {
            canceled: delayInfo.isCanceled,
            replaced: delayInfo.isReplaced
        });
    }
}

// Export for use in other modules
window.IconVisualizer = IconVisualizer;

