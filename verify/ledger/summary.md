# Train PDF→bar accuracy — loop results

| loop | checked | wrong | % wrong | classes |
|---|---|---|---|---|
| loop-1 | 36 | 1 | 2.8% | {"page-split":1} |

## Fixes applied after loop 1
- **Bug A — overnight numberless-merge (the 496 case).** `js/modules/day-stitcher.js`: `findPartner` now merges a parked tail with the *single* numberless `cfp` morning continuation on its track (was: only numberless tails could merge), and `stitch` always consumes the chosen partner (was: only same-number partners), so the numberless "D" morning piece no longer leaks as a phantom second bar. Runtime-only, no regen. Verified headless + real browser (one continuous 496 bar on Spår 11).
- **Bug C — mid-day page-boundary coupled split (the 167 case).** `TrainData/extract_monday.py`: new `repair_coupled_page_splits()` after `stitch_across_pages` — an orphaned `ctn` slot with a departure number but no departure time borrows the time from its coupled partner (same track, same departure number, **different sub-track**, sane forward time). Regenerated `trains.js` (+392 line diff, all dep-time fills / ctn clears). Corpus signature 44 → 4; 0 new duplicate bars (3 pre-existing, unchanged).
| loop-2 | 39 | 0 | 0.0% | {} |

## Bug B (same-track "phantom lane gap") — investigated
The reported "two same-track trains separated as if a train is between them" was
traced to `subTrackIndex` values that skip a number (e.g. 0 and 2). Verified against
the PDF (W17 torsdag track 7, the two 08:23 `155` units): the bars sit on genuinely
**non-adjacent physical sub-tracks**, and the skipped sub-track 1 is a real row used by
other trains at other times (`382`, `20352`, `3238`). So the gap **faithfully reflects
the PDF's physical sub-track layout** — `train-positioning.js` renders `subTrackIndex`
as-is; it is not a parser or rendering defect. Compacting lanes to remove the visual gap
is possible but would make the app diverge from the PDF's physical track usage — a display
choice to confirm with the user, not a silent change.

Separately: a rare PRE-EXISTING phantom-duplicate (an all-day artifact bar overlapping the
real bar, e.g. `390` on W24 tis/ons/tors track 8.2) — 3 exact duplicates corpus-wide, NOT
introduced by these fixes. Flagged for follow-up.
| loop-3 | 35 | 0 | 0.0% | {} |
| loop-4 | 30 | 0 | 0.0% | {} |
| loop-5 | 31 | 0 | 0.0% | {} |
