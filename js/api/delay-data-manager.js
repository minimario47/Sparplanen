/**
 * Delay Data Manager - Stores and manages train delay information
 * Handles train number lookups and data updates
 */

class DelayDataManager {
    constructor() {
        // `${ymd}:${trainNumber}:${activity}` -> delayInfo. The date prefix is
        // needed once the fetch window spans midnight: the same train number
        // runs the same schedule every day, so "today 05:30" and "tomorrow
        // 05:30" both fit a whole-day window.
        this.delayData = new Map();
        this.lastUpdateTime = null;
        this.totalTrains = 0;

        logger.info('DelayData', 'DelayDataManager initialized');
    }

    /**
     * Date (YYYY-MM-DD) of an announcement. Trafikverket sends Swedish local
     * times with offset (e.g. 2026-06-11T14:30:00.000+02:00), so the date is
     * the leading substring. Falls back to today.
     */
    getAnnouncementYmd(advertisedTime) {
        const s = String(advertisedTime || '');
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        return this.getStockholmYmd(0);
    }

    /**
     * Today (offset in days) as YYYY-MM-DD in Europe/Stockholm. Memoized per
     * minute — called several times per train bar during visualization.
     */
    getStockholmYmd(dayOffset = 0) {
        const minute = Math.floor(Date.now() / 60000);
        if (!this._ymdCache || this._ymdCache.minute !== minute) {
            this._ymdCache = { minute, byOffset: {} };
        }
        if (this._ymdCache.byOffset[dayOffset] !== undefined) {
            return this._ymdCache.byOffset[dayOffset];
        }
        const d = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
        let ymd;
        try {
            if (!this._ymdFormatter) {
                this._ymdFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Europe/Stockholm',
                    year: 'numeric', month: '2-digit', day: '2-digit'
                });
            }
            ymd = this._ymdFormatter.format(d);
        } catch (e) {
            ymd = d.toISOString().slice(0, 10);
        }
        this._ymdCache.byOffset[dayOffset] = ymd;
        return ymd;
    }

    /**
     * Update delay data from API response. Records are MERGED into the store
     * (the near/far tiers each cover only part of the day). A record with an
     * actual time is final — it is never overwritten by an estimate and never
     * refetched once it leaves the polling window.
     */
    updateData(trainsArray) {
        if (!Array.isArray(trainsArray)) {
            logger.error('DelayData', 'Invalid data: expected array', { received: typeof trainsArray });
            return;
        }

        // Process each train. Feeds older than the Avgång rollout have no
        // activityType — treat those records as arrivals (previous behavior).
        trainsArray.forEach(train => {
            const trainNumber = train.trainNumber;
            if (!trainNumber) {
                logger.warn('DelayData', 'Train missing trainNumber', train);
                return;
            }

            const activity = train.activityType === 'departure' ? 'departure' : 'arrival';
            const key = `${this.getAnnouncementYmd(train.advertisedTime)}:${String(trainNumber).trim()}:${activity}`;

            // Finalized records win over estimates.
            const existing = this.delayData.get(key);
            if (existing && existing.actualTime && !train.actualTime) return;

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

            this.delayData.set(key, delayInfo);
        });

        this.pruneOldDates();
        this.totalTrains = this.delayData.size;
        this.lastUpdateTime = new Date();
        // Summary is logged in integration instead of here
    }

    /**
     * Day-rollover cleanup: keep yesterday (overnight tails), today and
     * tomorrow; drop anything older so the store doesn't grow forever.
     */
    pruneOldDates() {
        const keep = new Set([
            this.getStockholmYmd(-1),
            this.getStockholmYmd(0),
            this.getStockholmYmd(1)
        ]);
        for (const key of this.delayData.keys()) {
            if (!keep.has(key.slice(0, 10))) this.delayData.delete(key);
        }
    }

    /**
     * Get delay info for specific train number.
     * Optional `leg` ('arrival' | 'departure') selects the matching activity;
     * falls back to the other activity so old feeds (arrival-only) still
     * answer departure lookups. Without `leg`, arrival is preferred.
     * Optional `dateHint` (YYYY-MM-DD) picks the right calendar day when the
     * store spans midnight; without it, today > yesterday > tomorrow.
     */
    getDelayInfo(trainNumber, leg, dateHint) {
        if (!trainNumber) return null;
        const n = String(trainNumber).trim();
        if (!n) return null;

        const preferred = leg === 'departure' ? 'departure' : 'arrival';
        const fallback = preferred === 'departure' ? 'arrival' : 'departure';
        const dates = [dateHint, this.getStockholmYmd(0), this.getStockholmYmd(-1), this.getStockholmYmd(1)]
            .filter((d, i, arr) => d && arr.indexOf(d) === i);

        // Date proximity beats leg fallback within a date: a same-day record
        // for the other leg is more likely the same physical train than
        // another day's record for the requested leg.
        for (const ymd of dates) {
            const hit = this.delayData.get(`${ymd}:${n}:${preferred}`) ||
                        this.delayData.get(`${ymd}:${n}:${fallback}`);
            if (hit) return hit;
        }
        return null;
    }

    /**
     * Snapshot of every stored record (merged across tiers/dates).
     */
    getAllTrains() {
        return Array.from(this.delayData.values());
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

