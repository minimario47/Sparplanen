/**
 * Conflict Detector - Detects overlaps between delayed trains and other trains
 * Handles hard conflicts (direct overlaps) and soft conflicts (near misses)
 */

class ConflictDetector {
    constructor() {
        logger.info('Conflict', 'ConflictDetector initialized');
    }
    
    /**
     * Parse time string (HH:MM) to minutes since midnight
     */
    parseTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes)) return null;
        
        // Handle times past midnight (e.g., 24:30, 25:00)
        return (hours * 60) + minutes;
    }
    
    /**
     * Calculate actual arrival and departure times considering delay
     */
    calculateActualTimes(train, delayInfo, turnaroundTime = 10) {
        // Convert Date objects to minutes since midnight
        const scheduledArrival = train.arrTime ? Math.floor(train.arrTime.getTime() / (1000 * 60)) % (24 * 60) : null;
        const scheduledDeparture = train.depTime ? Math.floor(train.depTime.getTime() / (1000 * 60)) % (24 * 60) : null;
        const delayMinutes = delayInfo.delayMinutes || 0;
        
        if (scheduledArrival === null && scheduledDeparture === null) {
            // Disabled verbose warning for cleaner console
            return null;
        }
        
        let actualArrival = scheduledArrival !== null ? scheduledArrival + delayMinutes : null;
        let actualDeparture = scheduledDeparture !== null ? scheduledDeparture + delayMinutes : null;
        
        // Calculate extended departure (arrival + turnaround time + delay)
        let extendedDeparture = actualDeparture;
        if (actualArrival !== null && delayMinutes > 0) {
            extendedDeparture = actualArrival + turnaroundTime;
            // If extended departure is later than scheduled departure + delay, use it
            if (actualDeparture !== null && extendedDeparture > actualDeparture) {
                actualDeparture = extendedDeparture;
            }
        }
        
        return {
            scheduledArrival,
            scheduledDeparture,
            actualArrival,
            actualDeparture,
            extendedDeparture,
            delayMinutes
        };
    }
    
    /**
     * Check if two time ranges overlap
     */
    checkOverlap(time1Start, time1End, time2Start, time2End) {
        // Handle null values
        if (time1Start === null || time1End === null || time2Start === null || time2End === null) {
            return { overlaps: false, overlapMinutes: 0 };
        }
        
        // Check if ranges overlap
        const overlaps = time1Start < time2End && time2Start < time1End;
        
        if (!overlaps) {
            return { overlaps: false, overlapMinutes: 0 };
        }
        
        // Calculate overlap duration
        const overlapStart = Math.max(time1Start, time2Start);
        const overlapEnd = Math.min(time1End, time2End);
        const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
        
        return { overlaps: true, overlapMinutes };
    }
    
    /**
     * Determine which time zone the overlap occurs in
     * Returns: 'red' (delay zone), 'orange' (turnaround zone), 'yellow' (tolerance zone), or 'none'
     */
    determineOverlapZone(otherStart, otherEnd, delayedTimes, delayMinutes, turnaroundTime, tolerance) {
        // Calculate the three zones from the scheduled arrival time
        const scheduledArrival = delayedTimes.scheduledArrival;
        if (scheduledArrival === null) return 'none';
        
        // Zone boundaries (all in minutes since midnight)
        const zone1End = scheduledArrival + delayMinutes; // Red zone: actual delay
        const zone2End = zone1End + turnaroundTime; // Orange zone: turnaround time
        const zone3End = zone2End + tolerance; // Yellow zone: tolerance
        
        // Check which zone has the overlap
        // Prioritize the most critical zone if overlap spans multiple zones
        
        // Check if overlap is in red zone (most critical)
        if (otherStart < zone1End && otherEnd > scheduledArrival) {
            return 'red';
        }
        
        // Check if overlap is in orange zone
        if (otherStart < zone2End && otherEnd > zone1End) {
            return 'orange';
        }
        
        // Check if overlap is in yellow zone
        if (otherStart < zone3End && otherEnd > zone2End) {
            return 'yellow';
        }
        
        return 'none';
    }
    
    /**
     * Detect conflicts for a delayed train against all other trains
     */
    detectConflicts(train, delayInfo, allTrains, settings = {}) {
        if (!train || !delayInfo) {
            return { hasConflict: false, conflictType: 'none', affectedTrains: [] };
        }
        
        const turnaroundTime = settings.turnaroundTime || 10;
        const tolerance = settings.conflictTolerance || 5;
        const showWarnings = settings.showWarnings !== false;
        
        // Calculate actual times for delayed train
        const delayedTimes = this.calculateActualTimes(train, delayInfo, turnaroundTime);
        if (!delayedTimes) {
            return { hasConflict: false, conflictType: 'none', affectedTrains: [] };
        }
        
        // Verbose logging disabled - summary is logged when conflicts are found
        
        const affectedTrains = [];
        let maxSeverity = 'none';
        
        // Check against all other trains on same track
        allTrains.forEach(otherTrain => {
            // Skip self
            if (otherTrain.id === train.id) return;
            
            // Skip if not on same track
            if (otherTrain.trackId !== train.trackId) return;
            
            // Get other train's times (without delay, as we're checking if delayed train affects it)
            const otherArrival = otherTrain.arrTime ? Math.floor(otherTrain.arrTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            const otherDeparture = otherTrain.depTime ? Math.floor(otherTrain.depTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            
            if (otherArrival === null && otherDeparture === null) return;
            
            // Use actual times if available, otherwise use scheduled
            const otherStart = otherArrival !== null ? otherArrival : otherDeparture;
            const otherEnd = otherDeparture !== null ? otherDeparture : otherArrival;
            
            // Check for overlap
            const delayedStart = delayedTimes.actualArrival || delayedTimes.actualDeparture;
            const delayedEnd = delayedTimes.actualDeparture || delayedTimes.actualArrival;
            
            const { overlaps, overlapMinutes } = this.checkOverlap(
                delayedStart,
                delayedEnd,
                otherStart,
                otherEnd
            );
            
            if (overlaps) {
                // Determine which zone the overlap occurs in
                const zone = this.determineOverlapZone(
                    otherStart,
                    otherEnd,
                    delayedTimes,
                    delayInfo.delayMinutes,
                    turnaroundTime,
                    tolerance
                );
                
                if (zone !== 'none') {
                    affectedTrains.push({
                        trainId: otherTrain.id,
                        trainNumber: otherTrain.arrivalTrainNumber || otherTrain.departureTrainNumber,
                        overlap: overlapMinutes,
                        zone: zone, // 'red', 'orange', or 'yellow'
                        scheduledArrival: otherTrain.arrTime,
                        scheduledDeparture: otherTrain.depTime
                    });
                    
                    // Update max severity (red > orange > yellow)
                    if (zone === 'red') {
                        maxSeverity = 'red';
                    } else if (zone === 'orange' && maxSeverity !== 'red') {
                        maxSeverity = 'orange';
                    } else if (zone === 'yellow' && maxSeverity === 'none') {
                        maxSeverity = 'yellow';
                    }
                }
            }
        });
        
        // Generate warning message
        let warning = null;
        if (affectedTrains.length > 0 && showWarnings) {
            const trainNumbers = affectedTrains.map(t => t.trainNumber).filter(Boolean).join(', ');
            if (maxSeverity === 'red') {
                warning = `Röd varning! Tåget påverkar: ${trainNumbers}`;
            } else if (maxSeverity === 'orange') {
                warning = `Orange varning! Möjlig påverkan på: ${trainNumbers}`;
            } else {
                warning = `Gul varning! Möjlig påverkan på: ${trainNumbers}`;
            }
        }
        
        const result = {
            hasConflict: affectedTrains.length > 0,
            conflictType: maxSeverity,
            affectedTrains,
            warning,
            delayedTimes
        };
        
        if (result.hasConflict) {
            logger.info('Conflict', `Train ${train.id} has ${affectedTrains.length} conflict(s)`, {
                type: maxSeverity,
                affected: affectedTrains.length
            });
        }
        
        return result;
    }
    
    /**
     * Detect if train is part of a coupled unit
     */
    detectCoupledTrains(train, allTrains) {
        const coupled = [];
        
        allTrains.forEach(otherTrain => {
            if (otherTrain.id === train.id) return;
            if (otherTrain.trackId !== train.trackId) return;
            
            // Check if times overlap significantly (within 5 minutes)
            const train1Arrival = train.arrTime ? Math.floor(train.arrTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            const train1Departure = train.depTime ? Math.floor(train.depTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            const train2Arrival = otherTrain.arrTime ? Math.floor(otherTrain.arrTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            const train2Departure = otherTrain.depTime ? Math.floor(otherTrain.depTime.getTime() / (1000 * 60)) % (24 * 60) : null;
            
            if (train1Arrival !== null && train2Arrival !== null) {
                if (Math.abs(train1Arrival - train2Arrival) <= 5) {
                    coupled.push(otherTrain);
                    logger.info('Conflict', `Detected coupled trains: ${train.id} and ${otherTrain.id}`);
                }
            }
        });
        
        return coupled;
    }
}

// Export for use in other modules
window.ConflictDetector = ConflictDetector;

