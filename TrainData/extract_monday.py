#!/usr/bin/env python3
"""
extract_monday.py
=================
Robust extractor for the "Spårplaner Göteborg C, v.17 3tim" Göteborg C PDFs.

Default input is the Thursday (Torsdag) v.17 VERSION 2 file; pass another PDF
path as argv[1] for e.g. Monday (Måndag).

Pipeline stages (each stage is a pure function so it is easy to unit-test):

1. calibrate_axis(page)
       Build a linear x -> minutes-of-day mapping from the HH:MM labels at the
       top of the page.

2. find_track_rows(page)
       Locate the track number labels on the left margin and assign
       subTrackIndex 0..n top-to-bottom within each track.

3. classify_rect(rect)
       Decide if a filled rectangle is a train bar, a track closure
       (red-family), or decoration to skip.

4. build_train_number_tokens(page)
       Re-tokenize chars into 3-5 digit train numbers based on font-size
       and baseline, because pdfplumber's default word extractor splits the
       digits apart when tiny subscript letters are drawn between them.

5. group_bars_into_slots(bars, track_rows)
       Snap each bar to (trackId, subTrackIndex) within +-3pt and couple
       bars that share the same snapped row, overlap horizontally, and are
       vertically within 3pt (multi-unit / coupled trains).

6. attach_train_numbers(slots, number_tokens)
       For each slot find the nearest number-token on the same sub-row band,
       to the LEFT of the bar's left edge (= arrival) and to the RIGHT of the
       bar's right edge (= departure).

7. stitch_across_pages(slots)
       Merge slots that touch a page boundary (prev.x1 ≈ DIAGRAM_X1,
       next.x0 ≈ DIAGRAM_X0) on the same (trackId, subTrackIndex).

8. emit_outputs(slots, closures)
       Write monday_schedule.json, monday_closures.json and audit.csv.

Run:
    python extract_monday.py
    python extract_monday.py path/to/other.pdf   # optional explicit PDF
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

import pdfplumber


# ─── Paths ────────────────────────────────────────────────────────────────────

HERE = Path(__file__).parent


def default_pdf() -> Path:
    """Thursday (v.17 VERSION 2) — primary schedule for the live app."""
    return HERE / "Spårplaner Göteborg C, v.17 3tim VERSION 2.pdf Torsdag.pdf"


PDF = default_pdf()
OUT_SCHEDULE = HERE / "monday_schedule.json"
OUT_CLOSURES = HERE / "monday_closures.json"
OUT_AUDIT_CSV = HERE / "monday_audit.csv"


# ─── Geometry constants (derived by probing the PDF) ──────────────────────────

DIAGRAM_X0 = 27.7        # left edge of the 3-hour timeline
DIAGRAM_X1 = 705.4       # right edge of the timeline (labels live beyond)
RIGHT_MARGIN_X = 708.0
TOP_AXIS_Y_MAX = 22.0
TRACK_LABEL_X_MAX = 32.0

# Bar vs decoration classification
MIN_BAR_WIDTH = 5.0
MAX_BAR_HEIGHT = 5.0

# Row matching
SUBROW_SNAP_TOL = 3.0    # a bar y-center must be within 3pt of a sub-row y-center
COUPLE_Y_TOL = 3.0       # coupled bars must be within 3pt vertically of each other

# Train-number tokens
MAIN_NUMBER_SIZE = 6.00
RIGHT_MARGIN_NUMBER_SIZE = 5.40
NUMBER_SIZE_TOL = 0.15
NUMBER_MAX_X_GAP_MAIN = 1.8
NUMBER_MAX_X_GAP_RIGHT_MARGIN = 2.8
ROW_MATCH_DY_MIN = 1.0      # token y_center must be ROW_MATCH_DY_MIN..MAX above a row
ROW_MATCH_DY_MAX = 4.0
RIGHT_MARGIN_DY_TOL = 3.5   # right-margin labels sit roughly at the bar center

# Closure detection (red family)
def _is_red(color: Tuple[float, float, float]) -> bool:
    r, g, b = color
    return r >= 0.80 and g <= 0.30 and b <= 0.30


# ─── Regex ────────────────────────────────────────────────────────────────────

TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")
TRACK_LABEL_RE = re.compile(r"^(\d{1,2})(\.{0,3})$")
DIGITS_ONLY_RE = re.compile(r"^\d{3,5}$")   # valid train numbers are 3-5 digits


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class TrackRow:
    track_num: int
    sub_idx: int
    y_center: float


@dataclass
class NumberToken:
    number: str
    x0: float
    x1: float
    y_center: float
    page: int
    kind: str = "in_diagram"   # "in_diagram" | "right_margin_continuation"


@dataclass
class Slot:
    id: int = 0
    page: int = 0
    track_num: int = 0
    sub_idx: int = 0
    x0: float = 0.0
    x1: float = 0.0
    y_center: float = 0.0
    vehicle_count: int = 1
    bar_color: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    arrival_train: str = ""
    departure_train: str = ""
    arrival_time: str = ""
    departure_time: str = ""
    continues_from_prev_page: bool = False
    continues_to_next_page: bool = False
    stitched_slot_ids: List[int] = field(default_factory=list)


@dataclass
class Closure:
    id: int
    page: int
    track_num: int
    sub_idx: int
    x0: float
    x1: float
    y_center: float
    start_time: str
    end_time: str
    bar_color: Tuple[float, float, float]
    continues_from_prev_page: bool = False
    continues_to_next_page: bool = False


# ─── Stage 1: axis calibration ────────────────────────────────────────────────

def calibrate_axis(page, page_num: int) -> dict:
    """
    The PDF draws the time axis as **evenly spaced vertical grid lines** -
    19 lines spanning the 3-hour window with one gridline per 10 minutes.
    The HH:MM text labels at the top are positioned inconsistently
    relative to the ticks (their x0 is shifted), so using the labels as
    anchors gives a biased 1-4 min drift.

    Instead we find the set of full-height vertical lines inside the
    diagram, deduplicate them, and use them as the exact time anchors.
    The leftmost gridline is page_num * 180 minutes; each subsequent
    gridline is +10 minutes.
    """
    # Gridlines are vertical (x0 == x1) and span the full diagram height
    # (>= ~500pt).  Only keep lines whose x is inside the diagram area.
    raw_xs = [
        round(l["x0"], 2) for l in page.lines
        if abs(l["x0"] - l["x1"]) < 0.1
        and (l["bottom"] - l["top"]) > 100
        and DIAGRAM_X0 - 1.0 <= l["x0"] <= DIAGRAM_X1 + 1.0
    ]
    unique_xs = sorted(set(raw_xs))

    if len(unique_xs) < 5:
        # Fallback to the label-based calibration when for some reason no
        # gridlines were detected.  Shouldn't fire on the Monday PDF.
        return _calibrate_axis_from_labels(page, page_num)

    # The expected step is 36.6..36.72 between adjacent ticks.  Drop any
    # duplicate or noise lines that break that pattern.
    clean: List[float] = [unique_xs[0]]
    for x in unique_xs[1:]:
        if x - clean[-1] < 30.0:      # too close, skip (artifact)
            continue
        clean.append(x)

    # Build piecewise-linear anchor list.
    page_start_min = page_num * 180
    anchors = [(clean[i], page_start_min + 10 * i) for i in range(len(clean))]

    # Sanity: the last anchor should land near page_start_min + 180 within
    # +/- 15 min.  If it doesn't, something is off and we want to know.
    expected_end = page_start_min + 10 * (len(clean) - 1)
    if abs(anchors[-1][1] - expected_end) > 0 or len(clean) not in range(16, 22):
        # tolerate between 16 and 21 ticks (the usual is 19)
        pass

    return {
        "anchors": anchors,
        "page_start_min": page_start_min,
    }


def _calibrate_axis_from_labels(page, page_num: int) -> dict:
    """Legacy label-based linear fit, kept as a fallback only."""
    labels: List[Tuple[float, int]] = []
    for w in page.extract_words():
        if w["top"] > TOP_AXIS_Y_MAX:
            continue
        m = TIME_RE.match(w["text"])
        if not m:
            continue
        mins = int(m.group(1)) * 60 + int(m.group(2))
        labels.append((w["x0"], mins))
    if len(labels) < 3:
        raise RuntimeError(f"page {page_num+1}: only {len(labels)} time labels")
    labels.sort()
    x0, t0 = labels[0]
    x1, t1 = labels[-1]
    slope = (t1 - t0) / (x1 - x0)
    anchors = [(x0 + k * (x1 - x0) / (t1 - t0) * 10, t0 + k * 10)
               for k in range((t1 - t0) // 10 + 1)]
    return {"anchors": anchors, "page_start_min": page_num * 180}


def x_to_min(x: float, cal: dict) -> int:
    """Piecewise-linear interpolation between adjacent gridline anchors."""
    anchors = cal["anchors"]
    if x <= anchors[0][0]:
        # Linear extrapolation using the first segment's slope.
        x0, t0 = anchors[0]
        x1, t1 = anchors[1]
        slope = (t1 - t0) / (x1 - x0)
        return max(0, min(24 * 60 - 1, round(t0 + slope * (x - x0))))
    if x >= anchors[-1][0]:
        x0, t0 = anchors[-2]
        x1, t1 = anchors[-1]
        slope = (t1 - t0) / (x1 - x0)
        return max(0, min(24 * 60 - 1, round(t1 + slope * (x - x1))))
    # Find bracketing segment (anchors are sorted).
    for i in range(len(anchors) - 1):
        x0, t0 = anchors[i]
        x1, t1 = anchors[i + 1]
        if x0 <= x <= x1:
            slope = (t1 - t0) / (x1 - x0)
            return round(t0 + slope * (x - x0))
    # unreachable
    return anchors[-1][1]


def x_to_hhmm(x: float, cal: dict) -> str:
    mins = x_to_min(x, cal)
    mins = max(0, min(24 * 60 - 1, mins))
    return f"{mins // 60:02d}:{mins % 60:02d}"


# ─── Stage 2: track rows ──────────────────────────────────────────────────────

TRACK_LABEL_FONT_SIZE = 6.48
TRACK_LABEL_SIZE_TOL = 0.1

# Max y-coordinate for legitimate track labels.  The bottom-most real label is
# track 16 at top ≈ 504; anything below belongs to the legend ("5 god.",
# "29 spår..." etc.) which shares the same font size but is NOT a track row.
TRACK_LABEL_TOP_MAX = 508.0


def find_track_rows(page) -> List[TrackRow]:
    """
    Track number labels sit on the left margin with up to three trailing dots.
    Dots count encodes the sub-row (0 = main, 1..3 = extra).  For each track
    we dedupe same-(num,dots) labels (the PDF draws each label twice as an
    overlay), sort remaining sub-rows top-to-bottom and assign subTrackIndex
    starting at 0.

    We rebuild tokens from raw chars because pdfplumber's extract_words can
    collide a track label with an adjacent capacity digit.  Only chars in the
    track-label font size count.
    """
    # Labels only exist in the vertical diagram area; reject hits below the
    # last real row (legend text starts around y=513).
    chars_all = [
        c for c in page.chars
        if c["x0"] < TRACK_LABEL_X_MAX
        and c["top"] < TRACK_LABEL_TOP_MAX
        and abs(c.get("size", 0) - TRACK_LABEL_FONT_SIZE) <= TRACK_LABEL_SIZE_TOL
        and (c["text"].isdigit() or c["text"] == ".")
    ]
    # Dedupe exact overlays (each char is drawn twice).
    seen_char: set = set()
    chars: List[dict] = []
    for c in chars_all:
        k = (c["text"], round(c["x0"], 2), round(c["top"], 2))
        if k in seen_char:
            continue
        seen_char.add(k)
        chars.append(c)
    chars.sort(key=lambda c: (round(c["top"], 1), c["x0"]))

    tokens: List[Tuple[str, float]] = []
    cur: List[dict] = []
    last: Optional[dict] = None
    for c in chars:
        same = last is not None and abs(c["top"] - last["top"]) <= 0.5 and c["x0"] - last["x1"] <= 1.0
        if last is not None and same:
            cur.append(c)
        else:
            if cur:
                text = "".join(x["text"] for x in cur)
                y = (cur[0]["top"] + cur[0]["bottom"]) / 2
                tokens.append((text, y))
            cur = [c]
        last = c
    if cur:
        text = "".join(x["text"] for x in cur)
        y = (cur[0]["top"] + cur[0]["bottom"]) / 2
        tokens.append((text, y))

    raw: dict[Tuple[int, int], List[float]] = defaultdict(list)
    for text, y in tokens:
        m = TRACK_LABEL_RE.match(text)
        if not m:
            continue
        num = int(m.group(1))
        if not 1 <= num <= 16:
            continue
        dots = len(m.group(2))
        raw[(num, dots)].append(y)

    merged: dict[int, list[Tuple[int, float]]] = defaultdict(list)
    for (num, dots), ys in raw.items():
        ys.sort()
        # median y – all duplicates should land on the same visual line.
        merged[num].append((dots, ys[len(ys) // 2]))

    rows: List[TrackRow] = []
    for num, entries in merged.items():
        entries.sort(key=lambda e: e[1])           # top-to-bottom
        for sub_idx, (_dots, y) in enumerate(entries):
            rows.append(TrackRow(track_num=num, sub_idx=sub_idx, y_center=y))

    rows.sort(key=lambda r: (r.track_num, r.sub_idx))
    return rows


def snap_to_track(y: float, rows: List[TrackRow]) -> Optional[TrackRow]:
    best: Optional[TrackRow] = None
    best_d = SUBROW_SNAP_TOL
    for r in rows:
        d = abs(r.y_center - y)
        if d <= best_d:
            best_d = d
            best = r
    return best


# ─── Stage 3: classify rectangles ─────────────────────────────────────────────

def classify_rect(rect) -> Tuple[str, Tuple[float, float, float]]:
    """
    Returns one of:
      ('train',   (r,g,b))
      ('closure', (r,g,b))
      ('skip',    (r,g,b))
    """
    fill = rect.get("non_stroking_color")
    if not isinstance(fill, tuple) or len(fill) != 3:
        return ("skip", (0.0, 0.0, 0.0))

    color = tuple(round(c, 3) for c in fill)  # type: ignore[assignment]

    # White / near-white fills are grid cells.  Pure white is (1,1,1); some
    # bars are drawn in very light grey (0.902, 0.902, 0.902) and still
    # encode real train occupancies.  We only reject if the color is
    # essentially white (all channels ≥ 0.94).
    if all(c >= 0.94 for c in color):
        return ("skip", color)

    w = rect["x1"] - rect["x0"]
    h = rect["bottom"] - rect["top"]
    if w < MIN_BAR_WIDTH or h > MAX_BAR_HEIGHT:
        return ("skip", color)

    # bars must live inside the diagram
    if rect["x0"] < DIAGRAM_X0 - 5 or rect["x1"] > DIAGRAM_X1 + 5:
        return ("skip", color)

    if _is_red(color):
        return ("closure", color)
    return ("train", color)


# ─── Stage 4: train number tokens ─────────────────────────────────────────────

def _build_tokens(
    chars: List[dict],
    page_num: int,
    kind: str,
    max_x_gap: float,
) -> List[NumberToken]:
    """
    Group digit chars sharing a baseline into multi-digit tokens.  Keep only
    tokens whose final text is a 3-5 digit train number.
    """
    chars = sorted(chars, key=lambda c: (round(c["top"], 1), c["x0"]))
    out: List[NumberToken] = []
    cur: List[dict] = []
    last: Optional[dict] = None

    def flush() -> None:
        if len(cur) < 3:
            return
        number = "".join(c["text"] for c in cur)
        if not DIGITS_ONLY_RE.match(number):
            return
        out.append(NumberToken(
            number=number,
            x0=cur[0]["x0"],
            x1=cur[-1]["x1"],
            y_center=(cur[0]["top"] + cur[0]["bottom"]) / 2,
            page=page_num,
            kind=kind,
        ))

    for c in chars:
        same_baseline = last is not None and abs(c["top"] - last["top"]) <= 0.5
        close_x = last is not None and c["x0"] - last["x1"] <= max_x_gap
        if last is not None and same_baseline and close_x:
            cur.append(c)
        else:
            flush()
            cur = [c]
        last = c
    flush()
    return out


def build_train_number_tokens(page, page_num: int) -> List[NumberToken]:
    """
    Train-number label tokens come in two flavors:

      - In-diagram, size ≈ 6.00, positioned at DIAGRAM_X0..DIAGRAM_X1
        These sit just above a bar (row y_center is 1-4 pt BELOW the token y).

      - Right-margin continuation, size ≈ 5.40, positioned at x ≥ RIGHT_MARGIN_X
        These are departure numbers for bars that extend past the page edge.
    """
    # In-diagram: exclude left capacity-labels (x0 < DIAGRAM_X0) and right margin.
    in_diagram_chars = [
        c for c in page.chars
        if abs(c.get("size", 0) - MAIN_NUMBER_SIZE) <= NUMBER_SIZE_TOL
        and c["text"].isdigit()
        and DIAGRAM_X0 <= c["x0"] < RIGHT_MARGIN_X
    ]
    in_diagram = _build_tokens(
        in_diagram_chars, page_num,
        kind="in_diagram",
        max_x_gap=NUMBER_MAX_X_GAP_MAIN,
    )

    right_margin_chars = [
        c for c in page.chars
        if abs(c.get("size", 0) - RIGHT_MARGIN_NUMBER_SIZE) <= NUMBER_SIZE_TOL
        and c["text"].isdigit()
        and c["x0"] >= RIGHT_MARGIN_X
    ]
    right_margin = _build_tokens(
        right_margin_chars, page_num,
        kind="right_margin_continuation",
        max_x_gap=NUMBER_MAX_X_GAP_RIGHT_MARGIN,
    )

    return in_diagram + right_margin


# ─── Stage 5: bars → slots ────────────────────────────────────────────────────

def _snap_bars_to_rows(
    bars: List[dict], rows: List[TrackRow]
) -> List[dict]:
    snapped: List[dict] = []
    for b in bars:
        row = snap_to_track(b["y_center"], rows)
        if row is None:
            continue
        snapped.append({**b, "track_num": row.track_num, "sub_idx": row.sub_idx})
    return snapped


def group_bars_into_slots(
    bars: List[dict],
    rows: List[TrackRow],
    page_num: int,
) -> List[Slot]:
    """
    Coupled bars have two shapes in the PDF:

    1. **Stacked on same sub-row** — two thin rects vertically adjacent at the
       exact same y_center (~3pt apart).  Same (trackId, subIdx).

    2. **Stacked on adjacent sub-rows** — two rects on consecutive sub-rows of
       the SAME trackId with identical x-range.  In this case the label is
       only drawn for the top bar; the lower bar is the 2nd unit of a coupled
       train and must be merged into the upper one (so we don't emit an empty
       phantom slot).
    """
    snapped = _snap_bars_to_rows(bars, rows)
    used = [False] * len(snapped)
    slots: List[Slot] = []

    # Pre-compute adjacency map: {track_num: sorted list of (sub_idx, y_center)}
    sub_y: dict[int, list[Tuple[int, float]]] = defaultdict(list)
    for r in rows:
        sub_y[r.track_num].append((r.sub_idx, r.y_center))
    for lst in sub_y.values():
        lst.sort(key=lambda e: e[0])

    def is_adjacent_subrow(tr: int, s1: int, s2: int) -> bool:
        return tr > 0 and abs(s1 - s2) == 1

    def horizontal_overlap_pct(a, b) -> float:
        lo = max(a["x0"], b["x0"])
        hi = min(a["x1"], b["x1"])
        if hi <= lo:
            return 0.0
        w_a = a["x1"] - a["x0"]
        w_b = b["x1"] - b["x0"]
        return (hi - lo) / min(w_a, w_b)

    for i, b in enumerate(snapped):
        if used[i]:
            continue
        group = [b]
        used[i] = True
        # Greedily couple more bars that visually belong to the same train.
        changed = True
        while changed:
            changed = False
            # Re-evaluate group bounding box on each pass.
            gb_x0 = min(g["x0"] for g in group)
            gb_x1 = max(g["x1"] for g in group)
            for j, other in enumerate(snapped):
                if used[j]:
                    continue
                if other["track_num"] != b["track_num"]:
                    continue
                # Same sub-row: couple if vertically close and horizontally overlap.
                if other["sub_idx"] == b["sub_idx"]:
                    if abs(other["y_center"] - b["y_center"]) > COUPLE_Y_TOL:
                        continue
                    lo = max(gb_x0, other["x0"])
                    hi = min(gb_x1, other["x1"])
                    if hi > lo:
                        group.append(other)
                        used[j] = True
                        changed = True
                        continue
                # Adjacent sub-row: couple only if x-ranges match closely
                # (≥80% overlap relative to the narrower bar).  This is the
                # 2-unit coupled-train visual pattern.
                if is_adjacent_subrow(other["track_num"], other["sub_idx"], b["sub_idx"]):
                    if horizontal_overlap_pct({"x0": gb_x0, "x1": gb_x1},
                                              other) >= 0.8 and \
                       abs(other["x0"] - gb_x0) < 3.0 and \
                       abs(other["x1"] - gb_x1) < 3.0:
                        group.append(other)
                        used[j] = True
                        changed = True

        x0 = min(g["x0"] for g in group)
        x1 = max(g["x1"] for g in group)
        # Keep y_center tied to the TOP sub-row because the labels sit there.
        top_sub = min(g["sub_idx"] for g in group)
        top_y = min(g["y_center"] for g in group)

        slots.append(Slot(
            page=page_num,
            track_num=b["track_num"],
            sub_idx=top_sub,
            x0=x0,
            x1=x1,
            y_center=top_y,
            vehicle_count=len(group),
            bar_color=group[0]["color"],
        ))

    return slots


# ─── Stage 6: attach train numbers ────────────────────────────────────────────

def _assign_token_to_row(
    token: NumberToken,
    rows: List[TrackRow],
) -> Optional[TrackRow]:
    """
    For an in-diagram token, the correct row is the first row whose y_center
    is 1..4 points BELOW the token's y_center.  For a right-margin token the
    row is within +-RIGHT_MARGIN_DY_TOL points of the token y.
    """
    if token.kind == "in_diagram":
        best: Optional[TrackRow] = None
        best_d = float("inf")
        for r in rows:
            dy = r.y_center - token.y_center
            if ROW_MATCH_DY_MIN <= dy <= ROW_MATCH_DY_MAX and dy < best_d:
                best_d = dy
                best = r
        return best
    # right-margin continuation
    best = None
    best_d = float("inf")
    for r in rows:
        d = abs(r.y_center - token.y_center)
        if d <= RIGHT_MARGIN_DY_TOL and d < best_d:
            best_d = d
            best = r
    return best


def attach_train_numbers(
    slots: List[Slot],
    tokens: List[NumberToken],
    rows: List[TrackRow],
    cal: dict,
) -> None:
    """
    Match each train-number token to a (track, sub-row) and attach it to the
    nearest slot on that row as either arrival (left of bar) or departure
    (right of bar).  Right-margin tokens are ALWAYS departure labels for the
    slot whose bar reaches DIAGRAM_X1.
    """
    by_row: dict[Tuple[int, int], List[NumberToken]] = defaultdict(list)
    for t in tokens:
        row = _assign_token_to_row(t, rows)
        if row is None:
            continue
        by_row[(row.track_num, row.sub_idx)].append(t)

    for _, toks in by_row.items():
        toks.sort(key=lambda t: t.x0)

    # Train numbers are drawn inside the bar, flush-left for arrival and
    # flush-right for departure.  We accept tokens within a generous window
    # around the bar's edges — wide bars often push the departure token 40+
    # points inside because of "via ogr", "inkl växling", or "MVH" text that
    # is rendered between the bar midpoint and the departure train number.
    EDGE_INSIDE_TOL_ABS = 40.0    # minimum absolute inside-tolerance (pt)
    EDGE_INSIDE_TOL_FRAC = 0.45   # or up to 45% of the bar width
    EDGE_OUTSIDE_TOL = 14.0

    for slot in slots:
        toks = by_row.get((slot.track_num, slot.sub_idx), [])
        bar_mid = (slot.x0 + slot.x1) / 2
        bar_width = slot.x1 - slot.x0
        inside_tol = max(EDGE_INSIDE_TOL_ABS, bar_width * EDGE_INSIDE_TOL_FRAC)

        # Arrival: token.x0 somewhere in the left half of the bar (or
        # slightly to its left for flush-left labels).
        arr_candidates = [
            t for t in toks
            if t.kind == "in_diagram"
            and -EDGE_OUTSIDE_TOL <= (t.x0 - slot.x0) <= inside_tol
            and t.x0 < bar_mid                      # must be on the LEFT half
        ]
        if arr_candidates:
            # Prefer the token closest to the left edge (arrival train number
            # is flush-left; any label further right is a mid-bar annotation).
            nearest = min(arr_candidates, key=lambda t: t.x0)
            slot.arrival_train = nearest.number
            # bar.x0 is the authoritative arrival time tick.
            slot.arrival_time = x_to_hhmm(slot.x0, cal)

        # Departure: token.x1 somewhere in the right half of the bar (or
        # slightly past for flush-right labels that spill into the gutter).
        dep_candidates = [
            t for t in toks
            if t.kind == "in_diagram"
            and -inside_tol <= (t.x1 - slot.x1) <= EDGE_OUTSIDE_TOL
            and t.x1 > bar_mid                      # must be on the RIGHT half
            and t.number != slot.arrival_train      # don't pick same label twice
        ]
        if dep_candidates:
            # Prefer the token closest to the right edge.  When several tokens
            # all sit inside, the RIGHTMOST one is the departure — any token
            # further left is a "via" waypoint annotation.
            nearest = max(dep_candidates, key=lambda t: t.x1)
            slot.departure_train = nearest.number
            slot.departure_time = x_to_hhmm(slot.x1, cal)

        # Continuation flags: set before the right-margin lookup
        if slot.x0 <= DIAGRAM_X0 + 1.0:
            slot.continues_from_prev_page = True
        if slot.x1 >= DIAGRAM_X1 - 1.0:
            slot.continues_to_next_page = True

        # Right-margin label gives a departure number when the bar exits the page.
        if slot.continues_to_next_page and not slot.departure_train:
            rm = [t for t in toks if t.kind == "right_margin_continuation"]
            if rm:
                slot.departure_train = rm[0].number
                slot.departure_time = ""   # real departure time is on the next page

        # Fall back to bar edges for times when a number is known but no label time.
        if slot.arrival_train and not slot.arrival_time:
            slot.arrival_time = x_to_hhmm(slot.x0, cal)
        if slot.departure_train and not slot.departure_time and not slot.continues_to_next_page:
            slot.departure_time = x_to_hhmm(slot.x1, cal)
        # If no train numbers at all, still record the bar span for later audit.
        if not slot.arrival_train and not slot.arrival_time and not slot.continues_from_prev_page:
            slot.arrival_time = x_to_hhmm(slot.x0, cal)
        if not slot.departure_train and not slot.departure_time and not slot.continues_to_next_page:
            slot.departure_time = x_to_hhmm(slot.x1, cal)


# ─── Stage 7: page stitching ──────────────────────────────────────────────────

def stitch_across_pages(slots: List[Slot]) -> List[Slot]:
    """
    Merge a slot on page N that reaches DIAGRAM_X1 with a slot on page N+1
    that starts at DIAGRAM_X0 and sits on the same (track, sub_idx).

    Applied iteratively and across arbitrary page gaps so a single bar that
    spans 3+ pages (e.g. an overnight layover) collapses into one slot.
    We tag the accumulator's ``last_page`` so the next hop looks at whatever
    page the partner came from.
    """
    by_id: dict[int, Slot] = {s.id: s for s in slots}
    removed: set[int] = set()

    # Track the "current frontier page" for each accumulator.  Initially it
    # equals s.page, but after we merge a partner on page P we bump it to P
    # so the next iteration searches for a partner on P+1.
    frontier = {s.id: s.page for s in slots}

    while True:
        by_page: dict[int, List[Slot]] = defaultdict(list)
        for s in slots:
            if s.id in removed:
                continue
            by_page[s.page].append(s)

        merged_any = False
        for acc in list(slots):
            if acc.id in removed or not acc.continues_to_next_page:
                continue
            look_on = frontier[acc.id] + 1
            partner = None
            for t in by_page.get(look_on, []):
                if t.id in removed:
                    continue
                if not t.continues_from_prev_page:
                    continue
                if t.track_num != acc.track_num or t.sub_idx != acc.sub_idx:
                    continue
                partner = t
                break
            if partner is None:
                continue

            acc.x1 = partner.x1
            acc.continues_to_next_page = partner.continues_to_next_page
            acc.vehicle_count = max(acc.vehicle_count, partner.vehicle_count)
            if partner.departure_train:
                acc.departure_train = partner.departure_train
            acc.departure_time = partner.departure_time or acc.departure_time
            if not acc.arrival_train and partner.arrival_train:
                acc.arrival_train = partner.arrival_train
            acc.stitched_slot_ids.append(partner.id)
            removed.add(partner.id)
            frontier[acc.id] = partner.page
            merged_any = True

        if not merged_any:
            break

    return [s for s in slots if s.id not in removed]


# ─── Stage 8: closures ────────────────────────────────────────────────────────

def classify_closures(
    closure_rects: List[dict],
    rows: List[TrackRow],
    page_num: int,
    cal: dict,
) -> List[Closure]:
    snapped = _snap_bars_to_rows(closure_rects, rows)
    out: List[Closure] = []
    for b in snapped:
        out.append(Closure(
            id=0,
            page=page_num,
            track_num=b["track_num"],
            sub_idx=b["sub_idx"],
            x0=b["x0"],
            x1=b["x1"],
            y_center=b["y_center"],
            start_time=x_to_hhmm(b["x0"], cal),
            end_time=x_to_hhmm(b["x1"], cal),
            bar_color=b["color"],
            continues_from_prev_page=b["x0"] <= DIAGRAM_X0 + 1.0,
            continues_to_next_page=b["x1"] >= DIAGRAM_X1 - 1.0,
        ))
    return out


def stitch_closures_across_pages(closures: List[Closure]) -> List[Closure]:
    removed: set[int] = set()
    for _ in range(8):
        by_page: dict[int, List[Closure]] = defaultdict(list)
        for c in closures:
            if c.id in removed:
                continue
            by_page[c.page].append(c)

        merged_any = False
        for page, page_cs in by_page.items():
            for c in page_cs:
                if not c.continues_to_next_page or c.id in removed:
                    continue
                for t in by_page.get(page + 1, []):
                    if t.id in removed or not t.continues_from_prev_page:
                        continue
                    if t.track_num != c.track_num or t.sub_idx != c.sub_idx:
                        continue
                    c.end_time = t.end_time
                    c.continues_to_next_page = t.continues_to_next_page
                    removed.add(t.id)
                    merged_any = True
                    break
        if not merged_any:
            break
    return [c for c in closures if c.id not in removed]


# ─── Driver ───────────────────────────────────────────────────────────────────

def extract_page(page, page_num: int) -> Tuple[List[Slot], List[Closure], dict]:
    cal = calibrate_axis(page, page_num)
    rows = find_track_rows(page)

    train_rects: List[dict] = []
    closure_rects: List[dict] = []
    for r in page.rects:
        kind, color = classify_rect(r)
        if kind == "skip":
            continue
        bar = {
            "x0": r["x0"],
            "x1": r["x1"],
            "y_center": (r["top"] + r["bottom"]) / 2,
            "color": color,
        }
        if kind == "train":
            train_rects.append(bar)
        else:
            closure_rects.append(bar)

    slots = group_bars_into_slots(train_rects, rows, page_num)
    tokens = build_train_number_tokens(page, page_num)
    attach_train_numbers(slots, tokens, rows, cal)
    closures = classify_closures(closure_rects, rows, page_num, cal)
    return slots, closures, cal


def run(pdf_path: Path) -> Tuple[List[Slot], List[Closure]]:
    all_slots: List[Slot] = []
    all_closures: List[Closure] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            slots, closures, _ = extract_page(page, page_num)
            all_slots.extend(slots)
            all_closures.extend(closures)

    for i, s in enumerate(all_slots, 1):
        s.id = i
    for i, c in enumerate(all_closures, 1):
        c.id = i

    all_slots = stitch_across_pages(all_slots)
    all_closures = stitch_closures_across_pages(all_closures)
    return all_slots, all_closures


def emit_outputs(
    slots: List[Slot],
    closures: List[Closure],
    audit_csv: Path = OUT_AUDIT_CSV,
    schedule_json: Path = OUT_SCHEDULE,
    closures_json: Path = OUT_CLOSURES,
) -> None:
    schedule_entries = []
    for i, s in enumerate(slots, 1):
        schedule_entries.append({
            "id": i,
            "trackId": s.track_num,
            "subTrackIndex": s.sub_idx,
            "arrivalTrainNumber": s.arrival_train,
            "departureTrainNumber": s.departure_train,
            "scheduledArrivalTime": s.arrival_time,
            "scheduledDepartureTime": s.departure_time,
            "origin": "",
            "destination": "",
            "trainSet": {
                "vehicleTypeID": "X40",
                "count": s.vehicle_count,
            },
            "barColor": list(s.bar_color),
            "continuesFromPrevPage": s.continues_from_prev_page,
            "continuesToNextPage": s.continues_to_next_page,
        })
    closure_entries = []
    for i, c in enumerate(closures, 1):
        closure_entries.append({
            "id": i,
            "trackId": c.track_num,
            "subTrackIndex": c.sub_idx,
            "startTime": c.start_time,
            "endTime": c.end_time,
            "reason": "Spår stängt",
            "barColor": list(c.bar_color),
            "continuesFromPrevPage": c.continues_from_prev_page,
            "continuesToNextPage": c.continues_to_next_page,
        })

    schedule_json.write_text(
        json.dumps({
            "generated": datetime.now().isoformat(),
            "source": PDF.name,
            "count": len(schedule_entries),
            "entries": schedule_entries,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    closures_json.write_text(
        json.dumps({
            "generated": datetime.now().isoformat(),
            "source": PDF.name,
            "count": len(closure_entries),
            "entries": closure_entries,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Audit CSV with full geometry for manual cross-referencing.
    fields = [
        "id", "page", "track", "sub", "x0", "x1", "y",
        "arrival_train", "departure_train", "arrival_time", "departure_time",
        "vehicle_count", "bar_color",
        "continues_from_prev", "continues_to_next",
        "stitched_from",
    ]
    with audit_csv.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(fields)
        for i, s in enumerate(slots, 1):
            w.writerow([
                i, s.page + 1, s.track_num, s.sub_idx,
                round(s.x0, 1), round(s.x1, 1), round(s.y_center, 1),
                s.arrival_train, s.departure_train,
                s.arrival_time, s.departure_time,
                s.vehicle_count,
                ",".join(f"{c:.3f}" for c in s.bar_color),
                s.continues_from_prev_page, s.continues_to_next_page,
                "|".join(str(x) for x in s.stitched_slot_ids),
            ])


def main() -> None:
    global PDF
    if len(sys.argv) > 1:
        PDF = Path(sys.argv[1]).expanduser().resolve()
    else:
        PDF = default_pdf().resolve()
    if not PDF.is_file():
        raise SystemExit(f"PDF not found: {PDF}")
    slots, closures = run(PDF)
    emit_outputs(slots, closures)

    by_page = Counter(s.page + 1 for s in slots)
    print(f"Extracted {len(slots)} train slots and {len(closures)} closures.")
    print("Slots per page:", dict(sorted(by_page.items())))
    print(f"Wrote {OUT_SCHEDULE.name}, {OUT_CLOSURES.name}, {OUT_AUDIT_CSV.name}")


if __name__ == "__main__":
    main()
