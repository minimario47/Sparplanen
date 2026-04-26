/**
 * Picks the Spårplan week/day bundle for "now" in Europe/Stockholm
 * and exposes anchor dates for timeline alignment.
 * Depends on: window.SPARPLANEN_WEEKS, SPARPLANEN_CLOSURES_WEEKS, SPARPLANEN_ANCHORS (from emit_week_bundle)
 */
(function () {
    const DAY_ORDER = ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag'];
    const SWE_DAY_TO_KEY = {
        'måndag': 'mandag',
        'mandag': 'mandag',
        'tisdag': 'tisdag',
        'onsdag': 'onsdag',
        'torsdag': 'torsdag',
        'fredag': 'fredag',
        'lördag': 'lordag',
        'lö': 'lordag', // not used
        'söndag': 'sondag',
    };

    function formatStockholmYMD() {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Stockholm',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
    }

    function getStockholmSwedishDayKey() {
        const w = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Stockholm',
            weekday: 'long',
        }).format(new Date());
        const k = w.toLowerCase().trim();
        return SWE_DAY_TO_KEY[k] || 'mandag';
    }

    function parseWeekKey(wk) {
        const m = /^(\d{4})-W(\d{1,2})$/i.exec(String(wk || ''));
        if (!m) return { y: 0, w: 0 };
        return { y: parseInt(m[1], 10) || 0, w: parseInt(m[2], 10) || 0 };
    }

    function compareWeekKeysDesc(a, b) {
        const A = parseWeekKey(a);
        const B = parseWeekKey(b);
        if (A.y !== B.y) return B.y - A.y;
        return B.w - A.w;
    }

    function pickWeekAndDay(weeks, anchors) {
        if (!weeks || typeof weeks !== 'object') return { week: null, day: null, anchor: null };
        const ymd = formatStockholmYMD();
        const dayKey = getStockholmSwedishDayKey();
        const list = Object.keys(weeks).sort(compareWeekKeysDesc);
        for (const wk of list) {
            if (anchors && anchors[wk] && anchors[wk][dayKey] === ymd) {
                return { week: wk, day: dayKey, anchor: anchors[wk][dayKey] };
            }
        }
        for (const wk of list) {
            const t = weeks[wk] && weeks[wk][dayKey];
            if (t && t.length) {
                const anc = (anchors && anchors[wk] && anchors[wk][dayKey]) || null;
                return { week: wk, day: dayKey, anchor: anc };
            }
        }
        for (const wk of list) {
            const wmap = weeks[wk];
            if (!wmap) continue;
            for (const dk of DAY_ORDER) {
                if (wmap[dk] && wmap[dk].length) {
                    const anc = (anchors && anchors[wk] && anchors[wk][dk]) || null;
                    return { week: wk, day: dk, anchor: anc };
                }
            }
        }
        return { week: null, day: null, anchor: null };
    }

    function getAdjacentDayRef(weeks, anchors, weekKey, dayKey, direction) {
        if (!weekKey || !dayKey || !weeks) return null;
        const idx = DAY_ORDER.indexOf(dayKey);
        if (idx < 0) return null;
        const weekList = Object.keys(weeks).sort(compareWeekKeysDesc).reverse();
        const wIdx = weekList.indexOf(weekKey);
        if (wIdx < 0) return null;

        let targetWeek = weekKey;
        let targetDayIndex = idx + (direction > 0 ? 1 : -1);
        let targetWeekIndex = wIdx;
        if (targetDayIndex < 0) {
            targetWeekIndex -= 1;
            targetDayIndex = DAY_ORDER.length - 1;
        } else if (targetDayIndex >= DAY_ORDER.length) {
            targetWeekIndex += 1;
            targetDayIndex = 0;
        }
        if (targetWeekIndex < 0 || targetWeekIndex >= weekList.length) return null;
        targetWeek = weekList[targetWeekIndex];
        const targetDay = DAY_ORDER[targetDayIndex];
        return {
            weekKey: targetWeek,
            dayKey: targetDay,
            anchorStr: (anchors && anchors[targetWeek] && anchors[targetWeek][targetDay]) || null,
            services: (weeks[targetWeek] && weeks[targetWeek][targetDay]) || []
        };
    }

    function parseScheduleContext() {
        const weeks = typeof window !== 'undefined' ? window.SPARPLANEN_WEEKS : null;
        const anchors = typeof window !== 'undefined' ? window.SPARPLANEN_ANCHORS : null;
        const closureWeeks = typeof window !== 'undefined' ? window.SPARPLANEN_CLOSURES_WEEKS : null;
        if (!weeks) {
            return { usedBundle: false, week: null, day: null, services: null, anchorStr: null, anchor: null };
        }
        const p = pickWeekAndDay(weeks, anchors);
        if (!p.week || !p.day) {
            return { usedBundle: true, week: null, day: null, services: null, anchorStr: null, anchor: null };
        }
        const currentDay = {
            weekKey: p.week,
            dayKey: p.day,
            anchorStr: p.anchor || null,
            services: (weeks[p.week] && weeks[p.week][p.day]) || []
        };
        const prevDay = getAdjacentDayRef(weeks, anchors, p.week, p.day, -1);
        const nextDay = getAdjacentDayRef(weeks, anchors, p.week, p.day, 1);
        const withClosures = (dayRef) => {
            if (!dayRef) return null;
            return {
                ...dayRef,
                closures: (closureWeeks && closureWeeks[dayRef.weekKey] && closureWeeks[dayRef.weekKey][dayRef.dayKey]) || []
            };
        };
        return {
            usedBundle: true,
            week: p.week,
            day: p.day,
            weekKey: p.week,
            dayKey: p.day,
            services: currentDay.services,
            anchorStr: p.anchor,
            anchor: p.anchor ? new Date(p.anchor + 'T12:00:00') : null,
            currentDay: withClosures(currentDay),
            prevDay: withClosures(prevDay),
            nextDay: withClosures(nextDay)
        };
    }

    window.SparplanenResolve = {
        formatStockholmYMD: formatStockholmYMD,
        getStockholmSwedishDayKey: getStockholmSwedishDayKey,
        pickWeekAndDay: pickWeekAndDay,
        parseScheduleContext: parseScheduleContext,
        parseScheduleNow: function () {
            return parseScheduleContext();
        },
        parseClosuresNow: function (week, day) {
            const cws = typeof window !== 'undefined' ? window.SPARPLANEN_CLOSURES_WEEKS : null;
            if (!cws || !week || !day) {
                return [];
            }
            return (cws[week] && cws[week][day]) ? cws[week][day] : [];
        },
    };
})();
