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
    createBadge(delayMinutes, severity, side, context = null) {
        const badge = document.createElement('div');
        badge.className = `delay-badge-icon delay-badge-${side} severity-${severity}`;
        
        const prefix = delayMinutes > 0 ? '+' : '';
        // The train bar already shows the train number — keep the badge to the
        // delay itself; full context goes in the tooltip.
        badge.textContent = `${prefix}${delayMinutes} min`;
        const who = context ? [context.labelPrefix, context.trainNumber].filter(Boolean).join(' ') : '';
        badge.title = `${who ? who + ': ' : ''}${prefix}${delayMinutes} min`;
        badge.dataset.delayMinutes = delayMinutes;
        badge.dataset.severity = severity;
        if (context && context.trainNumber) badge.dataset.trainNumber = context.trainNumber;
        if (context && context.leg) badge.dataset.leg = context.leg;
        
        return badge;
    }
    
    /**
     * Apply delay visualization to train bar
     */
    apply(trainBar, train, delayInfo, conflicts = null, context = null, options = {}) {
        if (!trainBar || !train || !delayInfo) return;
        
        // Remove existing badges
        if (!options.preserve) {
            this.remove(trainBar);
        }
        
        const delayMinutes = delayInfo.delayMinutes;
        const severity = this.getSeverity(delayMinutes);
        
        // Don't visualize if delay is too small
        if (!severity || Math.abs(delayMinutes) <= 2) {
            return;
        }
        
        // Leg presence must match schedule-renderer: cached trains use arrTime/depTime, not
        // scheduledArrivalTime / scheduledDepartureTime (those are only on raw service records).
        const hasArrival = !!String(train.arrivalTrainNumber || '').trim();
        const hasDeparture = !!String(train.departureTrainNumber || '').trim();

        // Normalize so API string/number train ids match schedule train numbers
        const matchesDelay = (n) => {
            if (delayInfo.trainNumber == null || n == null) return false;
            const a = String(n).trim();
            const b = String(delayInfo.trainNumber).trim();
            return a.length > 0 && b.length > 0 && a === b;
        };

        const arrivalDelayed = context?.leg
            ? context.leg === 'arrival'
            : hasArrival && matchesDelay(train.arrivalTrainNumber);
        const departureDelayed = context?.leg
            ? context.leg === 'departure'
            : hasDeparture && matchesDelay(train.departureTrainNumber);

        // När samma tågnummer/anslag gäller både ankomst och avgång: fortfarande bara en bolliknande etikett per tjänst (ingen dubbel vänster+höger).
        const showDepartureFallback =
            hasDeparture &&
            delayMinutes > 0 &&
            Math.abs(delayMinutes) > 10 &&
            !departureDelayed &&
            !arrivalDelayed;

        // Högst en sida: ingen identisk etikett både vänster och höger på samma tjänst.
        let useArrival = false;
        let useDeparture = false;
        if (arrivalDelayed && departureDelayed) {
            useArrival = true;
        } else if (arrivalDelayed) {
            useArrival = true;
        } else if (departureDelayed) {
            useDeparture = true;
        } else if (showDepartureFallback) {
            useDeparture = true;
        }

        if (useArrival) {
            const badge = this.createBadge(delayMinutes, severity, 'arrival', context);
            const position = this.calculateBadgePosition(trainBar, 'left');
            Object.assign(badge.style, {
                top: `${position.top}px`,
                left: `${position.left}px`
            });
            trainBar.appendChild(badge);
            logger.info('Visualizer', `Added arrival badge to train ${train.id}`, { delay: delayMinutes, severity });
        } else if (useDeparture) {
            const badge = this.createBadge(delayMinutes, severity, 'departure', context);
            const position = this.calculateBadgePosition(trainBar, 'right');
            Object.assign(badge.style, {
                top: `${position.top}px`,
                right: `${position.right}px`
            });
            trainBar.appendChild(badge);
            logger.info('Visualizer', `Added departure badge to train ${train.id}`, { delay: delayMinutes, severity });
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

        trainBar.classList.remove('is-canceled', 'is-replaced');
        const badges = trainBar.querySelectorAll('.delay-badge-icon');
        const warnings = trainBar.querySelectorAll('.conflict-warning-icon');
        const cancelMarks = trainBar.querySelectorAll('.cancellation-x, .cancellation-overlay');

        badges.forEach(el => el.remove());
        warnings.forEach(el => el.remove());
        cancelMarks.forEach(el => el.remove());
    }

    /**
     * Mark canceled/replaced legs. Each canceled leg gets its own X above that
     * train's number; the whole-bar fade classes are only applied when every
     * numbered leg on the bar is canceled (opts.fullyCanceled).
     */
    addCancellationOverlay(trainBar, contexts, opts = {}) {
        if (!trainBar || !contexts) return;
        const list = (Array.isArray(contexts) ? contexts : [contexts]).filter(Boolean);
        if (list.length === 0) return;

        if (opts.fullyCanceled) {
            trainBar.classList.add('is-canceled');
            if (list.some((ctx) => ctx.delayInfo?.isReplaced)) {
                trainBar.classList.add('is-replaced');
            }
        }

        const numbers = trainBar.querySelector('.train-numbers');
        list.forEach((ctx) => {
            const delayInfo = ctx.delayInfo || {};
            let position = 'center';
            if (numbers) {
                if (numbers.classList.contains('single-left')) {
                    position = 'left';
                } else if (numbers.classList.contains('single-right')) {
                    position = 'right';
                } else if (numbers.classList.contains('single-centered')) {
                    position = 'center';
                } else {
                    // Two-number layout: arrival number sits left, departure right.
                    position = ctx.leg === 'departure' ? 'right' : 'left';
                }
            }

            // One X per spot — a same-number turnaround with both legs canceled
            // shows a single X above its shared number.
            if (trainBar.querySelector(`.cancellation-x--${position}`)) return;

            const mark = document.createElement('div');
            mark.className = `cancellation-x cancellation-x--${position}`;
            mark.textContent = '✕';
            const statusText = delayInfo.isCanceled ? 'inställt' : 'ersatt med buss';
            const info = delayInfo.deviationDescription ? ` — ${delayInfo.deviationDescription}` : '';
            mark.title = `Tåg ${ctx.trainNumber} ${statusText}${info}`;
            // Hangs off the bar root, not .train-bar-visual, so the
            // fully-canceled fade doesn't wash the mark out.
            trainBar.appendChild(mark);
        });

        logger.info('Visualizer', `Added cancellation marks`, {
            legs: list.map((ctx) => ctx.leg),
            fullyCanceled: !!opts.fullyCanceled
        });
    }
}

// Export for use in other modules
window.IconVisualizer = IconVisualizer;
