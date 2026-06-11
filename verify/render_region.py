#!/usr/bin/env python3
"""
Render an INDEPENDENT ground-truth crop of a PDF region.

Renders one 3-hour PDF page (full width, so the PDF's own printed time axis and
left-margin track numbers stay visible) cropped vertically to a band of tracks,
at high DPI. The image is raw PDF pixels — no parser-derived overlays — so what I
read is independent of extract_monday.py (only the *crop box* is chosen via the
parser's track-row detection, which can't bias the bar values I read).

Usage:
  python3 verify/render_region.py <week> <day> --page P --tracks 9-13
  python3 verify/render_region.py <week> <day> --time 23:50 --track 11
  python3 verify/render_region.py 2026-W24 torsdag --time 23:50 --track 11
Prints the output PNG path.
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "TrainData"))

import pdfplumber  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from extract_monday import find_track_rows  # noqa: E402

AXIS_TOP_PT = 0.0     # include the printed HH:MM axis header
AXIS_BOTTOM_PT = 24.0
BAND_PAD_PT = 13.0    # vertical padding around the requested track band
DEFAULT_DPI = 220


def page_for_time(hhmm: str) -> int:
    h, m = (int(x) for x in hhmm.split(":"))
    return max(0, min(7, (h * 60 + m) // 180))


def parse_tracks(spec: str):
    if "-" in spec:
        lo, hi = spec.split("-")
        return int(lo), int(hi)
    t = int(spec)
    return t, t


def band_for_tracks(page, t_lo: int, t_hi: int):
    rows = find_track_rows(page)
    ys = [r.y_center for r in rows if t_lo <= r.track_num <= t_hi]
    if not ys:
        # Fallback: whole diagram height.
        return AXIS_BOTTOM_PT, float(page.height)
    return min(ys) - BAND_PAD_PT, max(ys) + BAND_PAD_PT


def render(week: str, day: str, page_idx: int, t_lo: int, t_hi: int, dpi: int, out: Path) -> Path:
    pdf_path = ROOT / "TrainData" / "incoming" / week / f"{day}.pdf"
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    scale = dpi / 72.0
    with pdfplumber.open(str(pdf_path)) as pdf:
        if page_idx >= len(pdf.pages):
            raise SystemExit(f"page {page_idx} out of range (pages={len(pdf.pages)})")
        page = pdf.pages[page_idx]
        band_top, band_bot = band_for_tracks(page, t_lo, t_hi)
        band_top = max(AXIS_BOTTOM_PT, band_top)
        band_bot = min(float(page.height), band_bot)

        full = page.to_image(resolution=dpi).original.convert("RGB")
        W = full.width

        def crop_pt(y0, y1):
            return full.crop((0, int(y0 * scale), W, int(y1 * scale)))

        axis_im = crop_pt(AXIS_TOP_PT, AXIS_BOTTOM_PT)
        band_im = crop_pt(band_top, band_bot)

    cap_h = 26
    sep_h = 3
    out_im = Image.new("RGB", (W, cap_h + axis_im.height + sep_h + band_im.height), "white")
    d = ImageDraw.Draw(out_im)
    p_start = page_idx * 180
    cap = (f"{week} {day}  page {page_idx} ({p_start//60:02d}:00-{(p_start+180)//60:02d}:00)  "
           f"tracks {t_lo}-{t_hi}  [GROUND TRUTH - read against the PDF's printed axis]")
    d.text((6, 6), cap, fill="black")
    y = cap_h
    out_im.paste(axis_im, (0, y)); y += axis_im.height
    d.rectangle([0, y, W, y + sep_h], fill=(180, 60, 60)); y += sep_h
    out_im.paste(band_im, (0, y))

    out.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("week")
    ap.add_argument("day")
    ap.add_argument("--page", type=int, default=None)
    ap.add_argument("--time", type=str, default=None, help="HH:MM -> picks the 3h page")
    ap.add_argument("--tracks", type=str, default=None, help="e.g. 9-13")
    ap.add_argument("--track", type=str, default=None, help="single track (expands +/-2)")
    ap.add_argument("--dpi", type=int, default=DEFAULT_DPI)
    ap.add_argument("--out", type=str, default=None)
    a = ap.parse_args()

    if a.page is None and a.time is None:
        raise SystemExit("need --page or --time")
    page_idx = a.page if a.page is not None else page_for_time(a.time)

    if a.tracks:
        t_lo, t_hi = parse_tracks(a.tracks)
    elif a.track:
        t = int(a.track)
        t_lo, t_hi = max(1, t - 2), min(16, t + 2)
    else:
        t_lo, t_hi = 1, 16

    out = Path(a.out) if a.out else HERE / "crops" / f"{a.week}_{a.day}_p{page_idx}_t{t_lo}-{t_hi}.png"
    print(render(a.week, a.day, page_idx, t_lo, t_hi, a.dpi, out))


if __name__ == "__main__":
    main()
