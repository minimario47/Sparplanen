/**
 * Delay Integration - Main orchestrator for train delay system
 * Coordinates API client, data manager, conflict detector, and visualizers
 */

class DelayIntegration {
    constructor(cloudFunctionUrl) {
        this.cloudFunctionUrl = cloudFunctionUrl;
        this.apiClient = null;
        this.dataManager = null;
        this.conflictDetector = null;
        this.visualizer = null;
        this.settings = null;
        this.isInitialized = false;
        
        logger.info('Integration', 'DelayIntegration created', { url: cloudFunctionUrl });
    }
    
    /**
     * Initialize all components
     */
    async initialize() {
        logger.info('Integration', 'Starting initialization...');
        
        try {
            // Load settings
            this.settings = window.loadDelaySettings();
            logger.info('Integration', 'Settings loaded', this.settings);
            
            // Initialize API client
            this.apiClient = new DelayAPIClient(this.cloudFunctionUrl);
            logger.info('Integration', 'API client initialized');
            
            // Initialize data manager
            this.dataManager = new DelayDataManager();
            logger.info('Integration', 'Data manager initialized');
            
            // Initialize conflict detector
            this.conflictDetector = new ConflictDetector();
            logger.info('Integration', 'Conflict detector initialized');
            
            // Initialize visualizer based on mode
            this.visualizer = this.createVisualizer(this.settings.mode);
            logger.info('Integration', `Visualizer initialized: ${this.settings.mode}`);
            
            // Set up event listeners
            this.setupEventListeners();
            logger.info('Integration', 'Event listeners set up');
            
            // Set initial status to disconnected (red) - assume failure first
            this.updateConnectionStatus();

            // Start auto-update
            this.apiClient.startAutoUpdate(30000); // 30 seconds
            logger.info('Integration', 'Auto-update started');

            this.isInitialized = true;
            logger.info('Integration', '✅ Initialization complete');
            
            return true;
            
        } catch (error) {
            logger.error('Integration', 'Initialization failed', error);
            throw error;
        }
    }
    
