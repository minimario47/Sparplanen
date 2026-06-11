'use strict';
/*
 * Scorer for one loop. Reads verify/ledger/loop-<k>-results.json — an array of
 * verdicts I fill after reading the crops:
 *   { key, verdict: "ok"|"wrong", class?: "split"|"phantom-lane"|"number"|"time"|"track"|"missing"|"spurious", reason? }
 * Prints counts + % wrong and appends a row to verify/ledger/summary.md.
 *
 * Usage: node verify/score.js <loop-k>
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_load');

const loop = process.argv[2];
if (!loop) { console.error('usage: node verify/score.js loop-1'); process.exit(2); }

const dir = path.join(ROOT, 'verify', 'ledger');
const results = JSON.parse(fs.readFileSync(path.join(dir, `${loop}-results.json`), 'utf8'));

const checked = results.length;
const wrong = results.filter((r) => r.verdict === 'wrong');
const pct = checked ? (wrong.length / checked * 100) : 0;

const byClass = {};
for (const r of wrong) byClass[r.class || 'unknown'] = (byClass[r.class || 'unknown'] || 0) + 1;

console.log(`${loop}: checked=${checked}  wrong=${wrong.length}  %wrong=${pct.toFixed(1)}%`);
console.log(`  by class: ${JSON.stringify(byClass)}`);
for (const r of wrong) console.log(`  WRONG [${r.class || '?'}] ${r.key} — ${r.reason || ''}`);

const summaryFile = path.join(dir, 'summary.md');
let head = '';
if (!fs.existsSync(summaryFile)) {
    head = '# Train PDF→bar accuracy — loop results\n\n' +
        '| loop | checked | wrong | % wrong | classes |\n|---|---|---|---|---|\n';
}
const row = `| ${loop} | ${checked} | ${wrong.length} | ${pct.toFixed(1)}% | ${JSON.stringify(byClass)} |\n`;
fs.appendFileSync(summaryFile, head + row);
console.log(`  -> appended to ${path.relative(ROOT, summaryFile)}`);
