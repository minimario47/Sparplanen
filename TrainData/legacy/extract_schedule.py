#!/usr/bin/env python3
"""
extract_schedule.py
Extracts train schedule data from the Spårplan PDF for Göteborg C.

Outputs:
  - extracted_schedule.json  (inspection/debugging)
  - ../trains.js             (replaces dummy data in the app)

Usage: python extract_schedule.py
Requires: pip install pdfplumber
"""

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import pdfplumber

# ── Paths ───────────────────────────────────────────────────────────────────
HERE = Path(__file__).parent
PDF = HERE / "Spårplaner Göteborg C, v.17 3tim.pdf Måndag.pdf"
OUTPUT_JSON = HERE / "extracted_schedule.json"
OUTPUT_JS = HERE.parent / "trains.js"

# ── Diagram geometry (from coordinate probe) ─────────────────────────────────
DIAGRAM_X0 = 27.7        # left edge of diagram area
DIAGRAM_X1 = 705.7       # right edge of diagram area (beyond = right-margin labels)
RIGHT_MARGIN_X = 708.0   # x threshold for right-margin continuation labels
TOP_AXIS_Y_MAX = 22.0    # time labels at top are below this y
TRACK_LABEL_X_MAX = 32.0 # track number labels on left are within this x

# Colours of the grid / background we want to skip
SKIP_FILLS = {
    (1.0, 1.0, 1.0),                        # white background
    (0.54902, 0.54902, 0.54902),             # grid lines
    (0.921569, 0.921569, 0.921569),          # light-grey stripe
    (0.811765, 0.807843, 0.760784),          # beige stripe
}

# Minimum bar width in points (very short rects are decorative)
MIN_BAR_WIDTH = 8.0
# Maximum bar height to count as a thin horizontal line
MAX_BAR_HEIGHT = 4.0
# How far (in y-points) two bars can be apart and still be considered coupled
COUPLE_Y_TOL = 18.0
# y-range to search for text near a bar
TEXT_Y_RADIUS = 14.0
# x-margin beyond bar edges to include text
TEXT_X_MARGIN = 35.0

# Non-train labels (single-occurrence strings that are NOT train numbers)
NON_TRAIN_WORDS = {
    'D', 'U', 'MVH', 'OGR', 'GSV', 'SAR', 'FEK', 'Sp0', 'NBT',
    'Trf-påverkan', 'Avst.spår', 'Avst', 'spår', 'till', 'från',
    'inkl', 'växling', 'via', 'ogr', 'CST', 'BHS', 'ÄN', 'KSC',
    'P', 'T', 'LR', 'VG', 'KB', 'Mc', 'G', 's', 'p', 'Vt', 'Sp',
    'Print', 'Gantt', 'tider', 'stn', 'Tågnr', 'Samma', 'Link',
    'kanterna', 'ank_avg', 'utan', 'tågnr', 'avg', 'spårlängder',
    'i', 'bakgrunden', 'DAGLIG', 'SPÅRANVÄNDNINGSPLAN', 'GÖTEBORG',
    'Måndag', 'Tid', 'Notering', 'Utskriven', 'datum/tid', 'fil',
    'Simulett', 'AB', 'Göteborg', 'Amanda.scn', 'v2-framåt',
}

TRAIN_NUM_RE = re.compile(r'^\d{3,6}$')
TIME_RE = re.compile(r'^(\d{1,2}):(\d{2})$')
TRACK_LABEL_RE = re.compile(r'^(\d{1,2})(\.{0,3})$')


# ── Helper functions ─────────────────────────────────────────────────────────

def calibrate_time_axis(words: list, page_num: int) -> dict:
    """
    Build a linear x→time mapping from the HH:MM labels at the top of the page.
    Returns a dict with 'slope' (min/px) and 'x_origin' (x where t=0 min).
    """
    points = []
    for w in words:
        if w['top'] > TOP_AXIS_Y_MAX:
            continue
        m = TIME_RE.match(w['text'])
        if not m:
            continue
        total_min = int(m.group(1)) * 60 + int(m.group(2))
        points.append((w['x0'], total_min))

    if len(points) < 2:
        # Fallback: uniform scale over the diagram width
        start = page_num * 180
        return {'slope': 180 / (DIAGRAM_X1 - DIAGRAM_X0),
                'x_origin': DIAGRAM_X0 - start / (180 / (DIAGRAM_X1 - DIAGRAM_X0)),
                'page_start': page_num * 180}

    points.sort()
    # Least-squares slope using first and last point
    x0, t0 = points[0]
    x1, t1 = points[-1]
    slope = (t1 - t0) / (x1 - x0)
    x_origin = x0 - t0 / slope
    return {'slope': slope, 'x_origin': x_origin, 'page_start': page_num * 180}


def x_to_hhmm(x: float, cal: dict) -> str:
    """Convert x-pixel to HH:MM string, clamped to [0, 1439]."""
    mins = round(cal['slope'] * (x - cal['x_origin']))
    mins = max(0, min(1439, mins))
    return f"{mins // 60:02d}:{mins % 60:02d}"


