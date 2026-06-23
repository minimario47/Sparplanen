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

    // The operational "service day" rolls over at 06:00, matching the 30-hour
    // render canvas (00:00 anchor → 06:00 the next morning). Between 00:00 and
    // 05:59 the trains physically at the platform — and the schedule context
    // around "now" — still belong to the PREVIOUS calendar day's bundle, whose
    // canvas extends through 06:00. Selecting the bundle (and judging staleness)
    // by this shifted instant keeps the overnight tail visible and navigable
    // instead of snapping to an empty new day the moment the clock passes 00:00.
    const SERVICE_DAY_ROLLOVER_HOUR = 6;
    function serviceNow() {
        return new Date(Date.now() - SERVICE_DAY_ROLLOVER_HOUR * 60 * 60 * 1000);
    }

    function formatStockholmYMD(date) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Stockholm',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date || new Date());
    }

    function getStockholmSwedishDayKey(date) {
        const w = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Stockholm',
            weekday: 'long',
        }).format(date || new Date());
        const k = w.toLowerCase().trim();
        return SWE_DAY_TO_KEY[k] || 'mandag';
    }

    // ISO-8601 week key (e.g. "2026-W23") for the given instant (default now)
    // in Europe/Stockholm.
    function getStockholmIsoWeekKey(date) {
        const ymd = formatStockholmYMD(date);
        const parts = ymd.split('-').map(Number);
        // Work in UTC so DST shifts can't move us across a day boundary.
        const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to the week's Thursday
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
    }

    function parseWeekKey(wk) {
        const p = String(wk).split('-W');
        if (p.length !== 2) return { y: 0, w: 0 };
        return { y: parseInt(p[0], 10) || 0, w: parseInt(p[1], 10) || 0 };
    }

    function compareWeekKeysDesc(a, b) {
        const A = parseWeekKey(a);
        const B = parseWeekKey(b);
        if (A.y !== B.y) return B.y - A.y;
        return B.w - A.w;
    }

    // ---- Archive mode ------------------------------------------------------
    // The user can pick any loaded week from the header week label. The choice
    // is stored in sessionStorage and, on the reload that follows, forces the
    // schedule to render that week instead of the live one. It rides on the
    // same `qaOverride` flag as the URL QA override, so following-mode,
    // jump-to-now and the staleness banner are all suppressed automatically.
    const ARCHIVE_KEY = 'sparplanen.archive';
    const DAY_ORDER = ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag'];

    function readArchiveRaw() {
        try {
            if (typeof sessionStorage === 'undefined') return null;
            const raw = sessionStorage.getItem(ARCHIVE_KEY);
            if (!raw) return null;
            const sel = JSON.parse(raw);
            return (sel && sel.week) ? sel : null;
        } catch (e) {
            return null;
        }
    }

    // First day of `week` that actually has services, preferring an explicitly
    // requested day, then Monday→Sunday order.
    function firstDayWithServices(weeks, week, preferDay) {
        const wmap = weeks && weeks[week];
        if (!wmap) return null;
        if (preferDay && Array.isArray(wmap[preferDay]) && wmap[preferDay].length) return preferDay;
        for (const dk of DAY_ORDER) {
            if (Array.isArray(wmap[dk]) && wmap[dk].length) return dk;
        }
        return null;
    }

    function getArchiveOverride(weeks, anchors) {
        const sel = readArchiveRaw();
        if (!sel || !weeks || !weeks[sel.week]) return null;
        const dayKey = firstDayWithServices(weeks, sel.week, sel.day);
        if (!dayKey) return null;
        const anchor = (anchors && anchors[sel.week] && anchors[sel.week][dayKey]) || null;
        return { week: sel.week, day: dayKey, anchor: anchor, qaOverride: true, archive: true };
    }

    // Validated { week, day, anchor } of the active archive selection, or null.
    // Exposed so the picker/banner UI and the live subsystems (delay API,
    // update checker) can gate themselves without re-reading sessionStorage.
    function getArchiveSelection() {
        const weeks = (typeof window !== 'undefined') ? window.SPARPLANEN_WEEKS : null;
        const anchors = (typeof window !== 'undefined') ? window.SPARPLANEN_ANCHORS : null;
        const o = getArchiveOverride(weeks, anchors);
        return o ? { week: o.week, day: o.day, anchor: o.anchor } : null;
    }

    function getQaOverride(weeks, anchors) {
        if (typeof window === 'undefined' || !window.location || !window.URLSearchParams) return null;
        const params = new URLSearchParams(window.location.search || '');
        const week = params.get('week');
        const day = params.get('day');
        if (!week || !day) return null;

        const dayKey = SWE_DAY_TO_KEY[String(day).toLowerCase().trim()] || String(day).toLowerCase().trim();
        const services = weeks && weeks[week] && weeks[week][dayKey];
        if (!Array.isArray(services) || services.length === 0) return null;
        const anchor = (anchors && anchors[week] && anchors[week][dayKey]) || null;
        return { week, day: dayKey, anchor, qaOverride: true, qaTime: params.get('time') || null };
    }

    // Natural (live) selection: the bundle for "now", ignoring archive/QA
    // overrides. Exposed so the week picker can mark which week is the live one.
    function pickNaturalWeekAndDay(weeks, anchors) {
        if (!weeks || typeof weeks !== 'object') return { week: null, day: null, anchor: null };

        const ref = serviceNow();
        const ymd = formatStockholmYMD(ref);
        const dayKey = getStockholmSwedishDayKey(ref);
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

    function pickWeekAndDay(weeks, anchors) {
        if (!weeks || typeof weeks !== 'object') return { week: null, day: null, anchor: null };
        const arch = getArchiveOverride(weeks, anchors);
        if (arch) return arch;
        const qa = getQaOverride(weeks, anchors);
        if (qa) return qa;
        return pickNaturalWeekAndDay(weeks, anchors);
    }

    window.SparplanenResolve = {
        formatStockholmYMD: formatStockholmYMD,
        getStockholmSwedishDayKey: getStockholmSwedishDayKey,
        getStockholmIsoWeekKey: getStockholmIsoWeekKey,
        pickWeekAndDay: pickWeekAndDay,
        pickNaturalWeekAndDay: pickNaturalWeekAndDay,
        getArchiveSelection: getArchiveSelection,
        isArchiveActive: function () { return !!getArchiveSelection(); },
        ARCHIVE_KEY: ARCHIVE_KEY,
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
            // Staleness: the bundle we picked is from a different ISO week than
            // the real current week (e.g. this week's PDF hasn't arrived yet).
            // Suppressed when a QA week/day override is active. Compared on the
            // service day (06:00 rollover) so an early-morning bundle that is
            // correctly "yesterday's" is not mis-flagged as a week behind.
            const currentWeek = getStockholmIsoWeekKey(serviceNow());
            const cur = parseWeekKey(currentWeek);
            const used = parseWeekKey(p.week);
            const isStale = !p.qaOverride && (used.y !== cur.y || used.w !== cur.w);
            return {
                usedBundle: true,
                week: p.week,
                day: p.day,
                weekKey: p.week,
                dayKey: p.day,
                weekNumber: used.w || null,
                currentWeek: currentWeek,
                isStale: isStale,
                services: arr || [],
                anchorStr: p.anchor,
                anchor: a,
                qaOverride: !!p.qaOverride,
                qaTime: p.qaTime || null,
                archive: !!p.archive,
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
