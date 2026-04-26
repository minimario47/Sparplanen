/**
 * Picks the Spårplan week/day bundle for "now" in Europe/Stockholm
 * and exposes anchor dates for timeline alignment.
 * Depends on: window.SPARPLANEN_WEEKS, SPARPLANEN_CLOSURES_WEEKS, SPARPLANEN_ANCHORS (from emit_week_bundle)
 */
(function () {
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
        const p = wk.split('-W', 1);
        if (p.length !== 2) return { y: 0, w: 0 };
        return { y: parseInt(p[0], 10) || 0, w: parseInt(p[1], 10) || 0 };
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
            const days = Object.keys(wmap);
            for (const dk of ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag']) {
                if (wmap[dk] && wmap[dk].length) {
                    const anc = (anchors && anchors[wk] && anchors[wk][dk]) || null;
                    return { week: wk, day: dk, anchor: anc };
                }
            }
        }
        return { week: null, day: null, anchor: null };
    }

    window.SparplanenResolve = {
        formatStockholmYMD: formatStockholmYMD,
        getStockholmSwedishDayKey: getStockholmSwedishDayKey,
        pickWeekAndDay: pickWeekAndDay,
        parseScheduleNow: function () {
            const weeks = typeof window !== 'undefined' ? window.SPARPLANEN_WEEKS : null;
            const anchors = typeof window !== 'undefined' ? window.SPARPLANEN_ANCHORS : null;
            if (!weeks) {
                return { usedBundle: false, week: null, day: null, services: null, anchorStr: null, anchor: null };
            }
            const p = pickWeekAndDay(weeks, anchors);
            if (!p.week || !p.day) {
                return { usedBundle: true, week: null, day: null, services: null, anchorStr: null, anchor: null };
            }
            const arr = weeks[p.week] && weeks[p.week][p.day];
            const a = p.anchor
                ? new Date(p.anchor + 'T12:00:00')
                : null;
            return {
                usedBundle: true,
                week: p.week,
                day: p.day,
                weekKey: p.week,
                dayKey: p.day,
                services: arr || [],
                anchorStr: p.anchor,
                anchor: a,
            };
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
