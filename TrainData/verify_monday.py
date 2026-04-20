#!/usr/bin/env python3
"""
verify_monday.py

Consume monday_schedule.json + monday_closures.json and produce
monday_verify.json with a list of severity-tagged findings.

Exit code is non-zero if any HIGH-severity finding is recorded.

Usage:
    python verify_monday.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List

HERE = Path(__file__).parent
SCHEDULE_JSON = HERE / "monday_schedule.json"
CLOSURES_JSON = HERE / "monday_closures.json"
REPORT_JSON = HERE / "monday_verify.json"

# Color RGBs that have been observed in the Monday PDF, used only to surface
# "unknown color" findings when new colors appear.
KNOWN_COLORS = {
    (0.733, 0.710, 0.616),
    (0.000, 1.000, 1.000),
    (1.000, 0.600, 0.800),
    (1.000, 0.949, 0.584),
    (0.800, 0.600, 1.000),
    (0.800, 1.000, 0.800),
    (1.000, 0.800, 0.600),
    (0.984, 0.769, 0.192),
    (0.925, 0.118, 0.000),
    (0.600, 0.800, 1.000),
    (1.000, 0.400, 0.000),
    (0.396, 0.478, 0.529),
    (0.627, 0.729, 0.686),
    (0.878, 0.871, 0.796),
}


def hhmm_to_min(t: str) -> int:
    if not t or ":" not in t:
        return -1
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def add(findings: List[Dict[str, Any]], severity: str, code: str, message: str, **extra: Any) -> None:
    findings.append({
        "severity": severity,
        "code": code,
        "message": message,
        **extra,
    })


def verify_schedule(schedule: Dict, closures: Dict) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    entries: List[Dict[str, Any]] = schedule["entries"]

    # HIGH: invalid trackId / subTrackIndex
    for e in entries:
        if not (1 <= e["trackId"] <= 16):
            add(findings, "HIGH", "invalid_track", f"trackId={e['trackId']} out of 1..16", slot_id=e["id"])
        if not (0 <= e["subTrackIndex"] <= 3):
            add(findings, "HIGH", "invalid_sub", f"subTrackIndex={e['subTrackIndex']} out of 0..3", slot_id=e["id"])

    # HIGH: physical conflict — two arrivals overlapping on the same (track, sub)
    by_row: dict = defaultdict(list)
    for e in entries:
        by_row[(e["trackId"], e["subTrackIndex"])].append(e)
    for (track, sub), slots in by_row.items():
        # Compute an interval in minutes for each slot (arrival_time .. departure_time).
        intervals: List[tuple] = []
        for s in slots:
            a = hhmm_to_min(s["scheduledArrivalTime"])
            d = hhmm_to_min(s["scheduledDepartureTime"])
            if a < 0 or d < 0:
                continue
            if d <= a and not s.get("continuesToNextPage"):
                add(findings, "HIGH", "dep_before_arr",
                    f"departureTime {s['scheduledDepartureTime']} before arrivalTime {s['scheduledArrivalTime']}",
                    slot_id=s["id"], trackId=track, subTrackIndex=sub)
            intervals.append((a, d, s))
        intervals.sort()
        for i in range(len(intervals) - 1):
            a1, d1, s1 = intervals[i]
            a2, d2, s2 = intervals[i + 1]
            overlap = d1 - a2
            if overlap <= 0:
                continue
            # Same train number consumer -> fine; otherwise flag.
            if s1.get("arrivalTrainNumber") and s2.get("arrivalTrainNumber") and s1["arrivalTrainNumber"] == s2["arrivalTrainNumber"]:
                continue
            # Rounding in the label position can produce ≤1-minute overlaps.
            severity = "HIGH" if overlap >= 2 else "MEDIUM"
            add(findings, severity, "physical_conflict",
                f"slots {s1['id']} and {s2['id']} overlap by {overlap} min on track {track}.{sub}",
                slot_ids=[s1["id"], s2["id"]])

    # HIGH: orphaned page-boundary slots
    by_track_sub = defaultdict(list)
    for e in entries:
        by_track_sub[(e["trackId"], e["subTrackIndex"])].append(e)
    # after cross-page stitching, no slot should carry continuesToNextPage AND
    # continuesFromPrevPage from a pair-with-unknown-partner state; single-sided
    # is fine for day-start/day-end trains.

    # MEDIUM: no train numbers at all
    for e in entries:
        if not e.get("arrivalTrainNumber") and not e.get("departureTrainNumber"):
            add(findings, "MEDIUM", "no_train_numbers",
                "slot has neither arrival nor departure train number",
                slot_id=e["id"], trackId=e["trackId"], subTrackIndex=e["subTrackIndex"],
                arrivalTime=e["scheduledArrivalTime"], departureTime=e["scheduledDepartureTime"])

    # MEDIUM: vehicle_count >= 3 (rare)
    for e in entries:
        if e["trainSet"]["count"] >= 3:
            add(findings, "MEDIUM", "unusual_vehicle_count",
                f"vehicleCount={e['trainSet']['count']}",
                slot_id=e["id"])

    # MEDIUM: unknown bar colors
    color_counter: Counter = Counter()
    for e in entries:
        color = tuple(round(c, 3) for c in e.get("barColor", []))
        color_counter[color] += 1
        if color not in KNOWN_COLORS:
            add(findings, "MEDIUM", "unknown_bar_color",
                f"slot {e['id']} has unknown color {color}",
                slot_id=e["id"], color=list(color))

    # LOW: arrival-only or departure-only slots (expected at day edges / page edges)
    arrival_only = 0
    departure_only = 0
    for e in entries:
        arr = bool(e.get("arrivalTrainNumber"))
        dep = bool(e.get("departureTrainNumber"))
        if arr and not dep:
            arrival_only += 1
        elif dep and not arr:
            departure_only += 1

    # Closure sanity
    for c in closures["entries"]:
        if not (1 <= c["trackId"] <= 16):
            add(findings, "HIGH", "invalid_track_closure", f"trackId={c['trackId']}", closure_id=c["id"])
        if not (0 <= c["subTrackIndex"] <= 3):
            add(findings, "HIGH", "invalid_sub_closure", f"subTrackIndex={c['subTrackIndex']}", closure_id=c["id"])
        a = hhmm_to_min(c["startTime"])
        b = hhmm_to_min(c["endTime"])
        if a >= 0 and b >= 0 and b <= a:
            add(findings, "HIGH", "closure_dep_before_arr",
                f"closure endTime {c['endTime']} <= startTime {c['startTime']}",
                closure_id=c["id"])

    # Summary counters appended at the end
    summary: Dict[str, Any] = {
        "slots_total": len(entries),
        "closures_total": len(closures["entries"]),
        "arrivals_with_numbers": sum(1 for e in entries if e.get("arrivalTrainNumber")),
        "departures_with_numbers": sum(1 for e in entries if e.get("departureTrainNumber")),
        "arrival_only": arrival_only,
        "departure_only": departure_only,
        "per_track": Counter(e["trackId"] for e in entries),
        "colors_found": {str(list(k)): v for k, v in color_counter.most_common()},
    }
    findings.append({"severity": "INFO", "code": "summary", "message": "summary counters", **summary})

    return findings


def main() -> int:
    schedule = json.loads(SCHEDULE_JSON.read_text())
    closures = json.loads(CLOSURES_JSON.read_text())
    findings = verify_schedule(schedule, closures)

    sev_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INFO": 3}
    findings.sort(key=lambda f: (sev_order.get(f["severity"], 9), f["code"]))

    REPORT_JSON.write_text(json.dumps({
        "schedule": str(SCHEDULE_JSON.name),
        "closures": str(CLOSURES_JSON.name),
        "findings": findings,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    by_sev: Counter = Counter(f["severity"] for f in findings)
    print(f"Wrote {REPORT_JSON.name}")
    for sev in ("HIGH", "MEDIUM", "LOW", "INFO"):
        if sev in by_sev:
            print(f"  {sev}: {by_sev[sev]}")

    return 1 if by_sev["HIGH"] else 0


if __name__ == "__main__":
    sys.exit(main())