def x_to_min(x: float, cal: dict) -> int:
    """Convert x-pixel to integer minutes since midnight."""
    mins = round(cal['slope'] * (x - cal['x_origin']))
    return max(0, min(1439, mins))


def clamp_time(t: str, page_num: int) -> str:
    """
    If t is beyond the page's time window, return empty string.
    Bars that extend to the page edge do not have a true departure time
    on this page — the departure happens on the next page.
    """
    if not t:
        return t
    h, m = int(t[:2]), int(t[3:])
    mins = h * 60 + m
    page_end = (page_num + 1) * 180
    if mins > page_end:
        return ""   # departure is on next page
    return t


def identify_track_rows(words: list) -> list:
    """
    Find track label positions on the left margin.
    Returns list of {'track_num', 'sub_idx', 'y'} sorted by y.
    sub_idx: 0=main row (no dots), 1=one dot, 2=two dots, 3=three dots
    """
    rows = []
    seen = set()
    for w in words:
        if w['x0'] > TRACK_LABEL_X_MAX:
            continue
        m = TRACK_LABEL_RE.match(w['text'])
        if not m:
            continue
        num = int(m.group(1))
        if num < 1 or num > 16:
            continue
        dots = len(m.group(2))
        key = (num, dots)
        if key in seen:
            continue
        seen.add(key)
        y_center = (w['top'] + w['bottom']) / 2
        rows.append({'track_num': num, 'sub_idx': dots, 'y': y_center})
    return sorted(rows, key=lambda r: r['y'])


def snap_to_track(y: float, track_rows: list):
    """Find the nearest track row for y within 12 pts."""
    best, best_d = None, 12.0
    for row in track_rows:
        d = abs(row['y'] - y)
        if d < best_d:
            best_d = d
            best = row
    return best


def is_train_num(text: str) -> bool:
    return bool(TRAIN_NUM_RE.match(text)) and text not in NON_TRAIN_WORDS


def get_colored_bars(page_rects: list) -> list:
    """Extract thin coloured horizontal rectangles (train bars) from page."""
    bars = []
    for r in page_rects:
        fill = r.get('non_stroking_color')
        if fill is None or fill in SKIP_FILLS:
            continue
        if not isinstance(fill, tuple):
            continue
        # Skip near-white or near-grey fills dynamically
        if all(c > 0.85 for c in fill):
            continue

        x0, x1 = r['x0'], r['x1']
        y0, y1 = r['top'], r['bottom']
        w = x1 - x0
        h = y1 - y0

        if w < MIN_BAR_WIDTH or h > MAX_BAR_HEIGHT:
            continue
        # Must be inside diagram area (allow slight overshoot)
        if x0 < DIAGRAM_X0 - 5 or x1 > DIAGRAM_X1 + 5:
            continue

        bars.append({'x0': x0, 'x1': x1, 'y': (y0 + y1) / 2,
                     'fill': fill, '_id': id(r)})
    return bars


def group_coupled_bars(bars: list, track_rows: list) -> list:
    """
    Group bars that belong to the same train slot.
    Two bars are coupled if:
      - Same track_num
      - y-distance ≤ COUPLE_Y_TOL
      - x-ranges overlap (they are simultaneous on the track)
    Each group becomes one slot; its vehicle_count = number of bars in group.
    Returns list of slot-dicts.
    """
    # Snap every bar to a track row first
    snapped = []
    for b in bars:
        row = snap_to_track(b['y'], track_rows)
        if row:
            snapped.append({**b, 'track_num': row['track_num'],
                            'sub_idx': row['sub_idx'], 'row_y': row['y']})

    used = [False] * len(snapped)
    groups = []

    for i, b in enumerate(snapped):
        if used[i]:
            continue
        group = [b]
        used[i] = True
        for j, other in enumerate(snapped):
            if used[j] or other['track_num'] != b['track_num']:
                continue
            if abs(other['y'] - b['y']) > COUPLE_Y_TOL:
                continue
            # Check x overlap
            lo = max(b['x0'], other['x0'])
            hi = min(b['x1'], other['x1'])
            if hi > lo:  # they overlap in time
                group.append(other)
                used[j] = True
        groups.append(group)

    slots = []
    for g in groups:
        x0 = min(b['x0'] for b in g)
        x1 = max(b['x1'] for b in g)
        y  = min(b['y']  for b in g)
        tn = g[0]['track_num']
        si = g[0]['sub_idx']
        slots.append({
            'track_num': tn, 'sub_idx': si,
            'x0': x0, 'x1': x1, 'y': y,
            'vehicle_count': len(g)
        })
    return slots


