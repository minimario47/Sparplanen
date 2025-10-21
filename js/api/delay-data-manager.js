/**
 * Delay Data Manager - Stores and manages train delay information
 * Handles train number lookups and data updates
 */

class DelayDataManager {
    constructor() {
        this.delayData = new Map(); // trainNumber -> delayInfo
        this.lastUpdateTime = null;
        this.totalTrains = 0;
        
        logger.info('DelayData', 'DelayDataManager initialized');
    }
    
    /**
     * Update delay data from API response
     */
    updateData(trainsArray) {
        if (!Array.isArray(trainsArray)) {
            logger.error('DelayData', 'Invalid data: expected array', { received: typeof trainsArray });
            return;
        }
        
        // Clear existing data
        this.delayData.clear();
        
        // Process each train
        trainsArray.forEach(train => {
            const trainNumber = train.trainNumber;
            if (!trainNumber) {
                logger.warn('DelayData', 'Train missing trainNumber', train);
                return;
            }
            
            const delayInfo = {
                trainNumber,
                delayMinutes: train.delayMinutes,
                delayStatus: train.delayStatus,
                isCanceled: train.isCanceled,
                isReplaced: train.isReplaced,
                deviationDescription: train.deviationDescription,
                estimatedTime: train.estimatedTime,
                advertisedTime: train.advertisedTime,
                actualTime: train.actualTime,
                trackAtLocation: train.trackAtLocation,
                fromLocation: train.fromLocation,
                lastUpdated: train.lastUpdated
            };
            
            // Store with both string and numeric keys for flexible lookup
            this.delayData.set(String(trainNumber), delayInfo);
            this.delayData.set(Number(trainNumber), delayInfo);
        });
        
        this.totalTrains = trainsArray.length;
        this.lastUpdateTime = new Date();
        
        // ===== TESTING: Add forced 50min delay to train 2033 =====
        const testDelayInfo = {
            trainNumber: '3561',
            delayMinutes: 30,
            delayStatus: 'DELAYED',
            isCanceled: false,
            isReplaced: false,
            deviationDescription: '[TEST] Train delayed 50 minutes for testing purposes',
            estimatedTime: null,
            advertisedTime: null,
            actualTime: null,
            trackAtLocation: null,
            fromLocation: 'Test Location',
            lastUpdated: new Date().toISOString()
        };
        this.delayData.set('3561', testDelayInfo);
        this.delayData.set(3561, testDelayInfo);
        logger.warn('DelayData', '⚠️ TEST DATA: Train 2033 has forced 50min delay');
        // =========================================================
        
        // Summary is logged in integration instead of here
    }
    
    /**
     * Get delay info for specific train number
     */
    getDelayInfo(trainNumber) {
        if (!trainNumber) return null;
        
        // Try both string and numeric lookup
        let info = this.delayData.get(trainNumber);
        if (!info && typeof trainNumber === 'string') {
            info = this.delayData.get(Number(trainNumber));
        } else if (!info && typeof trainNumber === 'number') {
            info = this.delayData.get(String(trainNumber));
        }
        
        // Verbose logging disabled for cleaner console - summary is logged in integration
        
        return info;
    }
    
    /**
     * Check if train has delay (convenience method)
     */
    hasDelay(trainNumber) {
        const info = this.getDelayInfo(trainNumber);
        if (!info) return false;
        
        return info.delayMinutes !== null && 
               info.delayMinutes !== undefined && 
               Math.abs(info.delayMinutes) > 2;
    }
    
    /**
     * Check if train is canceled
     */
    isCanceled(trainNumber) {
        const info = this.getDelayInfo(trainNumber);
        return info?.isCanceled === true;
    }
    
    /**
     * Check if train is replaced
     */
    isReplaced(trainNumber) {
        const info = this.getDelayInfo(trainNumber);
        return info?.isReplaced === true;
    }
    
    /**
     * Get all delayed trains
     */
    getDelayedTrains() {
        const delayed = [];
        this.delayData.forEach((info, key) => {
            // Only process string keys to avoid duplicates
            if (typeof key === 'string' && this.hasDelay(key)) {
                delayed.push(info);
            }
        });
        return delayed;
    }
    
    /**
     * Get all trains with issues (delayed, canceled, or replaced)
     */
    getTrainsWithIssues() {
        const issues = [];
        this.delayData.forEach((info, key) => {
            if (typeof key === 'string') {
                if (this.hasDelay(key) || info.isCanceled || info.isReplaced) {
                    issues.push(info);
                }
            }
        });
        return issues;
    }
    
    /**
     * Get summary statistics
     */
    getSummary() {
        const allTrains = [];
        this.delayData.forEach((info, key) => {
            if (typeof key === 'string') {
                allTrains.push(info);
            }
        });
        
        return {
            total: allTrains.length,
            delayed: allTrains.filter(t => t.delayStatus === 'DELAYED').length,
            early: allTrains.filter(t => t.delayStatus === 'EARLY').length,
            onTime: allTrains.filter(t => t.delayStatus === 'ON_TIME').length,
            canceled: allTrains.filter(t => t.isCanceled).length,
            replaced: allTrains.filter(t => t.isReplaced).length,
            avgDelay: allTrains.reduce((sum, t) => sum + (t.delayMinutes || 0), 0) / allTrains.length || 0,
            maxDelay: Math.max(...allTrains.map(t => t.delayMinutes || 0), 0),
            minDelay: Math.min(...allTrains.map(t => t.delayMinutes || 0), 0),
            lastUpdateTime: this.lastUpdateTime?.toISOString() || null
        };
    }
    
    /**
     * Clear all data
     */
    clear() {
        this.delayData.clear();
        this.totalTrains = 0;
        this.lastUpdateTime = null;
        logger.info('DelayData', 'All delay data cleared');
    }
    
    /**
     * Get data age in seconds
     */
    getDataAgeSeconds() {
        if (!this.lastUpdateTime) return null;
        return Math.floor((new Date() - this.lastUpdateTime) / 1000);
    }
    
    /**
     * Check if data is stale (older than threshold)
     */
    isDataStale(thresholdSeconds = 120) {
        const age = this.getDataAgeSeconds();
        return age === null || age > thresholdSeconds;
    }
}

// Export for use in other modules
window.DelayDataManager = DelayDataManager;

