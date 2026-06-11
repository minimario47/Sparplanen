'use strict';
/*
 * Shared loader for the verification harness.
 *
 * Loads the *real* baked data (trains.js) and the *real* runtime transform
 * (js/modules/day-stitcher.js) into an isolated VM sandbox with a minimal
 * `window` shim, so the harness reproduces exactly what the app builds —
 * without a browser. Used by app_bars.js and sample.js.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadApp() {
    // Minimal window shim. day-stitcher only touches window.SPARPLANEN_WEEKS,
    // window.SPARPLANEN_ANCHORS and assigns window.DayStitcher. The timezone
    // helper guards every window.location access behind a typeof check.
    const sandbox = { window: {}, console, URLSearchParams };
    vm.createContext(sandbox);

    const files = [
        'trains.js',
        'js/schedule-timezone-helpers.js',
        'js/modules/day-stitcher.js',
    ];
    for (const f of files) {
        const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
        vm.runInContext(code, sandbox, { filename: f });
    }

    const w = sandbox.window;
    if (!w.SPARPLANEN_WEEKS) throw new Error('trains.js did not define SPARPLANEN_WEEKS');
    if (!w.DayStitcher) throw new Error('day-stitcher.js did not define DayStitcher');

    return {
        weeks: w.SPARPLANEN_WEEKS,
        anchors: w.SPARPLANEN_ANCHORS || {},
        DayStitcher: w.DayStitcher,
        window: w,
    };
}

// Days in canonical order (matches Swedish file naming, ASCII-safe keys).
const DAY_ORDER = ['mandag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag'];

function weekKeysSorted(weeks) {
    return Object.keys(weeks).sort((a, b) => {
        const pa = a.split('-W'), pb = b.split('-W');
        const ya = +pa[0] || 0, yb = +pb[0] || 0;
        if (ya !== yb) return ya - yb;
        return (+pa[1] || 0) - (+pb[1] || 0);
    });
}

module.exports = { loadApp, DAY_ORDER, weekKeysSorted, ROOT };
