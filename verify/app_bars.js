'use strict';
/*
 * Headless "what the app shows".
 *
 * Runs the app's REAL DayStitcher.stitch() over the baked trains.js data for a
 * given week/day, then mirrors schedule-renderer.js prepareTrainData() exactly
 * (lines ~219-273) to compute each bar's effective arrival/departure minutes
 * (relative to the view day's 00:00; 1440 == 24:00, >1440 == next calendar day,
 * 1800 == 30h timeline end). This is the bar set the app draws, minus live-delay
 * track-change splits (out of scope: those depend on the Trafikverket API).
 *
 * Usage:
 *   node verify/app_bars.js <week> <day> [--num 496] [--track 11] [--around HH:MM] [--json]
 *   e.g. node verify/app_bars.js 2026-W24 torsdag --num 496
 */
const { loadApp } = require('./_load');

const TIMELINE_HOURS = 30; // TimeManager default; 30h canvas (00:00 .. 06:00 next day)

function parseMin(t) {
    const s = (t || '').trim();
    if (!s) return null;
    const [h, m] = s.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function lbl(min) {
    if (min == null) return '—';
    const d = Math.floor(min / 1440);
    const r = ((min % 1440) + 1440) % 1440;
    const base = `${pad2(Math.floor(r / 60))}:${pad2(r % 60)}`;
    if (min === 1440) return '24:00';
    return d > 0 ? `${base}+${d}` : base;
}

// Mirror of schedule-renderer.js prepareTrainData() time logic.
function effectiveTimes(service, stitched) {
    const dayOffset = service._dayOffset || 0;
    const base = dayOffset * 1440;
    let arr = parseMin(service.scheduledArrivalTime);
    let dep = parseMin(service.scheduledDepartureTime);
    if (arr != null) arr += base;
    if (dep != null) dep += base;

    if (service._syntheticArrEdge && arr == null) arr = base; // 00:00 of its day

    if (service._depNextDay && dep != null) {
        dep += 1440;
    } else if (service._syntheticDepFar) {
        dep = TIMELINE_HOURS * 60; // 1800
    } else if (service._syntheticDepEdge && dep == null) {
        dep = base + 1440; // 24:00 of its day
    }

    // Render clamp to the 30h canvas end.
    if (dep != null && (service._depNextDay || service._syntheticDepEdge || service._syntheticDepFar)) {
        const tlEnd = TIMELINE_HOURS * 60;
        if (dep > tlEnd) dep = tlEnd;
    }

    if (arr != null && dep != null && dep < arr) {
        dep += 1440;
    } else if (arr == null && dep != null && !dayOffset && !service._depNextDay && !stitched) {
        const depHour = Math.floor((dep % 1440) / 60);
        if (depHour >= 0 && depHour < 6) dep += 1440;
    }
    return { arr, dep };
}

function buildBars(week, day, app) {
    const { weeks, DayStitcher } = app || loadApp();
    const services = (weeks[week] && weeks[week][day]) || null;
    if (!services) {
        const avail = weeks[week] ? Object.keys(weeks[week]).join(', ') : '(week absent)';
        throw new Error(`No services for ${week} ${day}. Available days: ${avail}`);
    }
    const stitchedOut = DayStitcher.stitch({ week, day, services });
    const stitched = !!(stitchedOut.info && stitchedOut.info.stitched);

    const bars = stitchedOut.services
        .filter((s) => s.trackId >= 1 && s.trackId <= 16)
        .map((s) => {
            const { arr, dep } = effectiveTimes(s, stitched);
            return {
                id: s.id,
                trackId: parseInt(s.trackId, 10),
                subTrackIndex: Number.isFinite(parseInt(s.subTrackIndex, 10)) ? parseInt(s.subTrackIndex, 10) : 0,
                arrNum: String(s.arrivalTrainNumber || '').trim(),
                depNum: String(s.departureTrainNumber || '').trim(),
                arrLabel: s.arrivalLabel || '',
                depLabel: s.departureLabel || '',
                rawArr: s.scheduledArrivalTime || '',
                rawDep: s.scheduledDepartureTime || '',
                arrMin: arr,
                depMin: dep,
                arr: lbl(arr),
                dep: lbl(dep),
                dayOffset: s._dayOffset || 0,
                stitchedOvernight: !!s.stitchedOvernight,
                flags: [
                    s._syntheticArrEdge && 'synArr',
                    s._syntheticDepEdge && 'synDepEdge',
                    s._depNextDay && 'depNextDay',
                    s._syntheticDepFar && 'synDepFar',
                    s._parkedAllDay && 'parkedAllDay',
                    s.continuesFromPrevPage && 'cfp',
                    s.continuesToNextPage && 'ctn',
                ].filter(Boolean).join(','),
            };
        });
    return { bars, stitched, info: stitchedOut.info };
}

function numbersOf(b) {
    return [b.arrNum, b.depNum].filter(Boolean);
}

function main() {
    const argv = process.argv.slice(2);
    const [week, day] = argv;
    if (!week || !day) {
        console.error('usage: node verify/app_bars.js <week> <day> [--num N] [--track T] [--around HH:MM] [--json]');
        process.exit(2);
    }
    const opt = {};
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--num') opt.num = String(argv[++i]);
        else if (argv[i] === '--track') opt.track = parseInt(argv[++i], 10);
        else if (argv[i] === '--around') opt.around = parseMin(argv[++i]);
        else if (argv[i] === '--json') opt.json = true;
    }

    const { bars, stitched, info } = buildBars(week, day);
    let view = bars;
    if (opt.num) view = view.filter((b) => numbersOf(b).includes(opt.num));
    if (Number.isFinite(opt.track)) view = view.filter((b) => b.trackId === opt.track);
    if (opt.around != null) {
        const lo = opt.around - 60, hi = opt.around + 60;
        view = view.filter((b) => (b.arrMin != null && b.arrMin >= lo && b.arrMin <= hi) ||
                                   (b.depMin != null && b.depMin >= lo && b.depMin <= hi));
    }
    view.sort((a, b) => (a.trackId - b.trackId) || ((a.arrMin ?? a.depMin ?? 0) - (b.arrMin ?? b.depMin ?? 0)));

    if (opt.json) {
        console.log(JSON.stringify({ week, day, stitched, mergedCount: info && info.mergedCount, bars: view }, null, 2));
        return;
    }

    console.log(`# app bars — ${week} ${day}  (stitched=${stitched}, merged=${info && info.mergedCount || 0}, total bars=${bars.length}, shown=${view.length})`);
    console.log('trk.sub  arrNo  depNo   arr      dep      labels        flags');
    for (const b of view) {
        const labels = [b.arrLabel, b.depLabel].filter(Boolean).join('/') || '·';
        console.log(
            `${String(b.trackId).padStart(2)}.${b.subTrackIndex}   ` +
            `${(b.arrNum || '·').padStart(5)}  ${(b.depNum || '·').padStart(5)}   ` +
            `${b.arr.padEnd(7)}  ${b.dep.padEnd(7)}  ${labels.padEnd(12)}  ${b.flags}`
        );
    }
    // Highlight numbers that produced >1 bar (Bug A signature).
    const byNum = {};
    for (const b of view) for (const n of numbersOf(b)) (byNum[n] ||= []).push(b);
    const multi = Object.entries(byNum).filter(([, v]) => v.length > 1);
    if (multi.length) {
        console.log('\n# multi-bar train numbers (possible split):');
        for (const [n, v] of multi) console.log(`  ${n}: ${v.length} bars  → ${v.map((b) => `${b.trackId}.${b.subTrackIndex}@${b.arr}-${b.dep}`).join(' | ')}`);
    }
}

if (require.main === module) main();
module.exports = { buildBars, effectiveTimes, parseMin };
