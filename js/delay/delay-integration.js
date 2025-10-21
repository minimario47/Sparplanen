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
            turnaroundTime: this.settings.turnaroundTime, // Include turnaround time for delay calculations
            conflictTolerance: this.settings.conflictTolerance
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
            console.groupCollapsed(`🔄 Delay Update: ${data.trains.length} trains`);
            console.log('📊 Summary:', {
                total: data.trains.length,
                delayed: data.summary?.delayed || 0,
                early: data.summary?.early || 0,
                onTime: data.summary?.onTime || 0
            });

            this.dataManager.updateData(data.trains);
            this.updateAllVisualizations();
            this.updateConnectionStatus();

            console.log(`⏰ Next delay update expected in ${this.apiClient.updateIntervalMs / 1000} seconds`);
            console.groupEnd();
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
        this.settings = newSettings;
        
        // Recreate visualizer if mode changed
        const currentMode = this.visualizer.constructor.name.toLowerCase().replace('visualizer', '');
        if (newSettings.mode !== currentMode) {
            logger.info('Integration', `Switching visualizer mode: ${currentMode} -> ${newSettings.mode}`);
            this.visualizer = this.createVisualizer(newSettings.mode);
        } else {
            // Update settings in current visualizer
            this.visualizer.updateSettings({
                colorThresholds: newSettings.colorThresholds,
                colors: newSettings.colors,
                showWarnings: newSettings.showWarnings,
                turnaroundTime: newSettings.turnaroundTime,
                conflictTolerance: newSettings.conflictTolerance
            });
        }
        
        // Re-apply visualizations with new settings
        this.updateAllVisualizations();
        
        logger.info('Integration', 'Settings applied and visualizations updated');
    }
    
    /**
     * Update all train visualizations
     */
    updateAllVisualizations() {
        if (!this.isInitialized) {
            logger.warn('Integration', 'Cannot update visualizations - not initialized');
            return;
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
            
            // Check for delay info on arrival or departure
            let delayInfo = null;
            if (train.arrivalTrainNumber) {
                delayInfo = this.dataManager.getDelayInfo(train.arrivalTrainNumber);
            }
            if (!delayInfo && train.departureTrainNumber) {
                delayInfo = this.dataManager.getDelayInfo(train.departureTrainNumber);
            }
            
            if (!delayInfo) return;
            
            // Handle canceled/replaced trains - always show overlay
            if (delayInfo.isCanceled || delayInfo.isReplaced) {
                this.visualizer.addCancellationOverlay(trainBar, delayInfo);
                visualizedCount++;
                
                // Update tooltip with cancellation info
                const currentTitle = trainBar.title || '';
                const status = delayInfo.isCanceled ? 'INSTÄLLT' : 'ERSATT';
                const info = delayInfo.deviationDescription || '';
                trainBar.title = `${currentTitle}\n\nStatus: ${status}${info ? '\nInfo: ' + info : ''}`;
                
                logger.warn('Integration', `Train ${train.id} is ${status}`, {
                    trainNumber: train.arrivalTrainNumber || train.departureTrainNumber,
                    info
                });
                return;
            }
            
            // Skip if no significant delay
            if (!delayInfo.delayMinutes || Math.abs(delayInfo.delayMinutes) <= 2) {
                return;
            }
            
            // Detect conflicts
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
            
            // Apply visualization and collect statistics
            if (delayInfo.delayMinutes !== 0 && Math.abs(delayInfo.delayMinutes) > 2) {
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
            }
            this.visualizer.apply(trainBar, train, delayInfo, conflicts);
            visualizedCount++;
        });
        
        // Log condensed summary instead of individual train details
        console.log('✅ Delay Visualization Summary:', {
            processed: visualizedCount,
            conflicts: conflictCount,
            delayBreakdown: delayStats,
            totalTrains: trainBars.length
        });
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

