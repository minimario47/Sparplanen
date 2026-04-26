/**
 * Offset Visualizer - Shows delay as semi-transparent overlay
 * Default visualization mode for train delays
 */

class OffsetVisualizer {
    constructor(settings = {}) {
        // Keep delay zone toggles and minute values. Previously only a subset was copied, so
        // turnaroundEnabled / conflictToleranceEnabled were undefined; `undefined !== false`
        // stayed true and vändtid + konfliktzoner always rendered at full width.
        this.settings = {
            colorThresholds: settings.colorThresholds || { minor: 3, moderate: 6, significant: 11, severe: 21 },
            colors: settings.colors || {
                minor: '#FFA500',
                moderate: '#FF8C00',
                significant: '#FF4500',
                severe: '#DC143C',
                early: '#22C55E'
            },
            showWarnings: settings.showWarnings !== false,
            // color-coded / transparent: tidig-segment = barfärg + gröna accenter, utan siffror
            // dashed: tydligare; kan visa minuter i overlay (samma tredje stil i inställningar)
            visualizationStyle: settings.visualizationStyle || 'color-coded',
            turnaroundTime: Number(settings.turnaroundTime) || 10,
            conflictTolerance: Number(settings.conflictTolerance) || 5,
            turnaroundEnabled: 'turnaroundEnabled' in settings
                ? Boolean(settings.turnaroundEnabled)
                : true,
            conflictToleranceEnabled: 'conflictToleranceEnabled' in settings
                ? Boolean(settings.conflictToleranceEnabled)
                : true
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
     * Get user's border color from visual settings
     */
    getUserBorderColor() {
        try {
            // Try to get the current user's border color from visual settings
            const savedSettings = localStorage.getItem('sparplannen-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                // Check if single color mode is active
                if (settings.trainColorMode === 'single' && settings.singleColor?.border) {
                    return settings.singleColor.border;
                }
                
                // Otherwise, try to get from length-based colors (use first available)
                const lenColors = settings.lenColors || {};
                for (let i = 1; i <= 5; i++) {
                    const bucket = lenColors[`b${i}`];
                    if (bucket?.border) {
                        return bucket.border;
                    }
                }
            }
        } catch (error) {
            logger.warn('Visualizer', 'Error getting user border color', error);
        }
        
        // Fallback to default
        return '#666666';
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
        
        // Get user's border color for dashed outline
        const userBorderColor = this.getUserBorderColor();
        
        // For delayed trains, calculate turnaround and tolerance
        let turnaroundMinutes = 0;
        let toleranceMinutes = 0;
        
        if (delayMinutes > 0) {
            turnaroundMinutes = this.settings.turnaroundEnabled
                ? (Number(this.settings.turnaroundTime) || 10)
                : 0;
            toleranceMinutes = this.settings.conflictToleranceEnabled
                ? (Number(this.settings.conflictTolerance) || 5)
                : 0;
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
            // Early train: render as extension of the train bar with overlap-aware variants
            this.applyEarlyExtension(trainBar, train, delayInfo, delayPixels);
            return;
        }
        
        // Apply visualization style based on user setting
        const style = this.settings.visualizationStyle || 'color-coded';
        
        if (style === 'color-coded') {
            // Default: color-coded solid fill with dashed border around it
            delayOverlay.style.backgroundColor = color;
            delayOverlay.style.opacity = opacity;
            delayOverlay.style.border = `2px dashed ${userBorderColor}`;
            delayOverlay.style.borderRadius = '4px';
        } else if (style === 'transparent') {
            // Transparent with dashed border
            delayOverlay.style.backgroundColor = 'transparent';
            delayOverlay.style.border = `2px dashed ${userBorderColor}`;
            delayOverlay.style.borderRadius = '4px';
            delayOverlay.style.opacity = '0.6';
        } else if (style === 'dashed') {
            // Dashed border only, no fill
            delayOverlay.style.backgroundColor = 'transparent';
            delayOverlay.style.border = `2px dashed ${userBorderColor}`;
            delayOverlay.style.borderRadius = '4px';
            delayOverlay.style.opacity = '0.8';
        }
        
        // Check for conflicts - if delay overlaps another train, enhance border
        if (conflicts && conflicts.hasConflict) {
            delayOverlay.classList.add('has-conflict');
            delayOverlay.style.borderColor = userBorderColor;
            if (style === 'color-coded') {
                delayOverlay.style.borderWidth = '3px';
            } else {
                delayOverlay.style.opacity = '0.8';
            }
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
            turnaroundOverlay.style.setProperty('--overlay-color', userBorderColor);

            // Make turnaround overlay also use dashed border for consistency
            if (style === 'color-coded') {
                turnaroundOverlay.style.border = `1px dashed ${userBorderColor}`;
            }
            
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
            toleranceOverlay.style.borderColor = userBorderColor;

            // Make tolerance overlay also use dashed border for consistency
            if (style === 'color-coded') {
                toleranceOverlay.style.borderStyle = 'dashed';
            }
            
            trainBar.appendChild(toleranceOverlay);
        }
        
        // Add conflict warning icon if needed - respect user setting
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
            trainBar.classList.remove('early-extended');
            const overlays = trainBar.querySelectorAll('.delay-overlay-offset');
            const warnings = trainBar.querySelectorAll('.conflict-warning-icon');
            const earlyPills = trainBar.querySelectorAll('.early-pill-floating');

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
            earlyPills.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        } catch (error) {
            logger.error('Visualizer', 'Error removing delay overlays', error);
        }
    }

    applyEarlyExtension(trainBar, train, delayInfo, delayPixels) {
        const visual = trainBar.querySelector('.train-bar-visual') || trainBar;
        const visualStyle = window.getComputedStyle(visual);
        const barColor = visualStyle.backgroundColor || this.settings.colors.early || '#22C55E';
        const borderColor = visualStyle.borderColor || this.getUserBorderColor();
        const delayMinutes = Math.abs(delayInfo.delayMinutes || 0);

        const arrMs = train.arrTime ? train.arrTime.getTime() : null;
        if (!arrMs) return;
        const earlyStartMs = arrMs - delayMinutes * 60 * 1000;

        const sameTrack = Array.isArray(window.cachedTrains)
            ? window.cachedTrains.filter((other) => other.id !== train.id && other.trackId === train.trackId)
            : [];
        let clipPixels = delayPixels;
        for (const other of sameTrack) {
            const otherEndMs = other.depTime ? other.depTime.getTime() : (other.arrTime ? other.arrTime.getTime() : null);
            if (!otherEndMs) continue;
            if (otherEndMs <= earlyStartMs || otherEndMs >= arrMs) continue;
            const overlapMinutes = Math.ceil((otherEndMs - earlyStartMs) / 60000);
            const overlapPixels = Math.max(0, overlapMinutes * (window.currentPixelsPerHour / 60));
            clipPixels = Math.min(clipPixels, Math.max(0, delayPixels - overlapPixels));
        }

        /* Too narrow to read as a bar segment (e.g. overlap on same track) — use pill instead of a green sliver */
        const minEarlyWidthPx = 12;
        if (clipPixels <= minEarlyWidthPx) {
            const pill = document.createElement('div');
            pill.className = 'early-pill-floating';
            const style = this.settings.visualizationStyle || 'color-coded';
            if (style === 'dashed') {
                pill.classList.add('early-pill-floating--with-text');
                pill.textContent = `↶ ${delayMinutes} min`;
            }
            const partialNote = clipPixels < delayPixels
                ? ' (kortare p.g.a. annat tåg på samma spår)'
                : '';
            pill.setAttribute('role', 'img');
            pill.setAttribute('aria-label', `För tidig med ${delayMinutes} min, planerad ankomst ${train.arrTime.toTimeString().slice(0, 5)}${partialNote}`);
            pill.title = `För tidig med ${delayMinutes} min. Planerad ankomst ${train.arrTime.toTimeString().slice(0, 5)}${partialNote}`;
            trainBar.appendChild(pill);
            return;
        }

        const timeStr = train.arrTime.toTimeString().slice(0, 5);
        const isPartial = clipPixels < delayPixels;
        const titleParts = [
            `För tidig med ${delayMinutes} min (ej försening)`,
            `Planerad ankomst ${timeStr}`
        ];
        if (isPartial) {
            titleParts.push('Kortare segment — annat tåg på samma spår');
        }

        const earlyOverlay = document.createElement('div');
        earlyOverlay.className = 'delay-overlay-offset early-extension';
        if (isPartial) {
            earlyOverlay.classList.add('early-extension--partial');
        }
        earlyOverlay.style.left = `-${clipPixels}px`;
        earlyOverlay.style.width = `${clipPixels}px`;
        earlyOverlay.style.setProperty('--early-bar-color', barColor);
        earlyOverlay.style.setProperty('--early-border-color', borderColor);
        earlyOverlay.setAttribute('role', 'img');
        earlyOverlay.setAttribute('aria-label', titleParts.join('. '));
        earlyOverlay.title = titleParts.join(' · ');

        const visStyle = this.settings.visualizationStyle || 'color-coded';
        if (visStyle === 'dashed') {
            const labelEl = document.createElement('span');
            labelEl.className = 'early-extension__label early-extension__label--visible';
            labelEl.textContent = `↶${delayMinutes} min`;
            labelEl.setAttribute('aria-hidden', 'true');
            earlyOverlay.appendChild(labelEl);
        }

        const marker = document.createElement('div');
        marker.className = 'early-extension__planned-marker';
        marker.title = `Planerad ankomst ${timeStr}`;
        earlyOverlay.appendChild(marker);

        earlyOverlay.addEventListener('mouseenter', () => trainBar.classList.add('is-hovered'));
        earlyOverlay.addEventListener('mouseleave', () => trainBar.classList.remove('is-hovered'));

        trainBar.appendChild(earlyOverlay);
        trainBar.classList.add('early-extended');
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

