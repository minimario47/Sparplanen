#!/usr/bin/env python3
"""
sample_audit.py

Pick ~50 slots (35 random + 15 targeted) and render a PNG crop of each
directly from the source PDF.  Writes an index markdown so the agent can
quickly pair each crop with the extracted row values and decide if the
extraction matches the PDF.

Inputs:
    monday_schedule.json
    monday_closures.json
    monday_audit.csv          (for bar geometry: x0/x1/y per slot id)
    Spårplaner Göteborg C, v.17 3tim.pdf Måndag.pdf

Outputs:
    audit/samples/<id>.png
    audit/samples.md
    audit/selected.json

Usage:
    python sample_audit.py
"""

from __future__ import annotations

import csv
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import pdfplumber

HERE = Path(__file__).parent
PDF = HERE / "Spårplaner Göteborg C, v.17 3tim.pdf Måndag.pdf"
SCHEDULE = HERE / "monday_schedule.json"
CLOSURES = HERE / "monday_closures.json"
AUDIT_CSV = HERE / "monday_audit.csv"
OUT_DIR = HERE / "audit" / "samples"
INDEX_MD = HERE / "audit" / "samples.md"
SELECTED_JSON = HERE / "audit" / "selected.json"

RANDOM_SEED = 20250420
TOTAL_SAMPLES = 50
RANDOM_SAMPLES = 35


@dataclass
class AuditRow:
    id: int
    page: int
    track: int
    sub: int
    x0: float
    x1: float
    y: float
    arrival_train: str
    departure_train: str
    arrival_time: str
    departure_time: str
    vehicle_count: int
    bar_color: str
    continues_from_prev: bool
    continues_to_next: bool
    stitched_from: str


def load_audit_rows() -> Dict[int, AuditRow]:
    rows: Dict[int, AuditRow] = {}
    with AUDIT_CSV.open() as f:
        r = csv.DictReader(f)
        for row in r:
            ar = AuditRow(
                id=int(row["id"]),
                page=int(row["page"]),
                track=int(row["track"]),
                sub=int(row["sub"]),
                x0=float(row["x0"]),
                x1=float(row["x1"]),
                y=float(row["y"]),
                arrival_train=row["arrival_train"],
                departure_train=row["departure_train"],
                arrival_time=row["arrival_time"],
                departure_time=row["departure_time"],
                vehicle_count=int(row["vehicle_count"]),
                bar_color=row["bar_color"],
                continues_from_prev=row["continues_from_prev"].lower() == "true",
                continues_to_next=row["continues_to_next"].lower() == "true",
                stitched_from=row["stitched_from"],
            )
            rows[ar.id] = ar
    return rows


def select_samples(rows: Dict[int, AuditRow]) -> List[int]:
    rnd = random.Random(RANDOM_SEED)
    all_ids = list(rows.keys())

    # Targeted subsets:
    page_boundary = [r.id for r in rows.values() if r.continues_from_prev or r.continues_to_next]
    coupled = [r.id for r in rows.values() if r.vehicle_count >= 2]
    no_numbers = [r.id for r in rows.values() if not r.arrival_train and not r.departure_train]

    targeted: List[int] = []
    targeted += rnd.sample(page_boundary, min(5, len(page_boundary)))
    targeted += rnd.sample(coupled, min(5, len(coupled))) if coupled else []
    targeted += rnd.sample(no_numbers, min(5, len(no_numbers)))

    # Remove duplicates while preserving order
    targeted = list(dict.fromkeys(targeted))[:15]

    remaining = [i for i in all_ids if i not in targeted]
    random_pick = rnd.sample(remaining, min(RANDOM_SAMPLES, len(remaining)))

    selected = targeted + random_pick
    return selected[:TOTAL_SAMPLES]


def render_crops(rows: Dict[int, AuditRow], selected: List[int]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with pdfplumber.open(str(PDF)) as pdf:
        for sid in selected:
            ar = rows[sid]
            page = pdf.pages[ar.page - 1]
            # Bounds in PDF coordinates; pad generously so the surrounding
            # labels for arrival / departure are visible.
            pad_x = 70
            pad_y = 18
            x0 = max(0, min(ar.x0, ar.x1) - pad_x)
            x1 = min(page.width, max(ar.x0, ar.x1) + pad_x)
            y0 = max(0, ar.y - pad_y)
            y1 = min(page.height, ar.y + pad_y)
            img = page.to_image(resolution=220)
            cropped = img.original.crop((
                x0 * 220 / 72, y0 * 220 / 72,
                x1 * 220 / 72, y1 * 220 / 72,
            ))
            out = OUT_DIR / f"slot_{sid:04d}.png"
            cropped.save(out)


def write_index(rows: Dict[int, AuditRow], selected: List[int]) -> None:
    INDEX_MD.parent.mkdir(parents=True, exist_ok=True)
    SELECTED_JSON.write_text(json.dumps(selected, indent=2))
    lines: List[str] = ["# Monday PDF sample audit\n"]
    lines.append(f"Seed {RANDOM_SEED}, {len(selected)} samples\n\n")
    lines.append("| id | page | track | sub | arr | dep | arr_t | dep_t | veh | color | cont_prev/next | crop |\n")
    lines.append("|---:|---:|---:|---:|:---:|:---:|:---:|:---:|---:|:---|:---:|:---|\n")
    for sid in selected:
        r = rows[sid]
        cont = f"{'←' if r.continues_from_prev else ''}{'→' if r.continues_to_next else ''}"
        lines.append(
            f"| {r.id} | {r.page} | {r.track} | {r.sub} | "
            f"{r.arrival_train or '–'} | {r.departure_train or '–'} | "
            f"{r.arrival_time or '–'} | {r.departure_time or '–'} | {r.vehicle_count} | "
            f"`{r.bar_color}` | {cont or '–'} | "
            f"![slot_{sid:04d}](samples/slot_{sid:04d}.png) |\n"
        )
    INDEX_MD.write_text("".join(lines), encoding="utf-8")


def main() -> None:
    rows = load_audit_rows()
    selected = select_samples(rows)
    render_crops(rows, selected)
    write_index(rows, selected)
    print(f"Wrote {len(selected)} samples to {OUT_DIR}")
    print(f"Index: {INDEX_MD}")


if __name__ == "__main__":
    main()