def find_train_labels(slot, words, right_margin, cal):
    """
    For a slot (x0, x1, y, track_num), find arrival and departure train numbers.
    Also returns the HH:MM times derived from precise minute labels when present.

    Strategy:
      - Collect words within y ± TEXT_Y_RADIUS and x ∈ [x0-margin, x1+margin]
      - Split at midpoint: left half → candidates for arrival, right → departure
      - Pick train numbers closest to x0 (arrival) and x1 (departure)
      - If bar reaches right edge, check right_margin for departure

    Returns (arr_train, dep_train, arr_time_hhmm, dep_time_hhmm)
    """
    x0, x1 = slot['x0'], slot['x1']
    y = slot['y']
    mid = (x0 + x1) / 2.0

    nearby = [
        w for w in words
        if (y - TEXT_Y_RADIUS) <= w['top'] <= (y + TEXT_Y_RADIUS)
        and (x0 - TEXT_X_MARGIN) <= w['x0'] <= (x1 + TEXT_X_MARGIN)
        and w['x0'] >= DIAGRAM_X0 - 2   # exclude left-margin capacity labels
        and w['x0'] < RIGHT_MARGIN_X     # exclude right-margin column
    ]

    left_trains  = [w for w in nearby if w['x0'] <= mid and is_train_num(w['text'])]
    right_trains = [w for w in nearby if w['x0'] > mid  and is_train_num(w['text'])]

    arr_train = ""
    dep_train = ""

    if left_trains:
        arr_w = min(left_trains, key=lambda w: abs(w['x0'] - x0))
        arr_train = arr_w['text']

    if right_trains:
        dep_w = min(right_trains, key=lambda w: abs(w['x0'] - x1))
        dep_train = dep_w['text']

    # If bar extends to right edge → departure is in right margin
    if x1 >= DIAGRAM_X1 - 2 and not dep_train:
        for rm in right_margin:
            rm_y = (rm['top'] + rm['bottom']) / 2
            if abs(rm_y - y) <= TEXT_Y_RADIUS and is_train_num(rm['text']):
                dep_train = rm['text']
                break

    # Derive times from x-coordinates
    arr_time = x_to_hhmm(x0, cal) if arr_train else ""
    dep_time = x_to_hhmm(x1, cal) if dep_train else ""

    return arr_train, dep_train, arr_time, dep_time


def extract_page(page, page_num: int) -> list[dict]:
    """Extract all train slots from one page."""
    words = page.extract_words(extra_attrs=['size'])
    cal = calibrate_time_axis(words, page_num)
    track_rows = identify_track_rows(words)
    bars = get_colored_bars(page.rects)
    slots_raw = group_coupled_bars(bars, track_rows)

    # Right-margin labels (continuation trains shown past DIAGRAM_X1)
    right_margin = [
        w for w in words
        if w['x0'] >= RIGHT_MARGIN_X
        and w['x0'] < page.width - 50  # exclude far-right page metadata
    ]

    results = []
    for slot in slots_raw:
        arr, dep, arr_t, dep_t = find_train_labels(slot, words, right_margin, cal)
        if not arr and not dep:
            continue  # skip bars with no associated train number
        arr_t = clamp_time(arr_t, page_num)
        dep_t = clamp_time(dep_t, page_num)
        results.append({
            'track':                slot['track_num'],
            'sub_track_index':      slot['sub_idx'],
            'arrival_train':        arr,
            'departure_train':      dep,
            'arrival_time':         arr_t,
            'departure_time':       dep_t,
            'vehicle_count':        slot['vehicle_count'],
            'page':                 page_num,
            # Debug info
            '_x0': round(slot['x0'], 1),
            '_x1': round(slot['x1'], 1),
            '_y':  round(slot['y'],  1),
        })
    return results


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"Reading {PDF.name} …")
    all_slots = []

    with pdfplumber.open(str(PDF)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            slots = extract_page(page, page_num)
            h0 = page_num * 3
            h1 = h0 + 3
            print(f"  Page {page_num+1} ({h0:02d}:00–{h1:02d}:00): {len(slots)} slots")
            all_slots.extend(slots)

    print(f"\nTotal raw slots: {len(all_slots)}")

    # Build trains.js entries
    entries = []
    for i, s in enumerate(all_slots):
        entries.append({
            'id':                     i + 1,
            'trackId':                s['track'],
            'arrivalTrainNumber':     s['arrival_train'],
            'departureTrainNumber':   s['departure_train'],
            'scheduledArrivalTime':   s['arrival_time'],
            'scheduledDepartureTime': s['departure_time'],
            'origin':                 '',
            'destination':            '',
            'subTrackIndex':          s['sub_track_index'],
            'trainSet': {
                'vehicleTypeID': 'X40',
                'count':         s['vehicle_count'],
            },
        })

    # ── Write JSON for inspection ────────────────────────────────────────────
    debug_data = {
        'generated': datetime.now().isoformat(),
        'source': PDF.name,
        'count': len(entries),
        'slots': all_slots,
    }
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(debug_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote inspection JSON → {OUTPUT_JSON}")

    # ── Write trains.js ──────────────────────────────────────────────────────
    header = (
        "// Auto-generated — DO NOT EDIT MANUALLY\n"
        f"// Source : {PDF.name}\n"
        f"// Created: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
    )
    js_body = json.dumps(entries, indent=2, ensure_ascii=False)
    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write(f"const initialServiceData = {js_body};\n")
    print(f"Wrote trains.js → {OUTPUT_JS}  ({len(entries)} entries)")


if __name__ == '__main__':
    main()
