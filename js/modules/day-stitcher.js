/**
 * Day Stitcher - joins today's schedule with tomorrow morning's so trains
 * that cross midnight render as one continuous bar instead of being cut at
 * 24:00 "like a PDF page break".
 *
 * CRITICAL FLAG SEMANTICS (verified against extract_monday.py + the PDFs):
 * `continuesFromPrevPage`/`continuesToNextPage` are set purely by pixel
 * geometry — a bar's left/right edge touches the LEFT/RIGHT edge of a 3-hour
 * PDF *page* (each day file is 8 pages × 3h). They mean "bar touched a 3h page
 * boundary", NOT "train continues to another DAY". So a normal evening train
 * arriving 18:00 (a page-left edge) gets continuesFromPrevPage; a mid-day bar
 * crossing the 15:00 gridline gets continuesToNextPage. Only a bar on the LAST
 * page (21–24) reaching the right edge genuinely crosses midnight, and only a
 * bar on the FIRST page (00–03) at the left edge is genuinely parked-from-
 * yesterday. Consequences for this module:
 *  - Page-edge fragments must NOT be drawn to 24:00/00:00. Edge synthesis is
 *    gated to genuine day-boundary hours (dep<06 for the morning side, arr>=21
 *    for the evening side); everything else falls back to the renderer's
 *    normal (pre-stitch) handling.
 *  - Phantom duplicates (a continuesToNextPage+no-dep slot shadowing a real
 *    short bar for the same train/track) are dropped outright.
 *  - Morning inclusion is by number-pairing with a today tail OR a real
 *    sub-06:30 start — never by the flag alone (Rule D).
 *
 * "Tomorrow" is resolved via SPARPLANEN_ANCHORS by calendar date — not week
 * arithmetic — so Sunday→Monday across an ISO-week (or year) boundary works,
 * and a stale bundle stitches to the next day WITHIN that bundle.
 */
