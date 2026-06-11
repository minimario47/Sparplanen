/**
 * Delay API Client - Manages connection to Firebase Cloud Function
 * Handles auto-updates, connection state, and error recovery
 */

class DelayAPIClient {
    constructor(cloudFunctionUrl) {
        this.cloudFunctionUrl = cloudFunctionUrl;
        this.connectionState = 'disconnected'; // connecting, connected, disconnected, error
        this.updateInterval = null;
        this.updateIntervalMs = 30000; // 30 seconds (near tier: now ±2h, where estimates move)
        this.farUpdateInterval = null;
        this.farUpdateIntervalMs = 300000; // 5 minutes (far tier: rest of the schedule day)
        this.lastUpdateTime = null;
        this.lastData = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.listeners = [];

        logger.info('DelayAPI', 'DelayAPIClient initialized', { url: cloudFunctionUrl });
    }

    /**
     * Current hour in Europe/Stockholm (announcement times are Swedish local).
     */
    getStockholmHour() {
        try {
            const h = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'Europe/Stockholm', hour: '2-digit', hour12: false
            }).format(new Date());
            const n = parseInt(h, 10);
            return Number.isFinite(n) ? n : new Date().getHours();
        } catch (e) {
            return new Date().getHours();
        }
    }

    /**
     * Build the request URL for a fetch tier. Far-tier hours are integers so
     * the Cloud Function cache key only changes once per hour.
     */
    buildTierUrl(location, tier) {
        const base = `${this.cloudFunctionUrl}?location=${location}`;
        if (tier === 'near') return `${base}&tier=near`;
        if (tier === 'far') {
            const hour = this.getStockholmHour();
            // Back to 00:00 today, ahead to 06:00 tomorrow (matches the 30h timeline)
            const hoursBack = Math.max(2, Math.min(26, hour + 1));
            const hoursAhead = Math.max(2, Math.min(30, (24 - hour) + 6));
            return `${base}&tier=far&hoursBack=${hoursBack}&hoursAhead=${hoursAhead}`;
        }
        return base;
    }

    /**
     * Fetch delay data from Firebase Cloud Function
     */
    async fetchDelayData(location = 'G', tier = 'near') {
        this.setConnectionState('connecting');
        logger.info('DelayAPI', `Fetching delay data for location: ${location} (${tier})`);

        try {
            const url = this.buildTierUrl(location, tier);
            // No custom headers on GET: "Content-Type: application/json" triggers a CORS preflight
            // (OPTIONS). If the function is down or cold, edge 503 responses often lack CORS headers,
            // and the browser surfaces a generic "Load failed" instead of status text.
            const response = await fetch(url, { method: 'GET' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!data.trains || !Array.isArray(data.trains)) {
                throw new Error('Invalid response structure: missing trains array');
            }
            
            // Keep lastData as the near-window snapshot; far payloads are
            // merged into the data manager but make a poor "latest" fallback.
            if (tier !== 'far') {
                this.lastData = data;
            }
            this.lastUpdateTime = new Date();
            this.retryCount = 0;

            this.setConnectionState('connected');
            logger.info('DelayAPI', `Successfully fetched data for ${data.trains.length} trains (${tier})`, {
                summary: data.summary
            });

            // Emit data-updated event
            this.emit('data-updated', { ...data, tier });

            return data;

        } catch (error) {
            this.retryCount++;
            const message = error?.message || String(error);
            const logData = {
                error: message,
                name: error?.name,
                tier,
                url: `${this.cloudFunctionUrl}?location=${location}`
            };
            if (message === 'Load failed') {
                logData.hint =
                    'Network request did not complete (common on Safari: open the app via http://localhost instead of file://, or check firewall/VPN/ad blockers).';
            }
            logger.error('DelayAPI', `Failed to fetch delay data (attempt ${this.retryCount}/${this.maxRetries})`, logData);
            
            if (this.retryCount >= this.maxRetries) {
                this.setConnectionState('error');
            } else {
                this.setConnectionState('disconnected');
                // Exponential backoff
                const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
                logger.warn('DelayAPI', `Will retry in ${backoffTime}ms`);
                setTimeout(() => this.fetchDelayData(location, tier), backoffTime);
            }

            this.emit('error', { error, retryCount: this.retryCount });
            // Don't throw error - let the retry mechanism handle it
        }
    }
    
    /**
     * Start auto-update polling
     */
    startAutoUpdate(intervalMs = 30000) {
        if (this.updateInterval) {
            logger.warn('DelayAPI', 'Auto-update already running, stopping previous interval');
            this.stopAutoUpdate();
        }
        
        this.updateIntervalMs = intervalMs;
        logger.info('DelayAPI', `Starting auto-update with interval: ${intervalMs}ms (near) / ${this.farUpdateIntervalMs}ms (far)`);

        // Initial fetches: near first (drives the connection indicator), then
        // the whole-day far window.
        this.fetchDelayData().catch(err => {
            logger.error('DelayAPI', 'Initial fetch failed', err);
        });
        this.fetchDelayData('G', 'far').catch(err => {
            logger.error('DelayAPI', 'Initial far fetch failed', err);
        });

        // Set up intervals
        this.updateInterval = setInterval(() => {
            try {
                this.fetchDelayData().catch(err => {
                    logger.error('DelayAPI', 'Scheduled fetch failed', err);
                    // Don't let errors bubble up - they might cause page reloads
                });
            } catch (error) {
                logger.error('DelayAPI', 'Synchronous error in scheduled fetch', error);
                // Don't let synchronous errors bubble up - they might cause page reloads
            }
        }, intervalMs);

        this.farUpdateInterval = setInterval(() => {
            try {
                this.fetchDelayData('G', 'far').catch(err => {
                    logger.error('DelayAPI', 'Scheduled far fetch failed', err);
                });
            } catch (error) {
                logger.error('DelayAPI', 'Synchronous error in scheduled far fetch', error);
            }
        }, this.farUpdateIntervalMs);

        logger.info('DelayAPI', 'Auto-update started');
    }

    /**
     * Stop auto-update polling
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            logger.info('DelayAPI', 'Auto-update stopped');
        }
        if (this.farUpdateInterval) {
            clearInterval(this.farUpdateInterval);
            this.farUpdateInterval = null;
        }
    }
    
    /**
     * Force immediate update
     */
    async forceUpdate() {
        logger.info('DelayAPI', 'Force update requested');
        return await this.fetchDelayData();
    }
    
    /**
     * Get last fetched data
     */
    getLastData() {
        return this.lastData;
    }
    
    /**
     * Get time since last update
     */
    getSecondsSinceLastUpdate() {
        if (!this.lastUpdateTime) return null;
        return Math.floor((new Date() - this.lastUpdateTime) / 1000);
    }
    
    /**
     * Get connection state
     */
    getConnectionState() {
        return this.connectionState;
    }
    
    /**
     * Set connection state and emit event
     */
    setConnectionState(state) {
        if (this.connectionState !== state) {
            const oldState = this.connectionState;
            this.connectionState = state;
            logger.info('DelayAPI', `Connection state changed: ${oldState} -> ${state}`);
            this.emit('connection-changed', { oldState, newState: state });
        }
    }
    
    /**
     * Add event listener
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        this.listeners = this.listeners.filter(
            listener => listener.event !== event || listener.callback !== callback
        );
    }
    
    /**
     * Emit event to listeners
     */
    emit(event, data) {
        this.listeners
            .filter(listener => listener.event === event)
            .forEach(listener => {
                try {
                    listener.callback(data);
                } catch (error) {
                    logger.error('DelayAPI', 'Error in event listener', {
                        event,
                        error: error.message
                    });
                }
            });
    }
    
    /**
     * Get client statistics
     */
    getStats() {
        return {
            connectionState: this.connectionState,
            lastUpdateTime: this.lastUpdateTime?.toISOString() || null,
            secondsSinceLastUpdate: this.getSecondsSinceLastUpdate(),
            retryCount: this.retryCount,
            updateInterval: this.updateIntervalMs,
            isAutoUpdateActive: !!this.updateInterval,
            trainsCount: this.lastData?.trains?.length || 0
        };
    }
}

// Export for use in other modules
window.DelayAPIClient = DelayAPIClient;

