'use strict';
// Scan for Bug B signature: two overlapping bars on the SAME track whose
// subTrackIndex differ by >= 2 (a gap lane between them).
const { loadApp, DAY_ORDER, weekKeysSorted } = require('./_load');
const { buildBars } = require('./app_bars');

const app = loadApp();
const overlap = (a, b) => a.arrMin != null && a.depMin != null && b.arrMin != null && b.depMin != null && a.arrMin < b.depMin && b.arrMin < a.depMin;

let n = 0;
const hits = [];
for (const wk of weekKeysSorted(app.weeks)) {
    for (const d of DAY_ORDER) {
        if (!app.weeks[wk] || !app.weeks[wk][d]) continue;
        const bars = buildBars(wk, d, app).bars.filter((b) => b.dayOffset !== 1 && b.arrMin != null && b.depMin != null);
        const byTrack = {};
        for (const b of bars) (byTrack[b.trackId] ||= []).push(b);
        for (const t of Object.keys(byTrack)) {
            const arr = byTrack[t];
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    const a = arr[i], b = arr[j];
                    if (overlap(a, b) && Math.abs(a.subTrackIndex - b.subTrackIndex) >= 2) {
                        n++;
                        if (hits.length < 16) hits.push(`${wk} ${d} trk${t} sub${a.subTrackIndex}(${a.arrNum || a.depNum} ${a.arr}-${a.dep}) vs sub${b.subTrackIndex}(${b.arrNum || b.depNum} ${b.arr}-${b.dep})`);
                    }
                }
            }
        }
    }
}
console.log('overlapping same-track pairs with subIndex gap>=2:', n);
hits.forEach((h) => console.log('  ' + h));
