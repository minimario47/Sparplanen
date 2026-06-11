'use strict';
/*
 * Seeded stratified REGION sampler + ledger for the accuracy feedback loop.
 *
 * A "region" = (week, day, 3h-page, track-band). We seeded-pick ~8 regions
 * spread across the strata the user named AND across weeks, then verify EVERY
 * numbered bar inside each region. One crop per region (so ~8 image reads/loop
 * cover 20-30 bars) — and reading a whole region also catches missing/extra/
 * split bars, not just the ones we "aimed" at.
 *
 * Emits verify/ledger/loop-<k>-worklist.json (regions + their app bars) and
 * prints the render_region.py commands.
 *
 * Usage: node verify/sample.js --seed 1 [--regions 8] [--exclude regionId,...]
 */
const fs = require('fs');
const path = require('path');
const { loadApp, DAY_ORDER, weekKeysSorted, ROOT } = require('./_load');
const { buildBars } = require('./app_bars');

function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const BANDS = [[1, 3], [4, 6], [7, 9], [10, 12], [13, 16]];
function bandIdx(track) { return track <= 3 ? 0 : track <= 6 ? 1 : track <= 9 ? 2 : track <= 12 ? 3 : 4; }
function rawMin(t) { const s = (t || '').trim(); if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function pageOf(b) { const m = rawMin(b.rawArr) ?? rawMin(b.rawDep); return m == null ? 0 : Math.max(0, Math.min(7, Math.floor(m / 180))); }
function isNumbered(b) { return !!(b.arrNum || b.depNum); }

function regionStrata(page, day, bars) {
    const tags = [];
    if (page === 0) tags.push('start-of-pdf');
    if (page === 7) tags.push('overnight');           // end of day / midnight crossings
    if (page >= 2 && page <= 6) tags.push('mid-day');
    if (page >= 1 && page <= 6 && bars.some((b) => /cfp|ctn/.test(b.flags || ''))) tags.push('page-edge');
    if ((day === 'mandag' || day === 'tisdag') && page <= 1) tags.push('week-start');
    if (!tags.length) tags.push('other');
    return tags;
}

const STRATA_ORDER = ['start-of-pdf', 'mid-day', 'overnight', 'page-edge', 'week-start'];

function main() {
    const argv = process.argv.slice(2);
    const opt = { seed: 1, targetBars: 24, maxRegions: 7, exclude: new Set() };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--seed') opt.seed = parseInt(argv[++i], 10);
        else if (argv[i] === '--bars') opt.targetBars = parseInt(argv[++i], 10);
        else if (argv[i] === '--max-regions') opt.maxRegions = parseInt(argv[++i], 10);
        else if (argv[i] === '--exclude') argv[++i].split(',').filter(Boolean).forEach((x) => opt.exclude.add(x));
    }

    const app = loadApp();
    const weekKeys = weekKeysSorted(app.weeks);

    // Group NATIVE bars into regions. d1- bars (dayOffset 1) are next-day morning
    // re-projected onto today's 30h timeline — they live in a DIFFERENT PDF, so
    // they must not be compared against today's crop. We keep them only to flag
    // the overnight-split signature (an unmerged tail + its d1- continuation = Bug A).
    const regions = new Map(); // id -> {week,day,page,band,tracks,bars[]}
    for (const wk of weekKeys) {
        for (const day of DAY_ORDER) {
            if (!app.weeks[wk] || !app.weeks[wk][day]) continue;
            let bars; try { bars = buildBars(wk, day, app).bars; } catch { continue; }
            const d1ByTrack = {};
            for (const b of bars) if (b.dayOffset === 1) (d1ByTrack[b.trackId] ||= []).push(b);
            for (const b of bars) {
                if (b.dayOffset === 1) continue; // projection, not native to this PDF
                // Overnight split signature: a synthetic-edge tail that also has a
                // separate d1- continuation on the same track (would be one bar in
                // the PDF). depNextDay tails are already merged (single bar).
                const isEdgeTail = /synDepEdge/.test(b.flags || '');
                b.overnightSplit = isEdgeTail && !!(d1ByTrack[b.trackId] && d1ByTrack[b.trackId].length);
                const page = pageOf(b);
                const bi = bandIdx(b.trackId);
                const id = `${wk}|${day}|${page}|${bi}`;
                if (!regions.has(id)) {
                    const [lo, hi] = BANDS[bi];
                    regions.set(id, { id, week: wk, day, page, band: bi, tracks: `${lo}-${hi}`, bars: [] });
                }
                regions.get(id).bars.push(b);
            }
        }
    }

    // Candidate regions: >=3 numbered bars, not excluded.
    const candidates = [...regions.values()]
        .filter((r) => !opt.exclude.has(r.id))
        .map((r) => ({ ...r, numbered: r.bars.filter(isNumbered) }))
        .filter((r) => r.numbered.length >= 3 && r.numbered.length <= 10)
        .map((r) => ({ ...r, strata: regionStrata(r.page, r.day, r.bars) }));

    const rnd = rng(opt.seed * 2654435761);
    const chosen = [];
    const chosenIds = new Set();
    const weekCount = {};
    let barsTotal = 0;
    const maxPerWeek = 2;

    function pick(pool, want) {
        let got = 0;
        for (const r of shuffle(pool, rnd)) {
            if (got >= want) break;
            if (chosenIds.has(r.id)) continue;
            if ((weekCount[r.week] || 0) >= maxPerWeek) continue;
            chosen.push(r); chosenIds.add(r.id);
            weekCount[r.week] = (weekCount[r.week] || 0) + 1;
            barsTotal += r.numbered.length;
            got++;
        }
        return got;
    }

    // Guarantee one region per stratum (all 5 user-named positions), then top up
    // (round-robin) until >= targetBars or maxRegions.
    for (const tag of STRATA_ORDER) pick(candidates.filter((r) => r.strata.includes(tag)), 1);
    let guard = 0;
    while (barsTotal < opt.targetBars && chosen.length < opt.maxRegions && guard++ < 50) {
        for (const tag of STRATA_ORDER) {
            if (barsTotal >= opt.targetBars || chosen.length >= opt.maxRegions) break;
            pick(candidates.filter((r) => r.strata.includes(tag)), 1);
        }
    }

    // Collect all numbered bars in chosen regions = the verification set.
    const barsOut = [];
    for (const r of chosen) {
        for (const b of r.numbered) {
            barsOut.push({
                key: b.key || `${r.week}|${r.day}|${b.id}`,
                regionId: r.id, week: r.week, day: r.day, page: r.page,
                trackId: b.trackId, subTrackIndex: b.subTrackIndex,
                app: {
                    arrNum: b.arrNum, depNum: b.depNum, arr: b.arr, dep: b.dep,
                    arrLabel: b.arrLabel, depLabel: b.depLabel, flags: b.flags,
                    overnightSplit: !!b.overnightSplit,
                },
                truth: null, verdict: null, reason: null,
            });
        }
    }

    const worklist = {
        seed: opt.seed,
        regions: chosen.map((r) => ({
            id: r.id, week: r.week, day: r.day, page: r.page, tracks: r.tracks,
            strata: r.strata, barCount: r.numbered.length,
        })),
        weekSpread: weekCount,
        barCount: barsOut.length,
        bars: barsOut,
    };

    const outDir = path.join(ROOT, 'verify', 'ledger');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `loop-${opt.seed}-worklist.json`);
    fs.writeFileSync(outFile, JSON.stringify(worklist, null, 2));

    console.log(`# loop ${opt.seed}: ${chosen.length} regions, ${barsOut.length} numbered bars to verify`);
    console.log(`#   weeks: ${JSON.stringify(weekCount)}`);
    console.log(`#   worklist -> ${path.relative(ROOT, outFile)}\n`);
    for (const r of chosen) {
        console.log(`python3 verify/render_region.py ${r.week} ${r.day} --page ${r.page} --tracks ${r.tracks}   # [${r.strata.join(',')}] ${r.numbered.length} bars`);
    }
    console.log('\n# app bars per region (fill TRUTH from crops):');
    let curr = null;
    for (const b of barsOut) {
        if (b.regionId !== curr) { curr = b.regionId; console.log(`\n## ${curr}`); }
        console.log(`  trk${b.trackId}.${b.subTrackIndex}  ${(b.app.arrNum || '·')}/${(b.app.depNum || '·')}  ${b.app.arr}->${b.app.dep}  ${[b.app.arrLabel, b.app.depLabel].filter(Boolean).join('/')}  ${b.app.flags}  (${b.key})`);
    }
}

if (require.main === module) main();
