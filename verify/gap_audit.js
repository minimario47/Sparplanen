'use strict';
/*
 * Corpus-wide phantom-lane-gap audit (Bug B).
 *
 * Runs the app's REAL train-positioning.js (the lane assignment) over the REAL
 * stitched bars for every week/day, then detects a TRUE rendered gap: two bars
 * on the same track that overlap in time but whose lane intervals have an empty
 * lane between them that no third overlapping bar fills. This is exactly the
 * "two trains on the same track separated as if a train sits between them" bug —
 * measured in lane space (visualLaneStart/visualLaneSpan), which since the fix
 * equals the packed lane, so it matches what the browser draws.
 *
 *   node verify/gap_audit.js            # summary
 *   node verify/gap_audit.js --list     # list every gap
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { loadApp, DAY_ORDER, weekKeysSorted, ROOT } = require('./_load');
const { buildBars } = require('./app_bars');

// Load the real positioning engine into a tiny window shim.
function loadPositioning() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/train-positioning.js'), 'utf8'), sandbox, {
        filename: 'train-positioning.js',
    });
    return sandbox.window.TrainPositioning;
}

// app bar -> the train-shape that train-positioning.js consumes.
function toTrain(b) {
    return {
        id: b.id,
        trackId: b.trackId,
        subTrackIndex: b.subTrackIndex,
        vehicleCount: b._vehicleCount || 1,
        arrTime: b.arrMin != null ? new Date(b.arrMin * 60000) : null,
        depTime: b.depMin != null ? new Date(b.depMin * 60000) : null,
    };
}

function auditDay(week, day, app, TP) {
    const { bars } = buildBars(week, day, app);
    // attach vehicleCount from the stitched service set (buildBars drops it)
    const services = app.weeks[week][day];
    const vcById = new Map(services.map((s) => [s.id, (s.trainSet && s.trainSet.count) || 1]));
    const drawable = bars
        .filter((b) => b.arrMin != null || b.depMin != null)
        .map((b) => ({ ...b, _vehicleCount: vcById.get(b.id) || 1 }));

    const byTrack = {};
    for (const b of drawable) (byTrack[b.trackId] ||= []).push(b);

    const gaps = [];
    for (const t of Object.keys(byTrack)) {
        const trains = byTrack[t].map(toTrain);
        const placements = TP.calculateTrainPositions(trains);
        const recs = placements.map((p, i) => {
            const b = byTrack[t][i];
            return {
                lane: p.visualLaneStart,
                span: p.visualLaneSpan,
                arrMin: b.arrMin ?? b.depMin,
                depMin: b.depMin ?? b.arrMin,
                label: `${b.arrNum || '-'}/${b.depNum || '-'}@sub${b.subTrackIndex}`,
            };
        });
        const xo = (a, b) => a.arrMin < b.depMin && b.arrMin < a.depMin;
        for (let i = 0; i < recs.length; i++) {
            for (let j = i + 1; j < recs.length; j++) {
                const a = recs[i], b = recs[j];
                if (!xo(a, b)) continue;
                const aEnd = a.lane + a.span, bEnd = b.lane + b.span;
                // empty lane band strictly between the two intervals?
                const lo = Math.min(aEnd, bEnd), hi = Math.max(a.lane, b.lane);
                if (hi - lo < 1) continue; // adjacent or overlapping lanes
                // is any lane in [lo,hi) occupied by a third time-overlapping bar?
                const filled = recs.some((c, k) => {
                    if (k === i || k === j) return false;
                    if (!(c.arrMin < Math.min(a.depMin, b.depMin) && Math.max(a.arrMin, b.arrMin) < c.depMin)) return false;
                    return c.lane < hi && c.lane + c.span > lo;
                });
                if (!filled) gaps.push(`${week} ${day} trk${t}: ${a.label}[lane${a.lane}] | ${b.label}[lane${b.lane}]  hole=${lo}..${hi - 1}`);
            }
        }
    }
    return gaps;
}

function main() {
    const list = process.argv.includes('--list');
    const app = loadApp();
    const TP = loadPositioning();
    let total = 0;
    const all = [];
    for (const wk of weekKeysSorted(app.weeks)) {
        for (const d of DAY_ORDER) {
            if (!app.weeks[wk] || !app.weeks[wk][d]) continue;
            const g = auditDay(wk, d, app, TP);
            total += g.length;
            all.push(...g);
        }
    }
    console.log(`TRUE phantom lane gaps across corpus: ${total}`);
    if (list) all.forEach((g) => console.log('  ' + g));
    else all.slice(0, 20).forEach((g) => console.log('  ' + g));
}

if (require.main === module) main();
module.exports = { auditDay, loadPositioning };
