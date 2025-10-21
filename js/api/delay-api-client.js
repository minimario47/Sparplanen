/**
 * Delay API Client - Manages connection to Firebase Cloud Function
 * Handles auto-updates, connection state, and error recovery
 */

class DelayAPIClient {
    constructor(cloudFunctionUrl) {
        this.cloudFunctionUrl = cloudFunctionUrl;
        this.connectionState = 'disconnected'; // connecting, connected, disconnected, error
        this.updateInterval = null;
        this.updateIntervalMs = 30000; // 30 seconds
        this.lastUpdateTime = null;
        this.lastData = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.listeners = [];
        
        logger.info('DelayAPI', 'DelayAPIClient initialized', { url: cloudFunctionUrl });
    }
    
    /**
     * Fetch delay data from Firebase Cloud Function
     */
    async fetchDelayData(location = 'G') {
        this.setConnectionState('connecting');
        logger.info('DelayAPI', `Fetching delay data for location: ${location}`);
        
        try {
            const url = `${this.cloudFunctionUrl}?location=${location}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!data.trains || !Array.isArray(data.trains)) {
                throw new Error('Invalid response structure: missing trains array');
            }
            
            this.lastData = data;
            this.lastUpdateTime = new Date();
            this.retryCount = 0;
            
            this.setConnectionState('connected');
            logger.info('DelayAPI', `Successfully fetched data for ${data.trains.length} trains`, {
                summary: data.summary
            });
            
            // Emit data-updated event
            this.emit('data-updated', data);
            
            return data;
            
        } catch (error) {
            this.retryCount++;
            logger.error('DelayAPI', `Failed to fetch delay data (attempt ${this.retryCount}/${this.maxRetries})`, {
                error: error.message
            });
            
            if (this.retryCount >= this.maxRetries) {
                this.setConnectionState('error');
            } else {
                this.setConnectionState('disconnected');
                // Exponential backoff
                const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
                logger.warn('DelayAPI', `Will retry in ${backoffTime}ms`);
                setTimeout(() => this.fetchDelayData(location), backoffTime);
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
        logger.info('DelayAPI', `Starting auto-update with interval: ${intervalMs}ms`);
        
        // Initial fetch
        this.fetchDelayData().catch(err => {
            logger.error('DelayAPI', 'Initial fetch failed', err);
        });

        // Set up interval
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

