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
            // Gap-free lane packing (greedy interval colouring): a track needs as
            // many lanes as the most trains overlapping at any single instant —
            // NOT the highest physical sub-track index. Deriving the count from
            // the same packing used in calculateTrainPositions keeps the track
            // height tight and guarantees overlapping trains land on consecutive
            // lanes with no empty lane stranded between them.
            const laneCount = Math.max(1, this._packLanes(trackTrains).laneCount);
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
     * Gap-free lane assignment: overlapping trains are always packed onto a
     * CONTIGUOUS block of lanes, so an empty lane never appears *between* two
     * trains on the same track ("a train that isn't there" between them).
     *
     * Trains are placed in (start time, sub-track, id) order. Each one takes the
     * free lane block (width = vehicle span) CLOSEST to the lanes already held by
     * the trains it overlaps in time — lowest lane on a tie. With nothing else
     * active that lowest lane is 0, so a track normally compacts to the top; when
     * an earlier bar is "stuck" high (it shared a busy moment that has since
     * cleared) the newcomer still snaps adjacent to it rather than dropping to
     * lane 0 and stranding an empty lane in between. Physical delspår is only a
     * tie-breaker now — two trains on non-adjacent delspår are pulled together
     * (per the user's choice to never show a gap), and the exact delspår stays
     * available on the bar/tooltip.
     *
     * Returns { byTrain: Map<train, lane>, laneCount }.
     */
    _packLanes(trains) {
        const order = trains.slice().sort((a, b) => {
            const sa = this.getTimeRange(a).start;
            const sb = this.getTimeRange(b).start;
            const ta = sa ? sa.getTime() : Infinity;
            const tb = sb ? sb.getTime() : Infinity;
            if (ta !== tb) return ta - tb;
            const pa = this.getPreferredLane(a);
            const pb = this.getPreferredLane(b);
            if (pa !== pb) return pa - pb;
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });

        const placed = [];
        let laneCount = 1;
        for (const train of order) {
            const { start, end } = this.getTimeRange(train);
            const span = this.getVehicleSpan(train);
            const active = (start && end)
                ? placed.filter((p) => p.start && p.end && p.start < end && start < p.end)
                : [];
            const laneIsFree = (lane) =>
                !active.some((p) => lane < p.lane + p.span && p.lane < lane + span);

            // Lanes the active trains occupy, so we can measure how far a
            // candidate lane sits from that cluster (0 = flush against it).
            const occupied = [];
            for (const p of active) for (let l = p.lane; l < p.lane + p.span; l++) occupied.push(l);
            const distanceToCluster = (lane) => {
                if (!occupied.length) return 0;
                let best = Infinity;
                for (const o of occupied) {
                    const d = o < lane ? lane - o - 1 : o - (lane + span - 1) - 1;
                    best = Math.min(best, Math.max(0, d));
                }
                return best;
            };

            const ceiling = (occupied.length ? Math.max(...occupied) : 0) + span + 1;
            let lane = 0;
            let bestDist = Infinity;
            for (let cand = 0; cand <= ceiling; cand++) {
                if (!laneIsFree(cand)) continue;
                const d = distanceToCluster(cand);
                if (d < bestDist) { bestDist = d; lane = cand; }
                if (d === 0) break; // lowest lane flush with the cluster wins
            }

            placed.push({ train, start, end, lane, span });
            laneCount = Math.max(laneCount, lane + span);
        }
        return { byTrain: new Map(placed.map((p) => [p.train, p.lane])), laneCount };
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

        // One gap-free packing for the whole track. laneStart and the visual
        // lane are the SAME packed lane, so a train renders exactly where it was
        // packed — no second, divergent visual pass that could re-introduce a
        // gap. visualLaneCount is the track-wide packed count, so every bar
        // scales to the same lane height and consecutive lanes stay flush.
        const { byTrain, laneCount } = this._packLanes(trains);

        return trains.map((train) => {
            const laneStart = byTrain.get(train) ?? 0;
            const laneSpan = this.getVehicleSpan(train);
            const { start: trainStart, end: trainEnd } = this.getTimeRange(train);

            const overlapping = trains.filter((other) => {
                const { start: otherStart, end: otherEnd } = this.getTimeRange(other);
                return trainStart && trainEnd && otherStart && otherEnd &&
                    trainStart < otherEnd && trainEnd > otherStart;
            });
            const maxSimultaneous = this._calculateMaxDuringPeriod(overlapping, trainStart, trainEnd);

            return {
                train,
                position: laneStart,
                laneStart,
                laneSpan,
                visualLaneStart: laneStart,
                visualLaneSpan: laneSpan,
                visualLaneCount: laneCount,
                totalOverlapping: maxSimultaneous,
                totalLanes: laneCount,
            };
        });
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
