'use strict';
/*
 * verify/workload_counts.js — checks the workload (Belastning) aggregator.
 *
 * Part 1: runs the REAL js/components/workload/workload-aggregator.js in a vm
 * sandbox over real stitched data for a week/day. cachedTrains is built with
 * the same mirrored prepareTrainData() time logic as app_bars.js, extended
 * with the new arrSynthetic/depSynthetic flags. Asserts:
 *   - bucket sums equal an INDEPENDENT count straight off the raw service
 *     fields (real scheduled legs only, inside the 30h canvas),
 *   - synthetic stitch edges contribute nothing,
 *   - per-leg tåg/växling split matches the raw train-number fields.
 *
 * Part 2: unit cases with a mocked delayIntegration — a delayed leg moves
 * bucket, a canceled leg disappears, växlingar never move.
 *
 * Usage: node verify/workload_counts.js [week] [day]   (default 2026-W24 torsdag)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadApp, ROOT } = require('./_load');

const TIMELINE_HOURS = 30;
const BUCKET_MIN = 15;

const week = process.argv[2] || '2026-W24';
const day = process.argv[3] || 'torsdag';

function parseMin(t) {
    const s = (t || '').trim();
    if (!s) return null;
    const [h, m] = s.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

// Mirror of prepareTrainData() time logic (same as app_bars.js) + the new
// arrSynthetic/depSynthetic flags from schedule-renderer.js.
function effectiveTimes(service, stitched) {
    const dayOffset = service._dayOffset || 0;
    const base = dayOffset * 1440;
    let arr = parseMin(service.scheduledArrivalTime);
    let dep = parseMin(service.scheduledDepartureTime);
    if (arr != null) arr += base;
    if (dep != null) dep += base;

    let arrSynthetic = false;
    let depSynthetic = false;
    if (service._syntheticArrEdge && arr == null) { arr = base; arrSynthetic = true; }
    if (service._depNextDay && dep != null) {
        dep += 1440;
    } else if (service._syntheticDepFar) {
        dep = TIMELINE_HOURS * 60; depSynthetic = true;
    } else if (service._syntheticDepEdge && dep == null) {
        dep = base + 1440; depSynthetic = true;
    }
    if (dep != null && (service._depNextDay || service._syntheticDepEdge || service._syntheticDepFar)) {
        const tlEnd = TIMELINE_HOURS * 60;
        if (dep > tlEnd) { dep = tlEnd; depSynthetic = true; }
    }
    if (arr != null && dep != null && dep < arr) {
        dep += 1440;
    } else if (arr == null && dep != null && !dayOffset && !service._depNextDay && !stitched) {
        const depHour = Math.floor((dep % 1440) / 60);
        if (depHour >= 0 && depHour < 6) dep += 1440;
    }
    return { arr, dep, arrSynthetic, depSynthetic };
}

function buildSandbox(cachedTrains, timelineStart, delayIntegration) {
    const sandbox = {
        window: {
            cachedTrains,
            scheduleState: { timelineStart },
            TimeManager: { timelineHours: TIMELINE_HOURS },
            delayIntegration: delayIntegration || null,
        },
        console,
        Date,
    };
    vm.createContext(sandbox);
    const code = fs.readFileSync(path.join(ROOT, 'js/components/workload/workload-aggregator.js'), 'utf8');
    vm.runInContext(code, sandbox, { filename: 'workload-aggregator.js' });
    return sandbox.window;
}

let failures = 0;
function check(label, ok, detail) {
    console.log(`${ok ? '  ✅' : '  ❌'} ${label}${ok ? '' : ` — ${detail}`}`);
    if (!ok) failures++;
}

// ---------- Part 1: real data ----------
console.log(`\n— Part 1: real stitched data, ${week} ${day} —`);
const app = loadApp();
const services = app.weeks[week] && app.weeks[week][day];
if (!services) throw new Error(`No services for ${week} ${day}`);
const stitchedOut = app.DayStitcher.stitch({ week, day, services });
const stitched = !!(stitchedOut.info && stitchedOut.info.stitched);

const anchor = new Date(2026, 5, 11, 0, 0, 0, 0); // arbitrary midnight; June = no DST edge
const cachedTrains = [];
const independent = { tag: 0, vaxling: 0 };

for (const s of stitchedOut.services) {
    if (!(s.trackId >= 1 && s.trackId <= 16)) continue;
    const t = effectiveTimes(s, stitched);
    cachedTrains.push({
        id: s.id,
        arrivalTrainNumber: s.arrivalTrainNumber || '',
        departureTrainNumber: s.departureTrainNumber || '',
        dayOffset: s._dayOffset || 0,
        arrTime: t.arr != null ? new Date(anchor.getTime() + t.arr * 60000) : null,
        depTime: t.dep != null ? new Date(anchor.getTime() + t.dep * 60000) : null,
        arrSynthetic: t.arrSynthetic,
        depSynthetic: t.depSynthetic,
    });
    // Independent count straight off the raw fields: a leg is a real movement
    // when the PDF gave it a scheduled time and it lands inside the canvas.
    if (t.arr != null && !t.arrSynthetic && t.arr >= 0 && t.arr < TIMELINE_HOURS * 60) {
        independent[(s.arrivalTrainNumber || '').trim() ? 'tag' : 'vaxling']++;
    }
    if (t.dep != null && !t.depSynthetic && t.dep >= 0 && t.dep < TIMELINE_HOURS * 60) {
        independent[(s.departureTrainNumber || '').trim() ? 'tag' : 'vaxling']++;
    }
}

const w1 = buildSandbox(cachedTrains, anchor, null);
const r1 = w1.WorkloadAggregator.compute({ useDelay: false });

check('aggregator returned a result', !!r1);
check(`bucketCount = ${TIMELINE_HOURS * 60 / BUCKET_MIN}`, r1.bucketCount === TIMELINE_HOURS * 60 / BUCKET_MIN, `got ${r1.bucketCount}`);

let sumTag = 0, sumVax = 0;
for (const b of r1.buckets) { sumTag += b.tag; sumVax += b.vaxling; }
check('bucket sums equal reported totals', sumTag === r1.totalTag && sumVax === r1.totalVaxling,
    `buckets ${sumTag}/${sumVax} vs totals ${r1.totalTag}/${r1.totalVaxling}`);
check(`tåg total matches independent raw count (${independent.tag})`, r1.totalTag === independent.tag, `got ${r1.totalTag}`);
check(`växling total matches independent raw count (${independent.vaxling})`, r1.totalVaxling === independent.vaxling, `got ${r1.totalVaxling}`);

// Synthetic edges contribute nothing: re-run with all synthetic legs stripped.
const noSynth = cachedTrains.map((tr) => ({
    ...tr,
    arrTime: tr.arrSynthetic ? null : tr.arrTime,
    depTime: tr.depSynthetic ? null : tr.depTime,
    arrSynthetic: false,
    depSynthetic: false,
}));
const r1b = buildSandbox(noSynth, anchor, null).WorkloadAggregator.compute({ useDelay: false });
check('synthetic stitch edges contribute zero events',
    r1b.totalTag === r1.totalTag && r1b.totalVaxling === r1.totalVaxling,
    `with flags ${r1.totalTag}/${r1.totalVaxling}, stripped ${r1b.totalTag}/${r1b.totalVaxling}`);

const synthCount = cachedTrains.filter((t) => t.arrSynthetic || t.depSynthetic).length;
console.log(`  ℹ️  ${cachedTrains.length} bars, ${synthCount} with synthetic edges, ` +
    `totals: ${r1.totalTag} tåg + ${r1.totalVaxling} växl.`);
const top = r1.buckets.map((b, i) => ({ i, n: b.tag + b.vaxling, b }))
    .sort((a, c) => c.n - a.n).slice(0, 3);
for (const t of top) {
    console.log(`  ℹ️  busy: ${w1.WorkloadAggregator.bucketLabel(r1, t.i)} → ${t.n} (${t.b.tag} tåg, ${t.b.vaxling} växl.)`);
}

// ---------- Part 2: delay adjustment unit cases ----------
console.log('\n— Part 2: delay adjustment (mocked feed) —');
const T0 = anchor.getTime();
const mk = (min) => new Date(T0 + min * 60000);
// Local-wall-clock ISO with a +02:00 suffix; the aggregator's parse idiom
// strips the offset, so the wall clock must match the scheduled Date's.
const isoLocal = (min) => {
    const d = mk(min);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00.000+02:00`;
};

const trains2 = [
    { id: 1, arrivalTrainNumber: '344', departureTrainNumber: '', arrTime: mk(600), depTime: null },          // 10:00, delayed +30
    { id: 2, arrivalTrainNumber: '', departureTrainNumber: '777', arrTime: null, depTime: mk(700) },          // canceled
    { id: 3, arrivalTrainNumber: '', departureTrainNumber: '', arrTime: mk(615), depTime: mk(630) },          // växling, untouched
];
const delayIntegration = {
    isInitialized: true,
    getDelayContextsForTrain(train) {
        if (train.id === 1) {
            return [{ leg: 'arrival', delayInfo: { isCanceled: false, isReplaced: false, actualTime: null, estimatedTime: isoLocal(630), advertisedTime: isoLocal(600), delayMinutes: 30 } }];
        }
        if (train.id === 2) {
            return [{ leg: 'departure', delayInfo: { isCanceled: true, isReplaced: false } }];
        }
        return [];
    },
};

const w2 = buildSandbox(trains2, anchor, delayIntegration);
const plan = w2.WorkloadAggregator.compute({ useDelay: false });
const adj = w2.WorkloadAggregator.compute({ useDelay: true });

const bAt = (r, min) => r.buckets[Math.floor(min / BUCKET_MIN)];
check('planned: arrival 344 in 10:00 bucket', bAt(plan, 600).tag === 1, JSON.stringify(bAt(plan, 600)));
check('delayed: arrival 344 moved to 10:30 bucket', bAt(adj, 600).tag === 0 && bAt(adj, 630).tag === 1,
    `10:00=${JSON.stringify(bAt(adj, 600))} 10:30=${JSON.stringify(bAt(adj, 630))}`);
check('canceled: departure 777 counted in planned mode', plan.totalTag === 2, `totalTag=${plan.totalTag}`);
check('canceled: departure 777 dropped in delay mode', adj.totalTag === 1, `totalTag=${adj.totalTag}`);
check('växling legs unaffected by delay mode',
    plan.totalVaxling === 2 && adj.totalVaxling === 2 &&
    bAt(adj, 615).vaxling === 1 && bAt(adj, 630).vaxling === 1,
    `plan=${plan.totalVaxling} adj=${adj.totalVaxling}`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
