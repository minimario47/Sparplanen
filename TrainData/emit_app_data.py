#!/usr/bin/env python3
"""
emit_app_data.py
================

Converts the extractor's outputs (`monday_schedule.json` +
`monday_closures.json`) into the thin JS wrappers the web app loads at
start-up (`trains.js` + `closures.js`).

Run after `extract_monday.py`:

    python extract_monday.py
    python emit_app_data.py

Writes to the project root so no `<script>` tag in `index.html` needs to
move.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

SCHEDULE_JSON = HERE / "monday_schedule.json"
CLOSURES_JSON = HERE / "monday_closures.json"

TRAINS_JS = ROOT / "trains.js"
CLOSURES_JS = ROOT / "closures.js"


def _banner(source_name: str) -> str:
    return (
        "// Auto-generated — DO NOT EDIT MANUALLY\n"
        f"// Source : {source_name}\n"
        f"// Created: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
    )


def emit_trains() -> None:
    data = json.loads(SCHEDULE_JSON.read_text(encoding="utf-8"))
    entries = data["entries"]

    # Only keep fields the app expects.  Map bar colors to a compact list so
    # the renderer can colour the bar without re-classifying the train type.
    cleaned = []
    for i, e in enumerate(entries, 1):
        cleaned.append({
            "id": i,
            "trackId": e["trackId"],
            "arrivalTrainNumber": e["arrivalTrainNumber"] or "",
            "departureTrainNumber": e["departureTrainNumber"] or "",
            "scheduledArrivalTime": e["scheduledArrivalTime"] or "",
            "scheduledDepartureTime": e["scheduledDepartureTime"] or "",
            "origin": "",
            "destination": "",
            "subTrackIndex": e["subTrackIndex"],
            "trainSet": {
                "vehicleTypeID": "X40",
                "count": e["trainSet"]["count"],
            },
            "barColor": e.get("barColor") or [],
            "continuesFromPrevPage": e.get("continuesFromPrevPage", False),
            "continuesToNextPage": e.get("continuesToNextPage", False),
        })

    body = json.dumps(cleaned, ensure_ascii=False, indent=2)
    TRAINS_JS.write_text(
        _banner(data.get("source", "extract_monday"))
        + "\nconst initialServiceData = "
        + body
        + ";\n"
        + "window.initialServiceData = initialServiceData;\n",
        encoding="utf-8",
    )
    print(f"Wrote {TRAINS_JS.relative_to(ROOT)}  ({len(cleaned)} services)")


def emit_closures() -> None:
    data = json.loads(CLOSURES_JSON.read_text(encoding="utf-8"))
    entries = []
    for i, c in enumerate(data["entries"], 1):
        entries.append({
            "id": i,
            "trackId": c["trackId"],
            "subTrackIndex": c["subTrackIndex"],
            "startTime": c["startTime"] or "",
            "endTime": c["endTime"] or "",
            "reason": c.get("reason", "Spår stängt"),
            "barColor": c.get("barColor") or [],
            "continuesFromPrevPage": c.get("continuesFromPrevPage", False),
            "continuesToNextPage": c.get("continuesToNextPage", False),
        })

    body = json.dumps(entries, ensure_ascii=False, indent=2)
    CLOSURES_JS.write_text(
        _banner(data.get("source", "extract_monday"))
        + "\nconst initialTrackClosures = "
        + body
        + ";\n"
        # Mirror to window for easy debugging in DevTools – top-level `const`
        # does not attach to `window` automatically in browsers.
        + "window.initialTrackClosures = initialTrackClosures;\n",
        encoding="utf-8",
    )
    print(f"Wrote {CLOSURES_JS.relative_to(ROOT)}  ({len(entries)} closures)")


if __name__ == "__main__":
    emit_trains()
    emit_closures()
