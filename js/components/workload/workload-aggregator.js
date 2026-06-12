/**
 * Workload aggregation: arrival/departure movements per 15-minute bucket
 * over the full timeline canvas, split by movement kind:
 *   tag      — the leg has an advertised train number (per-leg, not per-bar)
 *   vaxling  — the leg has no train number (shunting / operational move)
 * Synthetic stitch-edge times (arrSynthetic/depSynthetic) are canvas
 * artifacts, not real movements, and are never counted.
 * With useDelay, numbered legs shift to actual/estimated times and canceled
 * or replaced legs drop out; växlingar always keep their planned times.
 */
(function () {
    'use strict';

    const BUCKET_MINUTES = 15;

    function parseApiDate(str) {
        if (!str) return null;
        try {
            const cleaned = String(str).replace('+02:00', '').replace('+01:00', '');
            const d = new Date(cleaned);
            return Number.isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }

    /**
     * Delay-adjusted time for one leg given its delay context, or null when
     * the movement no longer happens (canceled/replaced).
     */
    function adjustedTime(ctx, scheduledTime) {
        if (ctx.delayInfo.isCanceled || ctx.delayInfo.isReplaced) return null;
        const best = parseApiDate(ctx.delayInfo.actualTime) || parseApiDate(ctx.delayInfo.estimatedTime);
        if (best) return best;
        if (Number.isFinite(ctx.delayInfo.delayMinutes)) {
            const adv = parseApiDate(ctx.delayInfo.advertisedTime) || scheduledTime;
            if (adv) return new Date(adv.getTime() + ctx.delayInfo.delayMinutes * 60000);
        }
        return scheduledTime;
    }

    /**
     * Compute bucketed movement counts for the current schedule.
     * Requires window.scheduleState (set after first render).
     * Returns null when the schedule has not rendered yet.
     */
    function compute(options) {
        const useDelay = !!(options && options.useDelay);
        const state = window.scheduleState;
        const trains = window.cachedTrains;
        if (!state || !state.timelineStart || !Array.isArray(trains)) return null;

        const totalHours = (window.TimeManager && window.TimeManager.timelineHours) || 30;
        const bucketCount = Math.ceil((totalHours * 60) / BUCKET_MINUTES);
        const startMs = state.timelineStart.getTime();
        const endMs = startMs + totalHours * 3600000;

        const buckets = new Array(bucketCount);
        for (let i = 0; i < bucketCount; i++) buckets[i] = { tag: 0, vaxling: 0 };

        const delayReady = useDelay && window.delayIntegration &&
            window.delayIntegration.isInitialized &&
            typeof window.delayIntegration.getDelayContextsForTrain === 'function';

        const addEvent = (time, kind) => {
            if (!time) return;
            const ms = time.getTime();
            if (ms < startMs || ms >= endMs) return;
            const idx = Math.floor((ms - startMs) / 60000 / BUCKET_MINUTES);
            if (idx >= 0 && idx < bucketCount) buckets[idx][kind] += 1;
        };

        for (const train of trains) {
            let contexts = null;
            if (delayReady && ((train.arrivalTrainNumber || '').trim() || (train.departureTrainNumber || '').trim())) {
                contexts = window.delayIntegration.getDelayContextsForTrain(train);
            }

            if (train.arrTime && !train.arrSynthetic) {
                const isTag = !!(train.arrivalTrainNumber || '').trim();
                let time = train.arrTime;
                if (isTag && contexts) {
                    const ctx = contexts.find((c) => c.leg === 'arrival');
                    if (ctx) time = adjustedTime(ctx, train.arrTime);
                }
                addEvent(time, isTag ? 'tag' : 'vaxling');
            }

            if (train.depTime && !train.depSynthetic) {
                const isTag = !!(train.departureTrainNumber || '').trim();
                let time = train.depTime;
                if (isTag && contexts) {
                    const ctx = contexts.find((c) => c.leg === 'departure');
                    if (ctx) time = adjustedTime(ctx, train.depTime);
                }
                addEvent(time, isTag ? 'tag' : 'vaxling');
            }
        }

        let maxTag = 0, maxVaxling = 0, maxAll = 0;
        let totalTag = 0, totalVaxling = 0;
        let peakAllIndex = -1, peakTagIndex = -1, peakVaxlingIndex = -1;
        for (let i = 0; i < bucketCount; i++) {
            const b = buckets[i];
            totalTag += b.tag;
            totalVaxling += b.vaxling;
            if (b.tag > maxTag) { maxTag = b.tag; peakTagIndex = i; }
            if (b.vaxling > maxVaxling) { maxVaxling = b.vaxling; peakVaxlingIndex = i; }
            const all = b.tag + b.vaxling;
            if (all > maxAll) { maxAll = all; peakAllIndex = i; }
        }

        return {
            buckets,
            bucketMinutes: BUCKET_MINUTES,
            bucketCount,
            totalHours,
            timelineStart: state.timelineStart,
            useDelay: delayReady,
            maxTag, maxVaxling, maxAll,
            totalTag, totalVaxling,
            peakAllIndex, peakTagIndex, peakVaxlingIndex
        };
    }

    /** "HH:MM–HH:MM" label for bucket i (wraps past 24:00 to next-day clock). */
    function bucketLabel(result, i) {
        const startMin = i * result.bucketMinutes;
        const fmt = (min) => {
            const h = Math.floor(min / 60) % 24;
            const m = min % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
        return `${fmt(startMin)}–${fmt(startMin + result.bucketMinutes)}`;
    }

    window.WorkloadAggregator = { compute, bucketLabel, BUCKET_MINUTES };
})();
