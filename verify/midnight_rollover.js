/**
 * verify/midnight_rollover.js — proves the 06:00 service-day rollover.
 *
 * Loads the real schedule-timezone-helpers.js + time-manager.js in a vm
 * sandbox with a MOCKED clock (argless `new Date()` / `Date.now()` → a fixed
 * instant) and asserts bundle selection + "now" mapping across the midnight
 * boundary. Run with Stockholm as the local TZ so the app's local-time Date
 * math matches a real Swedish browser:
 *
 *   TZ=Europe/Stockholm node verify/midnight_rollover.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RealDate = Date;
let FIXED_MS = RealDate.UTC(2026, 5, 9, 0, 0, 0); // mutated per case

class MockDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) { super(FIXED_MS); } else { super(...args); }
  }
  static now() { return FIXED_MS; }
}

// Stockholm wall-clock → real UTC ms. June is CEST (UTC+2).
function sthlm(y, mo, d, h, mi) { return RealDate.UTC(y, mo - 1, d, h - 2, mi, 0); }

const ANCHORS = {
  '2026-W19': { mandag: '2026-05-04', tisdag: '2026-05-05' },
  '2026-W24': { mandag: '2026-06-08', tisdag: '2026-06-09', onsdag: '2026-06-10' },
};
const WEEKS = {
  '2026-W19': { mandag: [{ trackId: 1 }], tisdag: [{ trackId: 1 }] },
  '2026-W24': { mandag: [{ trackId: 1 }], tisdag: [{ trackId: 1 }], onsdag: [{ trackId: 1 }] },
};

const win = {
  SPARPLANEN_ANCHORS: ANCHORS,
  SPARPLANEN_WEEKS: WEEKS,
  location: { search: '' },
  URLSearchParams,
};
const sandbox = {
  window: win,
  Date: MockDate,
  Intl,
  console,
  URLSearchParams,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  setInterval: () => 0,
  clearInterval: () => {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['js/schedule-timezone-helpers.js', 'js/modules/time-manager.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const Resolve = win.SparplanenResolve;
const tm = win.TimeManager;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ---- Bundle selection (pickWeekAndDay via parseScheduleNow) ----
console.log('\n▶ Bundle selection across the boundary (anchor expected):');
const bundleCases = [
  ['Tue 00:30  → keep Monday',  sthlm(2026, 6, 9, 0, 30),  '2026-06-08'],
  ['Tue 05:59  → keep Monday',  sthlm(2026, 6, 9, 5, 59),  '2026-06-08'],
  ['Tue 06:01  → roll Tuesday', sthlm(2026, 6, 9, 6, 1),   '2026-06-09'],
  ['Tue 07:30  → Tuesday',      sthlm(2026, 6, 9, 7, 30),  '2026-06-09'],
  ['Tue 14:00  → Tuesday (no regression)', sthlm(2026, 6, 9, 14, 0), '2026-06-09'],
  ['Mon 00:10  → keep Sunday-side (prev day) Monday→', sthlm(2026, 6, 8, 0, 10), '2026-06-08'],
];
for (const [name, ms, wantAnchor] of bundleCases) {
  FIXED_MS = ms;
  const r = Resolve.parseScheduleNow();
  ok(name, r.anchorStr === wantAnchor, `got ${r.anchorStr} (day ${r.day})`);
}
// Mon 00:10 special-case: service day = Sunday, but no Sunday bundle exists in
// W24, so pickWeekAndDay falls back. Re-assert with the day it SHOULD target.
FIXED_MS = sthlm(2026, 6, 8, 0, 10);
ok('Mon 00:10 service day key = sondag',
   Resolve.getStockholmSwedishDayKey(new MockDate(MockDate.now() - 6 * 3600e3)) === 'sondag');

// ---- TimeManager "now" mapping + back-navigation ----
console.log('\n▶ TimeManager with Monday anchor, real clock Tue 00:30:');
FIXED_MS = sthlm(2026, 6, 9, 0, 30);
tm.qaOverrideActive = false;
tm.scheduleAnchorStr = null;
tm.setScheduleAnchor('2026-06-08');
const bounds = tm.getScheduleDayBounds();
const now = tm.getEffectiveNow();
const hoursIntoCanvas = (now.getTime() - bounds.start.getTime()) / 3600e3;
ok('now is inside the 30h canvas', now >= bounds.start && now < bounds.end);
ok('now lands in the 24:xx post-midnight band (≈24.5h)',
   Math.abs(hoursIntoCanvas - 24.5) < 0.05, `got ${hoursIntoCanvas.toFixed(2)}h`);

// Back-navigation from "now" (24:30) must succeed, not clamp at 00:00.
tm.viewTime = new MockDate(now.getTime());
const before = tm.viewTime.getTime();
const moved = tm.navigatePrevious();
ok('navigatePrevious from 24:30 succeeds', moved === true);
ok('viewTime actually moved earlier', tm.viewTime.getTime() < before);
ok('can keep going back toward Monday evening',
   tm.viewTime.getTime() > bounds.start.getTime());

// ---- Stale bundle still folds onto the anchor (no regression) ----
console.log('\n▶ Stale bundle (May 4 anchor, real clock mid-June 14:00):');
FIXED_MS = sthlm(2026, 6, 9, 14, 0);
tm.qaOverrideActive = false;
tm.scheduleAnchorStr = null;
tm.setScheduleAnchor('2026-05-04');
const staleNow = tm.getEffectiveNow();
ok('folds time-of-day onto the stale anchor day',
   staleNow.getFullYear() === 2026 && staleNow.getMonth() === 4 && staleNow.getDate() === 4,
   staleNow.toString());
ok('keeps the real time-of-day (14:00)', staleNow.getHours() === 14, `h=${staleNow.getHours()}`);

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
