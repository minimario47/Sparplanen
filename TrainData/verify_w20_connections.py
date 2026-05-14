#!/usr/bin/env python3
"""
Targeted regression checks for W20 Wednesday coupled/split train extraction.

This validates both the extractor staging JSON and the generated app bundle
(`trains.js`) for cases that have previously regressed in the UI.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "TrainData" / ".extract-staging" / "2026-W20_onsdag_schedule.json"
TRAINS_JS = ROOT / "trains.js"


def load_bundle_day() -> list[dict]:
    text = TRAINS_JS.read_text(encoding="utf-8")
    m = re.search(r"window\.SPARPLANEN_WEEKS\s*=\s*", text)
    if not m:
        raise AssertionError("SPARPLANEN_WEEKS not found in trains.js")
    decoder = json.JSONDecoder()
    payload, _ = decoder.raw_decode(text[m.end():])
    return payload["2026-W20"]["onsdag"]


def load_staging_day() -> list[dict]:
    return json.loads(STAGING.read_text(encoding="utf-8"))["entries"]


def find(entries: list[dict], arr: str = "", dep: str = "") -> list[dict]:
    return [
        e for e in entries
        if (not arr or str(e.get("arrivalTrainNumber") or "") == arr)
        and (not dep or str(e.get("departureTrainNumber") or "") == dep)
    ]


def minutes(value: str) -> int:
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def assert_cases(entries: list[dict], source: str) -> None:
    def one(arr: str = "", dep: str = "") -> dict:
        hits = find(entries, arr, dep)
        assert hits, f"{source}: missing {arr or '-'} -> {dep or '-'}"
        return hits[0]

    assert one("11098", "11161")["trainSet"]["count"] == 2, f"{source}: 11098/11161 not 2 vehicles"
    assert one("393", "398")["trainSet"]["count"] == 2, f"{source}: 393/398 not 2 vehicles"

    split_3267 = sorted(find(entries, "3267"), key=lambda e: e["subTrackIndex"])
    assert [e["departureTrainNumber"] for e in split_3267] == ["13774", "3278"], f"{source}: 3267 split wrong"
    assert [e["subTrackIndex"] for e in split_3267] == [1, 2], f"{source}: 3267 subrows wrong"

    split_11090 = sorted(find(entries, "11090"), key=lambda e: e["subTrackIndex"])
    assert len(split_11090) == 2, f"{source}: 11090 split count wrong"
    assert split_11090[0].get("departureLabel") == "D", f"{source}: 11090 D label missing"
    assert split_11090[1].get("departureTrainNumber") == "20181", f"{source}: 11090/20181 missing"

    train_175 = one("175")
    assert train_175["trainSet"]["count"] == 2, f"{source}: 175 not 2 vehicles"
    train_2090 = one("2035", "2090")
    at_1830 = minutes("18:30")
    occupied = 0
    for e in (train_175, train_2090):
        a = minutes(e["scheduledArrivalTime"])
        d = minutes(e["scheduledDepartureTime"])
        if a <= at_1830 < d:
            occupied += int(e["trainSet"]["count"])
    assert occupied == 3, f"{source}: track 6 18:30 should occupy 3 vehicles, got {occupied}"

    dep_3077 = one("", "3077")
    dep_3079 = one("", "3079")
    assert dep_3077.get("arrivalLabel") == "OGR", f"{source}: 3077 OGR label missing"
    assert dep_3079.get("arrivalLabel") == "OGR", f"{source}: 3079 OGR label missing"
    assert dep_3077["scheduledArrivalTime"] == dep_3079["scheduledArrivalTime"] == "19:00", f"{source}: 3077/3079 shared start wrong"
    assert {dep_3077["subTrackIndex"], dep_3079["subTrackIndex"]} == {2, 3}, f"{source}: 3077/3079 subrows wrong"


def main() -> int:
    assert_cases(load_staging_day(), "staging")
    assert_cases(load_bundle_day(), "bundle")
    print("W20 Wednesday connection checks passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
