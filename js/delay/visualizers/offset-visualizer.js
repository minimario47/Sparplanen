/**
 * Offset Visualizer - Shows delay as semi-transparent overlay
 * Default visualization mode for train delays
 */

class OffsetVisualizer {
    constructor(settings = {}) {
        this.settings = {
            colorThresholds: settings.colorThresholds || { minor: 3, moderate: 6, significant: 11, severe: 21 },
            colors: settings.colors || {
                minor: '#FFA500',
                moderate: '#FF8C00',
                significant: '#FF4500',
                severe: '#DC143C',
                early: '#22C55E'
            },
            showWarnings: settings.showWarnings !== false
        };
        
        logger.info('Visualizer', 'OffsetVisualizer initialized', this.settings);
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        logger.info('Visualizer', 'OffsetVisualizer settings updated', this.settings);
    }
    
    /**
     * Get severity level based on delay minutes
     */
    getSeverity(delayMinutes) {
        if (delayMinutes === null || delayMinutes === undefined) return null;
        
        const absDelay = Math.abs(delayMinutes);
        const thresholds = this.settings.colorThresholds;
        
        if (delayMinutes < 0) return 'early';
        if (absDelay <= 2) return null; // No visualization for ≤2 min
        if (absDelay < thresholds.moderate) return 'minor';
        if (absDelay < thresholds.significant) return 'moderate';
        if (absDelay < thresholds.severe) return 'significant';
        return 'severe';
    }
    
    /**
     * Get color for severity level
     */
    getColor(severity) {
        return this.settings.colors[severity] || '#999';
    }
    
    /**
     * Get opacity for severity level
     */
    getOpacity(severity) {
        const opacities = {
            early: 0.4,
            minor: 0.4,
            moderate: 0.5,
            significant: 0.6,
            severe: 0.7
        };
        return opacities[severity] || 0.5;
    }
    
    /**
     * Apply delay visualization to train bar
     */
    apply(trainBar, train, delayInfo, conflicts = null) {
        if (!trainBar || !train || !delayInfo) return;
        
        // Remove existing delay overlays
        this.remove(trainBar);
        
        const delayMinutes = delayInfo.delayMinutes;
        const severity = this.getSeverity(delayMinutes);
        
        // Don't visualize if delay is too small or no severity
        if (!severity || Math.abs(delayMinutes) <= 2) {
            return;
        }
        
        // Get pixel scale from global state
        const pixelsPerMinute = window.currentPixelsPerHour / 60;
        if (!pixelsPerMinute) {
            logger.warn('Visualizer', 'pixelsPerMinute not available');
            return;
        }
        
        const absDelayMinutes = Math.abs(delayMinutes);
        const delayPixels = absDelayMinutes * pixelsPerMinute;
        const color = this.getColor(severity);
        const opacity = this.getOpacity(severity);
        
        // For delayed trains, calculate turnaround and tolerance
        let turnaroundMinutes = 0;
        let toleranceMinutes = 0;
        
        if (delayMinutes > 0) {
            turnaroundMinutes = this.settings?.turnaroundTime || 10;
            toleranceMinutes = this.settings?.conflictTolerance || 5;
        }
        
        const turnaroundPixels = turnaroundMinutes * pixelsPerMinute;
        const tolerancePixels = toleranceMinutes * pixelsPerMinute;
        
        // 1. CREATE MAIN DELAY OVERLAY (solid fill)
        const delayOverlay = document.createElement('div');
        delayOverlay.className = 'delay-overlay-offset delay-overlay-main delay-severity-' + severity;
        delayOverlay.dataset.severity = severity;
        delayOverlay.dataset.delayMinutes = delayMinutes;
        
        if (delayMinutes > 0) {
            // Delayed - solid overlay for actual delay
            delayOverlay.style.left = '0';
            delayOverlay.style.width = `${delayPixels}px`;
        } else {
            // Early - extends LEFT from scheduled arrival
            delayOverlay.style.left = `-${delayPixels}px`;
            delayOverlay.style.width = `${delayPixels}px`;
        }
        
        delayOverlay.style.backgroundColor = color;
        delayOverlay.style.opacity = opacity;
        
        // Check for conflicts - if delay overlaps another train, add border
        if (conflicts && conflicts.hasConflict) {
            delayOverlay.classList.add('has-conflict');
            delayOverlay.style.borderColor = color;
        }
        
        trainBar.appendChild(delayOverlay);
        
        // 2. CREATE TURNAROUND TIME OVERLAY (diagonal lines - vändtid)
        if (turnaroundMinutes > 0) {
            const turnaroundOverlay = document.createElement('div');
            turnaroundOverlay.className = 'delay-overlay-offset delay-overlay-turnaround delay-severity-' + severity;
            turnaroundOverlay.dataset.type = 'turnaround';
            turnaroundOverlay.title = `Vändtid: ${turnaroundMinutes} min`;
            
            turnaroundOverlay.style.left = `${delayPixels}px`;
            turnaroundOverlay.style.width = `${turnaroundPixels}px`;
            turnaroundOverlay.style.setProperty('--overlay-color', color);
            
            trainBar.appendChild(turnaroundOverlay);
        }
        
        // 3. CREATE TOLERANCE OVERLAY (dotted border - konfliktolerans)
        if (toleranceMinutes > 0) {
            const toleranceOverlay = document.createElement('div');
            toleranceOverlay.className = 'delay-overlay-offset delay-overlay-tolerance delay-severity-' + severity;
            toleranceOverlay.dataset.type = 'tolerance';
            toleranceOverlay.title = `Konfliktolerans: ${toleranceMinutes} min`;
            
            const toleranceStart = delayPixels + turnaroundPixels;
            toleranceOverlay.style.left = `${toleranceStart}px`;
            toleranceOverlay.style.width = `${tolerancePixels}px`;
            toleranceOverlay.style.borderColor = color;
            
            trainBar.appendChild(toleranceOverlay);
        }
        
        // Add conflict warning icon if needed
        if (conflicts && conflicts.hasConflict && this.settings.showWarnings) {
            this.addConflictWarning(trainBar, conflicts);
        }
        
        // Log if total delay is significant
        const totalMinutes = absDelayMinutes + turnaroundMinutes + toleranceMinutes;
        if (totalMinutes > 20) {
            logger.info('Visualizer', `Significant delay for train ${train.id}`, {
                delay: absDelayMinutes,
                turnaround: turnaroundMinutes,
                tolerance: toleranceMinutes,
                total: totalMinutes,
                pixels: delayPixels + turnaroundPixels + tolerancePixels
            });
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

        try {
            const overlays = trainBar.querySelectorAll('.delay-overlay-offset');
            const warnings = trainBar.querySelectorAll('.conflict-warning-icon');

            overlays.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            warnings.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        } catch (error) {
            logger.error('Visualizer', 'Error removing delay overlays', error);
        }
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
window.OffsetVisualizer = OffsetVisualizer;

