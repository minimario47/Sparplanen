/**
 * Train Positioning Engine - Overlap and layout calculations
 */

window.TrainPositioning = {
    laneMinHeight: 16,
    trackMinHeight: 48,

    getVehicleSpan(train) {
        const count = parseInt(train?.vehicleCount ?? train?.trainSet?.count, 10);
        return Math.max(1, Math.min(6, Number.isFinite(count) ? count : 1));
    },

    getPreferredLane(train) {
        const lane = parseInt(train?.subTrackIndex, 10);
        return Math.max(0, Number.isFinite(lane) ? lane : 0);
    },

    getTimeRange(train) {
        const start = train?.arrTime || train?.depTime || null;
        const end = train?.depTime || train?.arrTime || null;
        return { start, end };
    },
    
    /**
     * Pre-calculates vertical layout for each track based on occupied vehicle lanes.
     */
    calculateTrackLayouts(tracks, trains) {
        const layouts = [];
        let currentTop = 0;

        const trainsByTrack = trains.reduce((acc, train) => {
            acc[train.trackId] = acc[train.trackId] || [];
            acc[train.trackId].push(train);
            return acc;
        }, {});
        
        tracks.forEach(track => {
            const trackTrains = trainsByTrack[track.id] || [];
            const maxPreferredLane = trackTrains.reduce((max, train) => {
                const laneEnd = this.getPreferredLane(train) + this.getVehicleSpan(train);
                return Math.max(max, laneEnd);
            }, 1);
            const maxSimultaneousVehicles = this.calculateMaxSimultaneousTrains(trackTrains);
            const laneCount = Math.max(1, maxPreferredLane, maxSimultaneousVehicles);
            const height = Math.max(this.trackMinHeight, laneCount * this.laneMinHeight);
            const laneHeight = height / laneCount;
            const subTracks = Array.from({ length: laneCount }, (_, index) => ({
                index,
                top: currentTop + index * laneHeight,
                height: laneHeight
            }));
            
            layouts.push({
                id: track.id,
                top: currentTop,
                height,
                laneCount,
                laneHeight,
                subTracks
            });
            
            currentTop += height;
        });
        
        return layouts;
    },

    /**
     * Calculates maximum vehicle lanes occupied at any moment
     */
    calculateMaxSimultaneousTrains(trains) {
        if (trains.length === 0) return 0;
        
        const events = [];
        trains.forEach(train => {
            const { start, end } = this.getTimeRange(train);
            if (!start || !end) return;
            const weight = this.getVehicleSpan(train);
            events.push({ time: start, delta: weight, type: 'arrive' });
            events.push({ time: end, delta: -weight, type: 'depart' });
        });
        
        events.sort((a, b) => {
            if (a.time.getTime() !== b.time.getTime()) return a.time - b.time;
            return a.delta - b.delta;
        });
        
        let current = 0;
        let maximum = 0;
        
        events.forEach(event => {
            current += event.delta;
            maximum = Math.max(maximum, current);
        });
        
        return Math.max(1, maximum);
    },

    /**
     * Calculate physical lane placement for each train.
     */
    calculateTrainPositions(trains) {
        if (trains.length === 0) return [];
        
        const sorted = trains.slice().sort((a, b) => {
            const aStart = this.getTimeRange(a).start;
            const bStart = this.getTimeRange(b).start;
            const timeDiff = aStart - bStart;
            if (timeDiff !== 0) return timeDiff;
            const subDiff = this.getPreferredLane(a) - this.getPreferredLane(b);
            return subDiff !== 0 ? subDiff : String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });
        
        const result = [];
        
        sorted.forEach(train => {
            const { start: trainStart, end: trainEnd } = this.getTimeRange(train);
            const laneSpan = this.getVehicleSpan(train);
            
            const overlapping = sorted.filter(other => {
                const { start: otherStart, end: otherEnd } = this.getTimeRange(other);
                return trainStart < otherEnd && trainEnd > otherStart;
            });
            
            const maxSimultaneous = this._calculateMaxDuringPeriod(
                overlapping, 
                trainStart, 
                trainEnd
            );
            
            const active = result.filter(r => {
                const { start: rStart, end: rEnd } = this.getTimeRange(r.train);
                return rStart < trainEnd && rEnd > trainStart;
            });

            const laneIsFree = (startLane) => {
                for (const r of active) {
                    const a0 = r.laneStart;
                    const a1 = r.laneStart + r.laneSpan;
                    const b0 = startLane;
                    const b1 = startLane + laneSpan;
                    if (b0 < a1 && a0 < b1) return false;
                }
                return true;
            };

            let laneStart = this.getPreferredLane(train);
            if (!laneIsFree(laneStart)) {
                laneStart = 0;
                while (!laneIsFree(laneStart)) laneStart++;
            }
            
            result.push({
                train,
                position: laneStart,
                laneStart,
                laneSpan,
                totalOverlapping: maxSimultaneous,
                totalLanes: Math.max(maxSimultaneous, laneStart + laneSpan)
            });
        });
        
        return result;
    },

    /**
     * Internal: max trains during a specific period
     */
    _calculateMaxDuringPeriod(trains, periodStart, periodEnd) {
        if (trains.length === 0) return 0;
        
        const events = [];
        
        trains.forEach(train => {
            const { start: trainStart, end: trainEnd } = this.getTimeRange(train);
            
            if (trainStart < periodEnd && trainEnd > periodStart) {
                const effectiveStart = trainStart > periodStart ? trainStart : periodStart;
                const effectiveEnd = trainEnd < periodEnd ? trainEnd : periodEnd;
                const weight = this.getVehicleSpan(train);

                events.push({ time: effectiveStart, delta: weight });
                events.push({ time: effectiveEnd, delta: -weight });
            }
        });
        
        events.sort((a, b) => {
            if (a.time.getTime() !== b.time.getTime()) {
                return a.time - b.time;
            }
            return a.delta - b.delta;
        });
        
        let current = 0;
        let maximum = 0;
        
        events.forEach(event => {
            current += event.delta;
            maximum = Math.max(maximum, current);
        });
        
        return Math.max(1, maximum);
    }
};
