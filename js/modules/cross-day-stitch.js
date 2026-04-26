/**
 * Cross-day stitching helpers.
 * Mirrors page-stitch semantics across adjacent calendar days.
 */
(function () {
    function parseAnchorMidnight(anchorStr, fallbackDate) {
        if (anchorStr) {
            const p = String(anchorStr).split('-').map(Number);
            if (p.length === 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])) {
                return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
            }
        }
        const d = fallbackDate ? new Date(fallbackDate) : new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function parseHHMMToDate(timeStr, anchorMidnight) {
        if (!timeStr) return null;
        const [h, m] = String(timeStr).split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return new Date(anchorMidnight.getFullYear(), anchorMidnight.getMonth(), anchorMidnight.getDate(), h, m, 0, 0);
    }

    function parseTrainDates(service, anchorStr) {
        const base = parseAnchorMidnight(anchorStr, new Date());
        let arrDate = parseHHMMToDate(service.scheduledArrivalTime, base);
        let depDate = parseHHMMToDate(service.scheduledDepartureTime, base);
        if (arrDate && depDate && depDate < arrDate) {
            depDate = new Date(depDate.getTime() + 24 * 60 * 60 * 1000);
        } else if (!arrDate && depDate) {
            const depHour = parseInt(String(service.scheduledDepartureTime || '').split(':')[0], 10);
            if (Number.isFinite(depHour) && depHour >= 0 && depHour < 6) {
                depDate = new Date(depDate.getTime() + 24 * 60 * 60 * 1000);
            }
        }
        return { arrDate, depDate };
    }

    function parseClosureDates(closure, anchorStr) {
        const base = parseAnchorMidnight(anchorStr, new Date());
        const startDate = parseHHMMToDate(closure.startTime, base);
        let endDate = parseHHMMToDate(closure.endTime, base);
        if (startDate && endDate && endDate < startDate) {
            endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
        }
        return { startDate, endDate };
    }

    function normalizeTrainSegments(ctx) {
        const out = [];
        const buckets = [ctx.prevDay, ctx.currentDay, ctx.nextDay];
        buckets.forEach((bucket, idx) => {
            if (!bucket || !Array.isArray(bucket.services)) return;
            const dayIndex = idx - 1;
            bucket.services.forEach((service, i) => {
                const dates = parseTrainDates(service || {}, bucket.anchorStr);
                out.push({
                    dayIndex,
                    segKey: `${bucket.weekKey || 'wk'}:${bucket.dayKey || 'day'}:${service && service.id != null ? service.id : i}`,
                    service: service || {},
                    trackId: service ? service.trackId : null,
                    subTrackIndex: service && service.subTrackIndex != null ? service.subTrackIndex : 0,
                    arrivalTrainNumber: String((service && service.arrivalTrainNumber) || '').trim(),
                    departureTrainNumber: String((service && service.departureTrainNumber) || '').trim(),
                    continuesFromPrevPage: !!(service && service.continuesFromPrevPage),
                    continuesToNextPage: !!(service && service.continuesToNextPage),
                    arrDate: dates.arrDate,
                    depDate: dates.depDate
                });
            });
        });
        return out;
    }

    function normalizeClosureSegments(ctx) {
        const out = [];
        const buckets = [ctx.prevDay, ctx.currentDay, ctx.nextDay];
        buckets.forEach((bucket, idx) => {
            if (!bucket || !Array.isArray(bucket.closures)) return;
            const dayIndex = idx - 1;
            bucket.closures.forEach((closure, i) => {
                const dates = parseClosureDates(closure || {}, bucket.anchorStr);
                out.push({
                    dayIndex,
                    segKey: `clo:${bucket.weekKey || 'wk'}:${bucket.dayKey || 'day'}:${closure && closure.id != null ? closure.id : i}`,
                    closure: closure || {},
                    trackId: closure ? closure.trackId : null,
                    subTrackIndex: closure && closure.subTrackIndex != null ? closure.subTrackIndex : 0,
                    continuesFromPrevPage: !!(closure && closure.continuesFromPrevPage),
                    continuesToNextPage: !!(closure && closure.continuesToNextPage),
                    startDate: dates.startDate,
                    endDate: dates.endDate
                });
            });
        });
        return out;
    }

    function numbersIntersect(a, b) {
        const aa = [a.arrivalTrainNumber, a.departureTrainNumber].filter(Boolean);
        const bb = [b.arrivalTrainNumber, b.departureTrainNumber].filter(Boolean);
        return aa.some((x) => bb.includes(x));
    }

    function chooseBestTrainPartner(acc, candidates) {
        let best = null;
        let bestScore = -Infinity;
        candidates.forEach((c) => {
            let score = 0;
            if (numbersIntersect(acc, c)) score += 200;
            if (acc.departureTrainNumber && c.arrivalTrainNumber && acc.departureTrainNumber === c.arrivalTrainNumber) score += 120;
            if (!acc.departureTrainNumber || !c.arrivalTrainNumber) score += 25;
            const accEnd = acc.depDate ? acc.depDate.getTime() : (acc.arrDate ? acc.arrDate.getTime() : null);
            const cStart = c.arrDate ? c.arrDate.getTime() : (c.depDate ? c.depDate.getTime() : null);
            if (accEnd != null && cStart != null) {
                const gapMin = Math.abs(cStart - accEnd) / 60000;
                score += Math.max(0, 120 - gapMin);
            }
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        });
        return best;
    }

    function stitchTrainsAcrossDays(ctx) {
        const segments = normalizeTrainSegments(ctx);
        const removed = new Set();
        let merged = true;
        while (merged) {
            merged = false;
            for (const acc of segments) {
                if (removed.has(acc.segKey) || !acc.continuesToNextPage) continue;
                const candidates = segments.filter((c) =>
                    !removed.has(c.segKey) &&
                    c.dayIndex === acc.dayIndex + 1 &&
                    c.continuesFromPrevPage &&
                    c.trackId === acc.trackId &&
                    c.subTrackIndex === acc.subTrackIndex
                );
                if (!candidates.length) continue;
                const partner = chooseBestTrainPartner(acc, candidates);
                if (!partner) continue;

                if (!acc.arrDate) acc.arrDate = partner.arrDate;
                if (partner.depDate && (!acc.depDate || partner.depDate > acc.depDate)) acc.depDate = partner.depDate;
                if (!acc.arrivalTrainNumber && partner.arrivalTrainNumber) acc.arrivalTrainNumber = partner.arrivalTrainNumber;
                if (partner.departureTrainNumber) acc.departureTrainNumber = partner.departureTrainNumber;
                acc.continuesToNextPage = partner.continuesToNextPage;
                removed.add(partner.segKey);
                merged = true;
            }
        }

        return segments
            .filter((s) => !removed.has(s.segKey))
            .filter((s) => s.trackId >= 1 && s.trackId <= 16)
            .map((s, i) => ({
                ...(s.service || {}),
                id: `stitched-train-${i + 1}`,
                arrivalTrainNumber: s.arrivalTrainNumber || '',
                departureTrainNumber: s.departureTrainNumber || '',
                continuesFromPrevPage: s.continuesFromPrevPage,
                continuesToNextPage: s.continuesToNextPage,
                __arrDate: s.arrDate || null,
                __depDate: s.depDate || null
            }));
    }

    function chooseBestClosurePartner(acc, candidates) {
        let best = null;
        let bestGap = Number.POSITIVE_INFINITY;
        candidates.forEach((c) => {
            const accEnd = acc.endDate ? acc.endDate.getTime() : (acc.startDate ? acc.startDate.getTime() : null);
            const cStart = c.startDate ? c.startDate.getTime() : (c.endDate ? c.endDate.getTime() : null);
            if (accEnd == null || cStart == null) {
                if (!best) best = c;
                return;
            }
            const gap = Math.abs(cStart - accEnd);
            if (gap < bestGap) {
                bestGap = gap;
                best = c;
            }
        });
        return best;
    }

    function stitchClosuresAcrossDays(ctx) {
        const segments = normalizeClosureSegments(ctx);
        const removed = new Set();
        let merged = true;
        while (merged) {
            merged = false;
            for (const acc of segments) {
                if (removed.has(acc.segKey) || !acc.continuesToNextPage) continue;
                const candidates = segments.filter((c) =>
                    !removed.has(c.segKey) &&
                    c.dayIndex === acc.dayIndex + 1 &&
                    c.continuesFromPrevPage &&
                    c.trackId === acc.trackId &&
                    c.subTrackIndex === acc.subTrackIndex
                );
                if (!candidates.length) continue;
                const partner = chooseBestClosurePartner(acc, candidates);
                if (!partner) continue;

                if (!acc.startDate) acc.startDate = partner.startDate;
                if (partner.endDate && (!acc.endDate || partner.endDate > acc.endDate)) acc.endDate = partner.endDate;
                acc.continuesToNextPage = partner.continuesToNextPage;
                removed.add(partner.segKey);
                merged = true;
            }
        }

        return segments
            .filter((s) => !removed.has(s.segKey))
            .filter((s) => s.trackId >= 1 && s.trackId <= 16)
            .map((s, i) => ({
                ...(s.closure || {}),
                id: `stitched-closure-${i + 1}`,
                continuesFromPrevPage: s.continuesFromPrevPage,
                continuesToNextPage: s.continuesToNextPage,
                __startDate: s.startDate || null,
                __endDate: s.endDate || null
            }));
    }

    function computeTimelineRange(anchorStr, stitchedTrains, stitchedClosures) {
        const anchorMidnight = parseAnchorMidnight(anchorStr, new Date());
        const minCandidates = [];
        const maxCandidates = [];

        (stitchedTrains || []).forEach((t) => {
            if (t && t.__arrDate instanceof Date) minCandidates.push(t.__arrDate.getTime());
            if (t && t.__depDate instanceof Date) maxCandidates.push(t.__depDate.getTime());
            if (t && t.__arrDate instanceof Date) maxCandidates.push(t.__arrDate.getTime());
            if (t && t.__depDate instanceof Date) minCandidates.push(t.__depDate.getTime());
        });
        (stitchedClosures || []).forEach((c) => {
            if (c && c.__startDate instanceof Date) minCandidates.push(c.__startDate.getTime());
            if (c && c.__endDate instanceof Date) maxCandidates.push(c.__endDate.getTime());
            if (c && c.__startDate instanceof Date) maxCandidates.push(c.__startDate.getTime());
            if (c && c.__endDate instanceof Date) minCandidates.push(c.__endDate.getTime());
        });

        const defaultStart = anchorMidnight.getTime() - (6 * 60 * 60 * 1000);
        const defaultEnd = anchorMidnight.getTime() + (30 * 60 * 60 * 1000);
        const minTs = minCandidates.length ? Math.min(...minCandidates) : defaultStart;
        const maxTs = maxCandidates.length ? Math.max(...maxCandidates) : defaultEnd;

        const paddedStart = Math.min(defaultStart, minTs - (60 * 60 * 1000));
        const paddedEnd = Math.max(defaultEnd, maxTs + (3 * 60 * 60 * 1000));

        const start = new Date(paddedStart);
        start.setMinutes(0, 0, 0);
        const end = new Date(paddedEnd);
        const hoursRaw = Math.ceil((end.getTime() - start.getTime()) / (60 * 60 * 1000));
        const hours = Math.max(30, Math.min(54, hoursRaw));

        return { timelineStart: start, timelineHours: hours };
    }

    window.CrossDayStitch = {
        parseAnchorMidnight,
        stitchTrainsAcrossDays,
        stitchClosuresAcrossDays,
        computeTimelineRange
    };
})();
