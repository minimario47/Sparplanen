/**
 * Train Positioning Engine - Overlap and layout calculations
 */

window.TrainPositioning = {
    
    /**
     * Pre-calculates vertical layout for each track based on max simultaneous trains
     */
    calculateTrackLayouts(tracks, trains) {
        const layouts = [];
        let currentTop = 0;

        const getTrackHeight = (maxSimultaneous) => {
            if (maxSimultaneous === 1) return 48;
            if (maxSimultaneous === 2) return 48;
            if (maxSimultaneous === 3) return 52;
            if (maxSimultaneous === 4) return 56;
            return 60;
        };

        const trainsByTrack = trains.reduce((acc, train) => {
            acc[train.trackId] = acc[train.trackId] || [];
            acc[train.trackId].push(train);
            return acc;
        }, {});
        
        tracks.forEach(track => {
            const trackTrains = trainsByTrack[track.id] || [];
            const maxOverlapping = this.calculateMaxSimultaneousTrains(trackTrains);
            const height = getTrackHeight(maxOverlapping);
            
            layouts.push({
                id: track.id,
                top: currentTop,
                height: height
            });
            
            currentTop += height;
        });
        
        return layouts;
    },

    /**
     * Calculates maximum trains overlapping at any moment
     */
    calculateMaxSimultaneousTrains(trains) {
        if (trains.length === 0) return 0;
        if (trains.length === 1) return 1;
        
        const events = [];
        trains.forEach(train => {
            if (train.arrTime) events.push({ time: train.arrTime, type: 'arrive' });
            if (train.depTime) events.push({ time: train.depTime, type: 'depart' });
        });
        
        events.sort((a, b) => a.time - b.time);
        
        let current = 0;
        let maximum = 0;
        
        events.forEach(event => {
            if (event.type === 'arrive') {
                current++;
                maximum = Math.max(maximum, current);
            } else {
                current--;
            }
        });
        
        return maximum;
    },

    /**
     * Calculate position for each train using gravity-based slot assignment
     */
    calculateTrainPositions(trains) {
        if (trains.length === 0) return [];
        
        const sorted = trains.slice().sort((a, b) => {
            const aStart = a.arrTime || a.depTime;
            const bStart = b.arrTime || b.depTime;
            const timeDiff = aStart - bStart;
            return timeDiff !== 0 ? timeDiff : a.id - b.id;
        });
        
        const result = [];
        
        sorted.forEach(train => {
            const trainStart = train.arrTime || train.depTime;
            const trainEnd = train.depTime || train.arrTime;
            
            const overlapping = sorted.filter(other => {
                const otherStart = other.arrTime || other.depTime;
                const otherEnd = other.depTime || other.arrTime;
                return trainStart < otherEnd && trainEnd > otherStart;
            });
            
            const maxSimultaneous = this._calculateMaxDuringPeriod(
                overlapping, 
                trainStart, 
                trainEnd
            );
            
            let position = 0;
            const trainsAtArrival = result.filter(r => {
                const rStart = r.train.arrTime || r.train.depTime;
                const rEnd = r.train.depTime || r.train.arrTime;
                return rStart < trainStart && rEnd > trainStart;
            });
            
            const usedPositions = trainsAtArrival.map(r => r.position);
            for (let i = 0; i < maxSimultaneous; i++) {
                if (!usedPositions.includes(i)) {
                    position = i;
                    break;
                }
            }
            
            result.push({
                train: train,
                position: position,
                totalOverlapping: maxSimultaneous
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
            const trainStart = train.arrTime || train.depTime;
            const trainEnd = train.depTime || train.arrTime;
            
            if (trainStart < periodEnd && trainEnd > periodStart) {
                const effectiveStart = trainStart > periodStart ? trainStart : periodStart;
                const effectiveEnd = trainEnd < periodEnd ? trainEnd : periodEnd;
                
                events.push({ time: effectiveStart, type: 'arrive' });
                events.push({ time: effectiveEnd, type: 'depart' });
            }
        });
        
        events.sort((a, b) => {
            if (a.time.getTime() !== b.time.getTime()) {
                return a.time - b.time;
            }
            return a.type === 'depart' ? -1 : 1;
        });
        
        let current = 0;
        let maximum = 0;
        
        events.forEach(event => {
            if (event.type === 'arrive') {
                current++;
                maximum = Math.max(maximum, current);
            } else {
                current--;
            }
        });
        
        return maximum;
    }
};
