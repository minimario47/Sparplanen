#!/usr/bin/env python3
"""
emit_week_bundle.py
===================

Reads ``ingest-manifest.json`` and writes root ``trains.js`` + ``closures.js`` with
``SPARPLANEN_WEEKS`` / ``SPARPLANEN_CLOSURES_WEEKS`` / ``SPARPLANEN_ANCHORS`` for the web app.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TRAINS_JS = ROOT / "trains.js"
CLOSURES_JS = ROOT / "closures.js"

DAY_ORDER = {
    "mandag": 1,
    "tisdag": 2,
    "onsdag": 3,
    "torsdag": 4,
    "fredag": 5,
    "lordag": 6,
    "sondag": 7,
}
DAY_ORDER_SORT = [
    "mandag",
    "tisdag",
    "onsdag",
    "torsdag",
    "fredag",
    "lordag",
    "sondag",
]


def _anchor_str(year: int, iso_week: int, day_key: str) -> str:
    d = date.fromisocalendar(year, iso_week, DAY_ORDER[day_key])
    return d.isoformat()


def _clean_trains(data: dict, renum_start: int) -> list[dict[str, object]]:
    raw = data.get("entries", [])
    out: list[dict[str, object]] = []
    for i, e in enumerate(raw, renum_start):
        ee = e if isinstance(e, dict) else {}
        ts = ee.get("trainSet")
        if not isinstance(ts, dict):
            ts = {"vehicleTypeID": "X40", "count": 1}
        out.append(
            {
                "id": i,
                "trackId": ee.get("trackId"),
                "arrivalTrainNumber": (ee.get("arrivalTrainNumber") or "")
                if ee.get("arrivalTrainNumber") is not None
                else "",
                "departureTrainNumber": (ee.get("departureTrainNumber") or "")
                if ee.get("departureTrainNumber") is not None
                else "",
                "scheduledArrivalTime": (ee.get("scheduledArrivalTime") or "")
                if ee.get("scheduledArrivalTime") is not None
                else "",
                "scheduledDepartureTime": (ee.get("scheduledDepartureTime") or "")
                if ee.get("scheduledDepartureTime") is not None
                else "",
                "origin": "",
                "destination": "",
                "subTrackIndex": ee.get("subTrackIndex", 0),
                "trainSet": {
                    "vehicleTypeID": str(ts.get("vehicleTypeID", "X40") or "X40"),
                    "count": int(ts.get("count", 1) or 1),
                },
                "barColor": ee.get("barColor") or [],
                "continuesFromPrevPage": bool(ee.get("continuesFromPrevPage", False)),
                "continuesToNextPage": bool(ee.get("continuesToNextPage", False)),
            }
        )
    return out


def _clean_closures(data: dict, renum_start: int) -> list[dict[str, object]]:
    raw = data.get("entries", [])
    out: list[dict[str, object]] = []
    for i, c in enumerate(raw, renum_start):
        cc = c if isinstance(c, dict) else {}
        out.append(
            {
                "id": i,
                "trackId": cc.get("trackId"),
                "subTrackIndex": cc.get("subTrackIndex", 0),
                "startTime": (cc.get("startTime") or "")
                if cc.get("startTime") is not None
                else "",
                "endTime": (cc.get("endTime") or "")
                if cc.get("endTime") is not None
                else "",
                "reason": cc.get("reason", "Spår stängt") or "Spår stängt",
                "barColor": cc.get("barColor") or [],
                "continuesFromPrevPage": bool(cc.get("continuesFromPrevPage", False)),
                "continuesToNextPage": bool(cc.get("continuesToNextPage", False)),
            }
        )
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: emit_week_bundle.py <ingest-manifest.json>", file=sys.stderr)
        return 1
    manifest = Path(sys.argv[1])
    m = json.loads(manifest.read_text(encoding="utf-8"))
    builds = m.get("builds") or []
    if not builds:
        print("empty manifest", file=sys.stderr)
        return 1

    weeks: dict = defaultdict(lambda: {"trains": {}, "closures": {}})
    anchors: dict = defaultdict(dict)

    for b in builds:
        wk = b["weekKey"]
        dkey = b["dayKey"]
        y = int(b["year"])
        wn = int(b["isoWeek"])
        sch = json.loads(Path(b["scheduleJson"]).read_text(encoding="utf-8"))
        assert isinstance(sch, dict)
        clo = json.loads(Path(b["closuresJson"]).read_text(encoding="utf-8"))
        assert isinstance(clo, dict)
        weeks[wk]["trains"][dkey] = _clean_trains(sch, 1)
        weeks[wk]["closures"][dkey] = _clean_closures(clo, 1)
        anchors[wk][dkey] = _anchor_str(y, wn, dkey)

    # Build nested week -> day
    by_week: dict = {}
    by_clo: dict = {}
    for wk, payload in weeks.items():
        tmap = {d: payload["trains"].get(d, []) for d in DAY_ORDER_SORT if d in payload["trains"]}
        cmap = {d: payload["closures"].get(d, []) for d in DAY_ORDER_SORT if d in payload["closures"]}
        if tmap:
            by_week[wk] = tmap
        if cmap:
            by_clo[wk] = cmap

    # primary week for static fallback: latest ISO (year, week) string sort
    def wsort(k: str) -> tuple:
        # "2026-W18" -> 2026, 18
        p = k.split("-W", 1)
        if len(p) != 2:
            return (0, 0, k)
        return (int(p[0]), int(p[1]), k)

    sorted_wks = sorted(by_week.keys(), key=wsort, reverse=True)
    primary = sorted_wks[0] if sorted_wks else None
    # pick tuesday? pick mandag? For legacy compat use current max week's mandag or first key
    def first_day(week_k: str) -> list[dict] | list:
        t = by_week.get(week_k) or {}
        for d in DAY_ORDER_SORT:
            if t.get(d):
                return t[d]  # type: ignore[return-value]
        return []

    legacy_trains: list[dict] = first_day(primary) if primary else []
    legacy_clo: list[dict] = []
    if primary:
        c = by_clo.get(primary) or {}
        for d in DAY_ORDER_SORT:
            if c.get(d):
                legacy_clo = c[d]  # type: ignore[assignment]
                break

    from datetime import datetime  # local import for stamp

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "// Auto-generated — DO NOT EDIT MANUALLY (week bundle from ingest_incoming + emit_week_bundle)\n"
        f"// Created: {stamp}\n"
        "window.SPARPLANEN_WEEKS = "
        + json.dumps(by_week, ensure_ascii=False, indent=2)
        + ";\n"
        "window.SPARPLANEN_CLOSURES_WEEKS = "
        + json.dumps(by_clo, ensure_ascii=False, indent=2)
        + ";\n"
        "window.SPARPLANEN_ANCHORS = "
        + json.dumps(anchors, ensure_ascii=False, indent=2)
        + ";\n"
        "const initialServiceData = "
        + json.dumps(legacy_trains, ensure_ascii=False, indent=2)
        + ";\n"
        "window.initialServiceData = initialServiceData;\n"
    ]
    TRAINS_JS.write_text("".join(lines), encoding="utf-8")
    c_lines = [
        "// Auto-generated — DO NOT EDIT MANUALLY (week bundle from emit_week_bundle)\n"
        f"// Created: {stamp}\n"
        "const initialTrackClosures = "
        + json.dumps(legacy_clo, ensure_ascii=False, indent=2)
        + ";\n"
        "window.initialTrackClosures = initialTrackClosures;\n"
    ]
    CLOSURES_JS.write_text("".join(c_lines), encoding="utf-8")
    print(f"Wrote {TRAINS_JS.name} and {CLOSURES_JS.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