    /**
     * Create visualizer based on mode
     */
    createVisualizer(mode) {
        const visualizerSettings = {
            colorThresholds: this.settings.colorThresholds,
            colors: this.settings.colors,
            showWarnings: this.settings.showWarnings,
            visualizationStyle: this.settings.visualizationStyle,
            turnaroundTime: this.settings.turnaroundTime, // Include turnaround time for delay calculations
            conflictTolerance: this.settings.conflictTolerance,
            turnaroundEnabled: this.settings.turnaroundEnabled,
            conflictToleranceEnabled: this.settings.conflictToleranceEnabled
        };
        
        switch (mode) {
            case 'icon':
                return new IconVisualizer(visualizerSettings);
            case 'both':
                return new CombinedVisualizer(visualizerSettings);
            case 'offset':
            default:
                return new OffsetVisualizer(visualizerSettings);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen to API data updates
        this.apiClient.on('data-updated', (data) => {
            if (window.__DEBUG_DELAY_FEED) {
                console.groupCollapsed(`🔄 Delay Update: ${data.trains.length} trains (${data.tier || 'near'})`);
                console.log('📊 Summary:', {
                    total: data.trains.length,
                    delayed: data.summary?.delayed || 0,
                    early: data.summary?.early || 0,
                    onTime: data.summary?.onTime || 0
                });
            }

            this.dataManager.updateData(data.trains);
            try {
                // Listeners get the merged store, not the raw tier payload —
                // a far-tier response alone would otherwise wipe near-window
                // trains from e.g. the late-arrivals panel.
                window.dispatchEvent(new CustomEvent('delay-feed-updated', {
                    detail: {
                        trains: this.dataManager.getAllTrains(),
                        summary: this.dataManager.getSummary(),
                        lastUpdated: data.lastUpdated,
                        tier: data.tier || 'near'
                    }
                }));
            } catch (e) {
                logger.warn('Integration', 'delay-feed-updated dispatch failed', e);
            }
            this.updateAllVisualizations();
            this.updateConnectionStatus();

            if (window.__DEBUG_DELAY_FEED) {
                console.log(`⏰ Next delay update expected in ${this.apiClient.updateIntervalMs / 1000} seconds`);
                console.groupEnd();
            }
        });
        
        // Listen to API connection changes
        this.apiClient.on('connection-changed', ({ newState }) => {
            logger.info('Integration', 'Connection state changed', { newState });
            this.updateConnectionStatus();
        });
        
        // Listen to API errors
        this.apiClient.on('error', ({ error, retryCount }) => {
            logger.error('Integration', 'API error received', { error, retryCount });
        });
        
        // Listen to settings changes
        window.addEventListener('delay-settings-changed', (e) => {
            logger.info('Integration', 'Settings changed event received');
            this.handleSettingsChange(e.detail);
        });
        
        // Listen to schedule render events (if available)
        window.addEventListener('trains-rendered', () => {
            logger.info('Integration', 'Trains rendered event received');
            setTimeout(() => this.updateAllVisualizations(), 100);
        });
        
        // Listen to time manager changes (when user navigates time)
        if (window.TimeManager) {
            window.TimeManager.addListener((event) => {
                // Don't update visualizations on following_update - they don't change when just scrolling
                if (event.type === 'following_update') return;
                
                logger.info('Integration', 'Time manager state changed', { type: event.type });
                setTimeout(() => this.updateAllVisualizations(), 100);
            });
        }
    }
    
    /**
     * Handle settings change
     */
    handleSettingsChange(newSettings) {
        // The settings event only carries a subset of keys — drop undefined
        // values so they don't overwrite existing settings (e.g. wiping
        // colorThresholds, which crashes getSeverity on the next render).
        const defined = Object.fromEntries(
            Object.entries(newSettings || {}).filter(([, value]) => value !== undefined)
        );
        this.settings = { ...this.settings, ...defined };

        // Recreate visualizer if mode changed
        const currentMode = this.visualizer.constructor.name.toLowerCase().replace('visualizer', '');
        if (defined.mode && defined.mode !== currentMode) {
            logger.info('Integration', `Switching visualizer mode: ${currentMode} -> ${defined.mode}`);
            this.visualizer = this.createVisualizer(defined.mode);
        } else {
            // Update settings in current visualizer
            this.visualizer.updateSettings(defined);
        }
        
        // Re-apply visualizations with new settings
        this.updateAllVisualizations();
        
        logger.info('Integration', 'Settings applied and visualizations updated');
    }
    
    /**
     * Build delay contexts for each scheduled leg on a train bar.
     */
    getDelayContextsForTrain(train) {
        if (!train || !this.dataManager) return [];
        const contexts = [];
        const seen = new Set();
        // Stitched next-day trains (dayOffset = 1) must match tomorrow's
        // announcements, not today's same-numbered train.
        const dateHint = this.dataManager.getStockholmYmd(train.dayOffset || 0);
        const add = (trainNumber, leg, side, scheduledTime) => {
            const number = String(trainNumber || '').trim();
            // Dedupe per (number, leg) — a turnaround that keeps the same
            // number still has two distinct legs with their own API data.
            const dedupeKey = `${number}:${leg}`;
            if (!number || seen.has(dedupeKey)) return;
            // scheduledTime gates the match against this leg's planned time, so
            // an OTN/ATN collision or wrong-day record can't attach here.
            const delayInfo = this.dataManager.getDelayInfo(number, leg, dateHint, scheduledTime);
            if (!delayInfo) return;
            // Cross-activity fallback: when the record belongs to the other
            // leg's activity and this bar uses the same number for both legs,
            // let the matching leg claim it — otherwise one record would
            // produce duplicate contexts on both legs.
            const otherNumber = String((leg === 'arrival'
                ? train.departureTrainNumber
                : train.arrivalTrainNumber) || '').trim();
            if (delayInfo.activityType && delayInfo.activityType !== leg && otherNumber === number) return;
            seen.add(dedupeKey);
            contexts.push({
                trainNumber: number,
                leg,
                side,
                delayInfo,
                scheduledTime,
                labelPrefix: leg === 'arrival' ? 'Ank' : 'Avg'
            });
        };

        add(train.arrivalTrainNumber, 'arrival', 'arrival', train.arrTime);
        add(train.departureTrainNumber, 'departure', 'departure', train.depTime);
        return contexts;
    }

    /**
     * Detect track changes from the API and (optionally) auto-switch trains
     * to their actual track. Returns true if anything was mutated and a
     * re-render is required.
     */
    detectTrackChanges() {
        if (!Array.isArray(window.cachedTrains) || !window.TrackChangesStore) return false;

        const userSettings = window.SettingsModal?.getCurrentSettings?.() || {};
        const autoSwitch = userSettings.trackChangesAutoSwitch !== false;
        const splitEnabled = userSettings.trackChangesSplitBar !== false;

        const validTracks = new Set();
        if (Array.isArray(window.trackDefinitions)) {
            window.trackDefinitions.forEach((t) => {
                const n = parseInt(t.publicTrackNumber, 10);
                if (Number.isFinite(n)) validTracks.add(n);
            });
        }

        let mutated = false;

        window.cachedTrains.forEach((train) => {
            if (!train) return;

            // Planned track stays stable even after auto-switch mutates trackId.
            const planned = parseInt(train.plannedTrackId ?? train.trackId, 10);
            if (!Number.isFinite(planned)) return;

            // When a previously split train loses its API data (announcements
            // aged out of the feed), fold the bar back onto the planned track.
            const clearSplit = () => {
                if (train.splitTracks) {
                    train.splitTracks = null;
                    if (train.trackId !== planned) train.trackId = planned;
                    mutated = true;
                }
            };

            const contexts = this.getDelayContextsForTrain(train)
                .filter((ctx) => ctx.delayInfo && ctx.delayInfo.trackAtLocation != null);
            if (contexts.length === 0) { clearSplit(); return; }

            const validContexts = contexts.map((ctx) => ({
                ...ctx,
                apiTrack: parseInt(ctx.delayInfo.trackAtLocation, 10)
            })).filter((ctx) => Number.isFinite(ctx.apiTrack) && (validTracks.size === 0 || validTracks.has(ctx.apiTrack)));

            if (validContexts.length === 0) { clearSplit(); return; }

            validContexts.forEach((ctx) => {
                if (ctx.apiTrack === planned) return;
                const changeId = `${train.id}:${ctx.leg}:${ctx.trainNumber}`;
                window.TrackChangesStore.recordChange(changeId, planned, ctx.apiTrack, {
                    trainId: train.id,
                    trainNumber: ctx.trainNumber,
                    leg: ctx.leg
                });
            });

            // Effective track per leg. Unknown departure ⇒ the set presumably
            // stays where it arrived; known departure + unknown arrival ⇒ the
            // arrival still happens on the planned track.
            const arrCtx = validContexts.find((ctx) => ctx.leg === 'arrival');
            const depCtx = validContexts.find((ctx) => ctx.leg === 'departure');
            const effArr = arrCtx ? arrCtx.apiTrack : planned;
            const effDep = depCtx ? depCtx.apiTrack : effArr;

            if (effArr === effDep) {
                if (train.splitTracks) { train.splitTracks = null; mutated = true; }
                if (autoSwitch && train.trackId !== effArr) {
                    if (effArr === planned) {
                        // Moving back to plan — record it so the move is visible.
                        validContexts.forEach((ctx) => {
                            const changeId = `${train.id}:${ctx.leg}:${ctx.trainNumber}`;
                            window.TrackChangesStore.recordChange(changeId, train.trackId, effArr, {
                                trainId: train.id,
                                trainNumber: ctx.trainNumber,
                                leg: ctx.leg
                            });
                        });
                    }
                    train.trackId = effArr;
                    mutated = true;
                }
                return;
            }

            // Divergent legs. Respect "dölj spårändring": if the user hid every
            // recorded change for this train, don't force the split back.
            const changeIds = validContexts
                .filter((ctx) => ctx.apiTrack !== planned)
                .map((ctx) => `${train.id}:${ctx.leg}:${ctx.trainNumber}`);
            const allHidden = changeIds.length > 0 &&
                changeIds.every((id) => window.TrackChangesStore.isHidden(id));

            const canSplit = splitEnabled && !allHidden && train.arrTime && train.depTime;

            if (canSplit) {
                // The split visual supersedes the "conflicting reports" state.
                validContexts.forEach((ctx) => {
                    const raw = window.TrackChangesStore.getRaw(`${train.id}:${ctx.leg}:${ctx.trainNumber}`);
                    if (raw && raw.discrepancy) raw.discrepancy = false;
                });
                const prev = train.splitTracks;
                if (!prev || prev.arrivalTrack !== effArr || prev.departureTrack !== effDep || prev.plannedTrack !== planned) {
                    train.splitTracks = {
                        arrivalTrack: effArr,
                        departureTrack: effDep,
                        plannedTrack: planned,
                        // Keep the original timestamp so appear-effects don't
                        // re-fire on every 30s poll.
                        changedAt: prev?.changedAt ?? Date.now()
                    };
                    mutated = true;
                }
                if (train.trackId !== planned) { train.trackId = planned; mutated = true; }
            } else {
                clearSplit();
                validContexts.forEach((ctx) => {
                    if (ctx.apiTrack === planned) return;
                    const raw = window.TrackChangesStore.getRaw(`${train.id}:${ctx.leg}:${ctx.trainNumber}`);
                    if (raw) raw.discrepancy = true;
                });
            }
        });

        return mutated;
    }

    /**
     * Update all train visualizations
     */
    updateAllVisualizations() {
        if (!this.isInitialized) {
            logger.warn('Integration', 'Cannot update visualizations - not initialized');
            return;
        }

        if (!this._isApplyingTrackChange) {
            const needsRerender = this.detectTrackChanges();
            if (needsRerender && window.scheduleRenderer?.refresh) {
                this._isApplyingTrackChange = true;
                try {
                    window.scheduleRenderer.refresh();
                } finally {
                    this._isApplyingTrackChange = false;
                }
                // The refresh schedules its own delayed updateAllVisualizations call
                // (see schedule-renderer.js renderFullSchedule), so bail here to
                // avoid running the visualization pass twice on stale DOM nodes.
                return;
            }
        }

        const trainBars = document.querySelectorAll('.train-bar');
        let visualizedCount = 0;
        let conflictCount = 0;
        let delayStats = { minor: 0, moderate: 0, significant: 0, severe: 0, early: 0 };
        
        trainBars.forEach(trainBar => {
            // Safety checks to prevent DOM issues
            if (!trainBar || !trainBar.dataset || !trainBar.parentNode) {
                return;
            }

            const trainId = trainBar.dataset.trainId;
            if (!trainId) return;

            // Find train data
            const train = window.cachedTrains?.find(t => String(t.id) === String(trainId));
            if (!train) return;
            
            const allContexts = this.getDelayContextsForTrain(train);
            // A torn (split) bar renders as two halves; each half only carries
            // the visuals of its own leg.
            const segment = trainBar.dataset.segment || null;
            const delayContexts = segment
                ? allContexts.filter((ctx) => ctx.leg === segment)
                : allContexts;
            if (delayContexts.length === 0) return;

            const suppressedSet = window.suppressedDelays;
            const arrNum = String(train.arrivalTrainNumber || '').trim();
            const depNum = String(train.departureTrainNumber || '').trim();
            const isSuppressed =
                suppressedSet instanceof Set &&
                ((arrNum && suppressedSet.has(arrNum)) || (depNum && suppressedSet.has(depNum)));
            if (isSuppressed) {
                this.visualizer.remove(trainBar);
                trainBar.classList.remove('is-canceled', 'is-replaced', 'is-delayed');
                trainBar.classList.add('is-suppressed');
                return;
            }
            trainBar.classList.remove('is-suppressed');

            if (this.visualizer && typeof this.visualizer.remove === 'function') {
                this.visualizer.remove(trainBar);
            }
            if (trainBar.dataset.baseTitle !== undefined) {
                trainBar.title = trainBar.dataset.baseTitle;
            }

            // Handle canceled/replaced trains — each canceled leg gets its own
            // X above that train's number; the bar itself only fades when every
            // numbered leg on it is canceled (a turnaround can lose one train
            // while the other still runs).
            const canceledContexts = delayContexts.filter((ctx) => ctx.delayInfo.isCanceled || ctx.delayInfo.isReplaced);
            if (canceledContexts.length > 0) {
                const legsOnBar = segment
                    ? [segment]
                    : [
                        ...(arrNum ? ['arrival'] : []),
                        ...(depNum ? ['departure'] : [])
                    ];
                const canceledLegs = new Set(canceledContexts.map((ctx) => ctx.leg));
                const fullyCanceled = legsOnBar.length > 0 && legsOnBar.every((leg) => canceledLegs.has(leg));
                this.visualizer.addCancellationOverlay(trainBar, canceledContexts, { fullyCanceled });
                visualizedCount++;

                // Rebuild the title from its pre-cancellation base each cycle so
                // status lines don't accumulate across refreshes.
                if (trainBar.dataset.baseTitle === undefined) {
                    trainBar.dataset.baseTitle = trainBar.title || '';
                }
                // Set dedupes a same-number turnaround (both legs canceled =
                // two contexts with identical lines).
                const statusLines = [...new Set(canceledContexts.map((ctx) => {
                    const status = ctx.delayInfo.isCanceled ? 'INSTÄLLT' : 'ERSATT';
                    const info = ctx.delayInfo.deviationDescription || '';
                    return `Tåg ${ctx.trainNumber}: ${status}${info ? '\nInfo: ' + info : ''}`;
                }))];
                trainBar.title = `${trainBar.dataset.baseTitle}\n\n${statusLines.join('\n')}`.trim();

                canceledContexts.forEach((ctx) => {
                    logger.warn('Integration', `Train ${train.id} ${ctx.leg} is ${ctx.delayInfo.isCanceled ? 'INSTÄLLT' : 'ERSATT'}`, {
                        trainNumber: ctx.trainNumber,
                        info: ctx.delayInfo.deviationDescription || ''
                    });
                });
            }

            const significantContexts = delayContexts.filter((ctx) => {
                if (ctx.delayInfo.isCanceled || ctx.delayInfo.isReplaced) return false;
                const delayMinutes = ctx.delayInfo.delayMinutes;
                return delayMinutes && Math.abs(delayMinutes) > 2;
            });

            if (significantContexts.length === 0) {
                return;
            }
            
            significantContexts.forEach((ctx) => {
                const delayInfo = ctx.delayInfo;
                let conflicts = null;
                if (this.settings.showWarnings) {
                    conflicts = this.conflictDetector.detectConflicts(
                        train,
                        delayInfo,
                        window.cachedTrains || [],
                        this.settings
                    );
                    
                    if (conflicts.hasConflict) {
                        conflictCount++;
                    }
                }

                if (this.visualizer && this.visualizer.getSeverity) {
                    const severity = this.visualizer.getSeverity(delayInfo.delayMinutes);
                    if (severity) {
                        if (delayInfo.delayMinutes > 0) {
                            delayStats[severity] = (delayStats[severity] || 0) + 1;
                        } else {
                            delayStats.early = (delayStats.early || 0) + 1;
                        }
                    }
                }
                this.visualizer.apply(trainBar, train, delayInfo, conflicts, ctx, { preserve: true });
                visualizedCount++;
            });
        });
        
        if (window.__DEBUG_DELAY_FEED) {
            console.log('✅ Delay Visualization Summary:', {
                processed: visualizedCount,
                conflicts: conflictCount,
                delayBreakdown: delayStats,
                totalTrains: trainBars.length
            });
        }
    }
    
    /**
     * Update connection status indicator
     */
    updateConnectionStatus() {
        const statusElement = document.getElementById('api-status');
        if (!statusElement) return;
        
        const state = this.apiClient.getConnectionState();
        const stats = this.apiClient.getStats();
        const summary = this.dataManager.getSummary();
        
        // Remove all status classes
        statusElement.classList.remove('status-connected', 'status-disconnected', 'status-error', 'status-connecting');
        
        // Add appropriate status class
        statusElement.classList.add(`status-${state}`);
        
        // Update tooltip
        let tooltip = '';
        if (state === 'connected') {
            tooltip = `Ansluten till förseningsdata\n`;
            tooltip += `${summary.total} tåg spårade\n`;
            tooltip += `${summary.delayed} försenade, ${summary.early} tidiga\n`;
            tooltip += `Uppdaterad för ${stats.secondsSinceLastUpdate}s sedan`;
        } else if (state === 'disconnected') {
            tooltip = 'Frånkopplad från förseningsdata';
        } else if (state === 'error') {
            tooltip = 'Fel vid anslutning till förseningsdata';
        } else {
            tooltip = 'Ansluter till förseningsdata...';
        }
        
        statusElement.title = tooltip;
        
        logger.info('Integration', 'Connection status updated', { state, stats: summary });
    }
    
    /**
     * Force immediate update
     */
    async forceUpdate() {
        logger.info('Integration', 'Force update requested');
        try {
            await this.apiClient.forceUpdate();
            logger.info('Integration', 'Force update completed');
        } catch (error) {
            logger.error('Integration', 'Force update failed', error);
        }
    }
    
    /**
     * Get integration statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            api: this.apiClient?.getStats(),
            data: this.dataManager?.getSummary(),
            settings: this.settings
        };
    }
    
    /**
     * Stop integration (cleanup)
     */
    stop() {
        logger.info('Integration', 'Stopping delay integration');
        if (this.apiClient) {
            this.apiClient.stopAutoUpdate();
        }
        this.isInitialized = false;
    }
}

// Export for use in other modules
window.DelayIntegration = DelayIntegration;

// Global instance (will be initialized in app.js)
window.delayIntegration = null;
