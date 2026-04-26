#!/usr/bin/env python3
"""
ingest_incoming.py
==================

Find all per-day plan PDFs under ``TrainData/incoming/<YEAR>-W<WW>/<day>.pdf``,
run ``extract_monday.py`` for each, then build ``trains.js`` + ``closures.js``
with a week×day map so the web app can show the right day in Europe/Stockholm.

Skips the all-days bundle PDF (name does not end with a weekday before ``.pdf``).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INCOMING = ROOT / "TrainData" / "incoming"
STAGING = HERE / ".extract-staging"
EXTRACT = HERE / "extract_monday.py"
EMIT_BUNDLE = HERE / "emit_week_bundle.py"
MANIFEST = STAGING / "ingest-manifest.json"

# Folder: 2026-W18 (year + ISO week, week zero-padded to 2 in folder name: 2026-W05)
# Day file: mandag.pdf … sondag (ASCII paths; no å/ä/ö in path for tooling)
DAY_FILES = re.compile(
    r"^(mandag|tisdag|onsdag|torsdag|fredag|lordag|sondag)\.pdf$",
    re.IGNORECASE,
)
FOLDER = re.compile(r"^(\d{4})-W(\d+)$", re.IGNORECASE)

# ISO 1=Monday..7=Sunday
DAY_ORDER = {
    "mandag": 1,
    "tisdag": 2,
    "onsdag": 3,
    "torsdag": 4,
    "fredag": 5,
    "lordag": 6,  # Lördag
    "sondag": 7,  # Söndag
}


def _parse_incoming_path(rel: Path) -> Optional[Tuple[str, int, int, str]]:
    """
    rel like ``2026-W18/mandag.pdf`` → (week_key, year, week, day_key)
    where week_key is ``2026-18`` (for JS) and year/week for ISO.
    """
    if len(rel.parts) != 2:
        return None
    folder, fname = rel.parts[0], rel.parts[1]
    m = FOLDER.match(folder)
    d = DAY_FILES.match(fname)
    if not m or not d:
        return None
    year = int(m.group(1))
    week = int(m.group(2))
    day_key = d.group(1).lower()
    if day_key not in DAY_ORDER:
        return None
    wk = f"{year}-W{week:02d}"  # e.g. 2026-W18 (matches ``incoming`` folder)
    return wk, year, week, day_key


def collect_pdfs() -> List[Path]:
    if not INCOMING.is_dir():
        return []
    out: List[Path] = []
    for p in sorted(INCOMING.rglob("*.pdf")):
        rel = p.relative_to(INCOMING)
        if _parse_incoming_path(rel) is not None:
            out.append(p)
    return out


def run_extract(pdf: Path, stem: str) -> None:
    STAGING.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(EXTRACT),
        str(pdf),
        "--out-stem",
        stem,
        "--out-dir",
        str(STAGING),
    ]
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        raise SystemExit(f"extract_monday failed for {pdf}")


def main() -> int:
    pdfs = collect_pdfs()
    if not pdfs:
        print("ingest: no per-day PDFs under TrainData/incoming/<YEAR>-W<WW>/<day>.pdf; skipping.", file=sys.stderr)
        return 0

    meta: List[dict] = []
    for pdf in pdfs:
        rel = pdf.relative_to(INCOMING)
        p = _parse_incoming_path(rel)
        if not p:
            continue
        wk, year, wn, day_key = p
        stem = f"{year}-W{wn:02d}_{day_key}"
        print(f"Extracting {rel} -> {stem}_* …", flush=True)
        run_extract(pdf, stem)
        sch = STAGING / f"{stem}_schedule.json"
        clo = STAGING / f"{stem}_closures.json"
        if not sch.is_file() or not clo.is_file():
            print(f"Missing outputs for {rel}", file=sys.stderr)
            return 1
        meta.append(
            {
                "weekKey": wk,
                "year": year,
                "isoWeek": wn,
                "dayKey": day_key,
                "scheduleJson": str(sch),
                "closuresJson": str(clo),
            }
        )

    STAGING.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"builds": meta}, indent=2), encoding="utf-8")
    r = subprocess.run([sys.executable, str(EMIT_BUNDLE), str(MANIFEST)])
    if r.returncode != 0:
        return r.returncode
    print("ingest: wrote trains.js and closures.js from week bundle.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
