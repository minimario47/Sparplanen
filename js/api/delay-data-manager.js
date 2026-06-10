/**
 * Delay Data Manager - Stores and manages train delay information
 * Handles train number lookups and data updates
 */

class DelayDataManager {
    constructor() {
        this.delayData = new Map(); // `${trainNumber}:${activity}` -> delayInfo
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
        
        // Process each train. Feeds older than the Avgång rollout have no
        // activityType — treat those records as arrivals (previous behavior).
        trainsArray.forEach(train => {
            const trainNumber = train.trainNumber;
            if (!trainNumber) {
                logger.warn('DelayData', 'Train missing trainNumber', train);
                return;
            }

            const activity = train.activityType === 'departure' ? 'departure' : 'arrival';
            const delayInfo = {
                trainNumber,
                activityType: activity,
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
                toLocation: train.toLocation || '',
                lastUpdated: train.lastUpdated
            };

            this.delayData.set(`${String(trainNumber).trim()}:${activity}`, delayInfo);
        });
        
        this.totalTrains = trainsArray.length;
        this.lastUpdateTime = new Date();
        // Summary is logged in integration instead of here
    }
    
    /**
     * Get delay info for specific train number.
     * Optional `leg` ('arrival' | 'departure') selects the matching activity;
     * falls back to the other activity so old feeds (arrival-only) still
     * answer departure lookups. Without `leg`, arrival is preferred.
     */
    getDelayInfo(trainNumber, leg) {
        if (!trainNumber) return null;
        const n = String(trainNumber).trim();
        if (!n) return null;

        const preferred = leg === 'departure' ? 'departure' : 'arrival';
        const fallback = preferred === 'departure' ? 'arrival' : 'departure';
        return this.delayData.get(`${n}:${preferred}`) ||
               this.delayData.get(`${n}:${fallback}`) ||
               null;
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
        this.delayData.forEach((info) => {
            if (info.delayMinutes !== null &&
                info.delayMinutes !== undefined &&
                Math.abs(info.delayMinutes) > 2) {
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
        this.delayData.forEach((info) => {
            const delayed = info.delayMinutes !== null &&
                info.delayMinutes !== undefined &&
                Math.abs(info.delayMinutes) > 2;
            if (delayed || info.isCanceled || info.isReplaced) {
                issues.push(info);
            }
        });
        return issues;
    }
    
    /**
     * Get summary statistics
     */
    getSummary() {
        const allTrains = Array.from(this.delayData.values());
        
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