(function () {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // Tomorrow inclusion cutoff (Rule D time-branch). 06:30 keeps the genuine
    // 06:00–06:29 tails the 30h timeline can still show; the 30h canvas itself
    // ends at 06:00 (the grace tail past 06:00 is only for already-merged bars).
    const STITCH_CUTOFF = '06:30';
    // Edge-synthesis gates (page-relative flag semantics, see header):
    const DEP_EDGE_MIN_ARR_HOUR = 21; // continuesToNextPage tail only reaches 24:00 on the last page
    const ARR_EDGE_MAX_DEP_HOUR = 6;  // continuesFromPrevPage only means "from 00:00" in the deep-night pages

    function pad2(n) { return String(n).padStart(2, '0'); }

    function ymdAddDays(ymd, days) {
        const p = String(ymd).split('-').map(Number);
        if (p.length !== 3 || p.some((x) => !Number.isFinite(x))) return null;
        const d = new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    // ISO-8601 week key for a YYYY-MM-DD (same algorithm as
    // schedule-timezone-helpers, but for an arbitrary date).
    function isoWeekKeyOf(ymd) {
        const p = String(ymd).split('-').map(Number);
        if (p.length !== 3) return null;
        const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
    }

    /**
     * Find the bundle day whose anchor date is the calendar day after the
     * given week/day. Returns { found, week, day, services, anchorYmd } or
     * { found: false, tomorrowYmd, missingWeekKey, missingWeekNumber }.
     */
    function resolveTomorrow(weekKey, dayKey) {
        const weeks = window.SPARPLANEN_WEEKS || {};
        const anchors = window.SPARPLANEN_ANCHORS || {};
        const anchorStr = anchors[weekKey] && anchors[weekKey][dayKey];
        if (!anchorStr) return { found: false, tomorrowYmd: null, missingWeekKey: null, missingWeekNumber: null };

        const tomorrowYmd = ymdAddDays(anchorStr, 1);
        if (!tomorrowYmd) return { found: false, tomorrowYmd: null, missingWeekKey: null, missingWeekNumber: null };

        for (const wk of Object.keys(anchors)) {
            const dayMap = anchors[wk];
            if (!dayMap) continue;
            for (const dk of Object.keys(dayMap)) {
                if (dayMap[dk] !== tomorrowYmd) continue;
                const services = weeks[wk] && weeks[wk][dk];
                if (Array.isArray(services) && services.length) {
                    return { found: true, week: wk, day: dk, services, anchorYmd: tomorrowYmd };
                }
            }
        }

        const missingWeekKey = isoWeekKeyOf(tomorrowYmd);
        const missingWeekNumber = missingWeekKey ? parseInt(missingWeekKey.split('-W')[1], 10) : null;
        return { found: false, tomorrowYmd, missingWeekKey, missingWeekNumber };
    }

    function numbersOf(service) {
        return [service.arrivalTrainNumber, service.departureTrainNumber]
            .map((n) => String(n || '').trim())
            .filter(Boolean);
    }

    function numbersOverlap(a, b) {
        const an = numbersOf(a);
        const bn = numbersOf(b);
        return an.some((n) => bn.includes(n));
    }

    function toMinutes(t) {
        const s = (t || '').trim();
        if (!s) return null;
        const [h, m] = s.split(':').map(Number);
        return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    }
    function hourOf(t) {
        const min = toMinutes(t);
        return min == null ? null : Math.floor(min / 60);
    }
    const sameTrack = (a, b) => parseInt(a.trackId, 10) === parseInt(b.trackId, 10);

    /**
     * Phantom page-edge duplicate: a continuesToNextPage slot with no
     * departure time that merely shadows a real short bar for the same train
     * on the same track (the parser emitted both a full-page artifact rect and
     * the real bar). The sibling IS the train; drop the phantom so it is never
     * drawn (this is the track-16 "3025 stays all day" artifact). Verified
     * SAFE-DROP predicate: 0 unique trains lost across all bundles.
     */
    function isPhantomDuplicate(s, today) {
        if (!(s.continuesToNextPage && !(s.scheduledDepartureTime || '').trim())) return false;
        const dn = String(s.departureTrainNumber || '').trim();
        if (!dn) return false;
        const an = String(s.arrivalTrainNumber || '').trim();
        const at = toMinutes(s.scheduledArrivalTime);
        return today.some((o) => {
            if (o === s || !sameTrack(o, s)) return false;
            if (String(o.departureTrainNumber || '').trim() !== dn) return false;
            if (o.continuesFromPrevPage) return false;
            if (!(o.scheduledArrivalTime || '').trim() || !(o.scheduledDepartureTime || '').trim()) return false;
            const oat = toMinutes(o.scheduledArrivalTime);
            if (at != null && oat != null && Math.abs(oat - at) > 20) return false;
            if (an !== '' && String(o.arrivalTrainNumber || '').trim() !== an) return false;
            return true;
        });
    }

    /**
     * Match one open-ended tail (continuesToNextPage) with tomorrow's
     * continuation bars on the same track. Deterministic: prefer a candidate
     * carrying a real (early) departure over a parked/late one, then earliest
     * departure, then id — so a tail never latches onto a parked-again record
     * when a real morning departure exists.
     */
    function findPartner(tail, morning, consumed) {
        const candidates = morning.filter((m) =>
            m.continuesFromPrevPage &&
            !consumed.has(m.id) &&
            sameTrack(m, tail)
        );
        if (!candidates.length) return null;

        const byNumber = candidates.filter((m) => numbersOverlap(tail, m));
        if (byNumber.length) {
            byNumber.sort((a, b) => {
                const ad = (a.scheduledDepartureTime || '').trim() ? 0 : 1;
                const bd = (b.scheduledDepartureTime || '').trim() ? 0 : 1;
                if (ad !== bd) return ad - bd;
                const at = toMinutes(a.scheduledDepartureTime) ?? Infinity;
                const bt = toMinutes(b.scheduledDepartureTime) ?? Infinity;
                if (at !== bt) return at - bt;
                return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
            });
            return byNumber[0];
        }

        // Numberless fallback: a parked tail is very commonly continued by a
        // numberless morning "D" depot move (the unit leaves the platform under
        // a depot label, not a service number) — e.g. 496 arr 23:50 parked,
        // continued by the numberless D/00:30 bar on the same track. Merge when
        // that numberless continuation is the SINGLE cfp candidate on the track,
        // so there is no ambiguity about which slot it continues. This covers a
        // numbered tail too (previously only numberless tails could merge, which
        // left 496-style overnight parks split into two bars at 24:00).
        const numberless = candidates.filter((m) => numbersOf(m).length === 0);
        if (numberless.length === 1 && candidates.length === 1) {
            return numberless[0];
        }
        return null;
    }

    function makeMerged(tail, partner) {
        const parkedAllDay = !(tail.scheduledArrivalTime || '').trim() &&
            !(partner.scheduledArrivalTime || '').trim() &&
            !(partner.scheduledDepartureTime || '').trim();
        return {
            ...tail,
            departureTrainNumber: tail.departureTrainNumber || partner.departureTrainNumber || '',
            departureLabel: tail.departureLabel || partner.departureLabel || '',
            scheduledDepartureTime: partner.scheduledDepartureTime || '',
            // Partner's clock time is on the NEXT calendar day.
            _depNextDay: !!(partner.scheduledDepartureTime || '').trim(),
            // Partner also runs off tomorrow's page (parked another day):
            // draw to the timeline's end.
            _syntheticDepFar: !(partner.scheduledDepartureTime || '').trim(),
            _syntheticArrEdge: !(tail.scheduledArrivalTime || '').trim(),
            _parkedAllDay: parkedAllDay,
            stitchedOvernight: true
        };
    }

    /**
     * Edge synthesis for GENUINE day-boundary page-edge bars only. Because the
     * flags are page-relative (see header), a continuesToNextPage bar only
     * reaches the real 24:00 line when it sits on the last page (arrival in the
     * 21:00+ band) or is fully parked (no arrival); a continuesFromPrevPage bar
     * only starts at 00:00 when it departs in the deep-night pages (<06:00) or
     * is fully parked. Mid-day fragments get NO synthetic edge and fall back to
     * the renderer's normal handling (i.e. rendered as a short single-ended bar
     * or skipped — exactly the pre-stitch behaviour).
     */
    function synthesizeEdges(service) {
        const arrEmpty = !(service.scheduledArrivalTime || '').trim();
        const depEmpty = !(service.scheduledDepartureTime || '').trim();
        const arrH = hourOf(service.scheduledArrivalTime);
        const depH = hourOf(service.scheduledDepartureTime);

        const needsDep = service.continuesToNextPage && depEmpty &&
            (arrEmpty || (arrH != null && arrH >= DEP_EDGE_MIN_ARR_HOUR));
        const needsArr = service.continuesFromPrevPage && arrEmpty &&
            (depEmpty || (depH != null && depH < ARR_EDGE_MAX_DEP_HOUR));
        if (!needsDep && !needsArr) return service;
        return {
            ...service,
            _syntheticDepEdge: needsDep, // depTime = 24:00 of its day
            _syntheticArrEdge: needsArr  // arrTime = 00:00 of its day
        };
    }

    /**
     * Build the stitched service list for a resolved schedule selection
     * ({ week, day, services }). Always safe to call: without tomorrow data
     * it only synthesizes page-edge spans for today.
     */
    function stitch(resolved) {
        const todayRaw = Array.isArray(resolved && resolved.services) ? resolved.services : [];
        // Drop phantom page-edge duplicates first so they are never merged,
        // pushed, or edge-synthesized.
        const today = todayRaw.filter((s) => !isPhantomDuplicate(s, todayRaw));
        const tomorrow = resolveTomorrow(resolved && resolved.week, resolved && resolved.day);

        if (!tomorrow.found) {
            return {
                services: today.map(synthesizeEdges),
                info: {
                    stitched: false,
                    tomorrowYmd: tomorrow.tomorrowYmd,
                    missingWeekKey: tomorrow.missingWeekKey,
                    missingWeekNumber: tomorrow.missingWeekNumber
                }
            };
        }

        // Today's open tails (continuesToNextPage with no departure) — used
        // both for the merge and to admit their tomorrow continuation into the
        // morning set regardless of how late that continuation departs.
        const tails = today.filter((s) =>
            s.continuesToNextPage && !(s.scheduledDepartureTime || '').trim());

        // Rule D inclusion (verified: 0 leaks, 0 missed genuine merges). A
        // tomorrow service joins the morning set iff it pairs by number with a
        // today tail on the same track, OR it has a real start before 06:30.
        // The flag alone is NOT sufficient (it just marks a 3h page edge).
        const morning = tomorrow.services.filter((m) => {
            // Drop tomorrow's phantom page-edge duplicates too (e.g. tomorrow's
            // own 3025 artifact) so they never reach the render list.
            if (isPhantomDuplicate(m, tomorrow.services)) return false;
            const start = m.scheduledArrivalTime || m.scheduledDepartureTime;
            if (start && start < STITCH_CUTOFF) return true;
            if (m.continuesFromPrevPage &&
                tails.some((t) => sameTrack(t, m) && numbersOverlap(t, m))) return true;
            return false;
        });

        const consumed = new Set();
        const mergedById = new Map();
        tails.forEach((s) => {
            const partner = findPartner(s, morning, consumed);
            if (!partner) return;
            mergedById.set(s.id, makeMerged(s, partner));
            // Always consume the chosen partner — it may be numberless (a "D"
            // depot continuation), which the same-number sweep below would miss,
            // leaving it to leak through as a phantom second morning bar.
            consumed.add(partner.id);
            // Consume EVERY same-number candidate on the track, not just the
            // chosen partner, so a duplicate tomorrow record (e.g. a second
            // 390 piece) cannot leak through the morning push below.
            morning.forEach((m) => {
                if (sameTrack(m, s) && numbersOverlap(s, m)) consumed.add(m.id);
            });
        });

        const services = today.map((s) => mergedById.get(s.id) || synthesizeEdges(s));

        morning.forEach((m) => {
            if (consumed.has(m.id)) return;
            // A continuation with no times at all can't be placed without its
            // (unmatched) predecessor — skip rather than invent a full bar.
            if (!(m.scheduledArrivalTime || '').trim() && !(m.scheduledDepartureTime || '').trim()) return;
            services.push({
                ...synthesizeEdges(m),
                id: `d1-${m.id}`, // avoid id collision with today's services
                _dayOffset: 1
            });
        });

        return {
            services,
            info: {
                stitched: true,
                week: tomorrow.week,
                day: tomorrow.day,
                tomorrowYmd: tomorrow.anchorYmd,
                mergedCount: mergedById.size
            }
        };
    }

    /**
     * One day in isolation, with NO cross-day merge: drop phantom page-edge
     * duplicates and synthesize the genuine 00:00 / 24:00 page-edge spans.
     * Archive mode uses this to lay every day of a week onto one continuous
     * canvas (each offset by its calendar day) — an overnight train then shows
     * as two bars that abut at midnight rather than a single merged bar, which
     * is the right trade for a browse-the-week view and needs no de-duplication
     * across days.
     */
    function prepareStandaloneDay(services) {
        const raw = Array.isArray(services) ? services : [];
        const cleaned = raw.filter((s) => !isPhantomDuplicate(s, raw));
        return cleaned.map(synthesizeEdges);
    }

    window.DayStitcher = { stitch, resolveTomorrow, isoWeekKeyOf, prepareStandaloneDay };
})();
