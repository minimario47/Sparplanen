#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

# Capture 3-6 digit train numbers even when attached to letters like 12032Fek or via ogr17344.
NUM_RE = re.compile(r"(?<!\d)(\d{3,6})(?!\d)")
LETTER_RE = re.compile(r"[A-Za-zÅÄÖåäö]")

STRICT_FIELDS = [
    "track",
    "arrival_train",
    "departure_train",
    "arrival_time",
    "departure_time",
    "arrival_number_of_vehicles",
    "departure_number_of_vehicles",
]

AUDIT_EXTRA_FIELDS = [
    "day",
    "page",
    "page_interval",
    "source_segment_id",
    "source_vehicle_count",
    "inference_type",
    "confidence",
    "inferred_parent_segment_id",
    "continues_from_prev_page",
    "continues_to_next_page",
    "arrival_label_raw",
    "departure_label_raw",
    "arrival_note_raw",
    "departure_note_raw",
    "interpretation_status",
    "raw_number_tokens",
    "token_pattern",
    "manual_review_note",
    "review_status",
]


def read_rows(path: Path) -> List[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for key in [
            "dag",
            "sidintervall",
            "starttid",
            "sluttid",
            "ankomstetikett_gissning",
            "avgångsetikett_gissning",
            "ankomst_tågnr_gissning",
            "avgång_tågnr_gissning",
            "ankomst_notering_gissning",
            "avgång_notering_gissning",
            "alla_etiketter_på_segmentet",
            "tolkningsstatus",
            "segment_id",
        ]:
            r[key] = str(r.get(key, "") or "").strip()
        for key in ["sida", "spår", "fordonsantal", "start_dygnsminut", "slut_dygnsminut"]:
            raw = str(r.get(key, "") or "").strip()
            r[key] = float(raw) if raw else math.nan
        for key in ["fortsätter_från_föregående_sida", "fortsätter_till_nästa_sida"]:
            r[key] = str(r.get(key, "") or "").strip().lower() == "true"
    rows.sort(key=lambda r: (r["dag"], r["spår"], r["start_dygnsminut"], r["slut_dygnsminut"], r["sida"], r["segment_id"]))
    return rows


def int_or_blank(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(int(round(float(value))))


def numeric_tokens(text: str) -> List[str]:
    return NUM_RE.findall(text or "")


def first_numeric(text: str) -> str:
    toks = numeric_tokens(text)
    return toks[0] if toks else ""


def has_letters(text: str) -> bool:
    return bool(LETTER_RE.search(text or ""))


def canonical_pattern(tokens: List[str]) -> str:
    mapping: Dict[str, str] = {}
    out = []
    next_idx = 0
    for token in tokens:
        if token not in mapping:
            mapping[token] = chr(ord("A") + next_idx)
            next_idx += 1
        out.append(mapping[token])
    return "".join(out)


def cleaned_train(value: str) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    if value.isdigit():
        return str(int(value))
    toks = numeric_tokens(value)
    if len(toks) == 1:
        return str(int(toks[0]))
    # Multiple embedded train numbers in one field are ambiguous; let higher-level token logic decide.
    return ""


def enhanced_pair(row: dict) -> Tuple[str, str, str]:
    """Return arrival/departure using parsed values first, then side-specific raw extraction.

    We intentionally DO NOT invent a full pair when both parsed sides are blank and both raw sides contain digits,
    because that pattern often comes from two merged parallel lines rather than a true arrival->departure pair.
    """
    arr = cleaned_train(row["ankomst_tågnr_gissning"])
    dep = cleaned_train(row["avgång_tågnr_gissning"])
    evidence = []

    if arr:
        evidence.append("parsed_arr")
    if dep:
        evidence.append("parsed_dep")

    arr_raw = cleaned_train(first_numeric(row["ankomstetikett_gissning"]) or first_numeric(row["ankomst_notering_gissning"]))
    dep_raw = cleaned_train(first_numeric(row["avgångsetikett_gissning"]) or first_numeric(row["avgång_notering_gissning"]))

    if not arr and dep and arr_raw:
        arr = arr_raw
        evidence.append("raw_arr_supplement")
    elif not dep and arr and dep_raw:
        dep = dep_raw
        evidence.append("raw_dep_supplement")
    elif not arr and not dep:
        # Allow one-sided supplementation only.
        if arr_raw and not dep_raw:
            arr = arr_raw
            evidence.append("raw_arr_only")
        elif dep_raw and not arr_raw:
            dep = dep_raw
            evidence.append("raw_dep_only")

    return arr, dep, "+".join(evidence) if evidence else ""


def base_record(row: dict, toks: List[str], pattern: str, arrival_train: str, departure_train: str, inference_type: str, confidence: str) -> dict:
    veh = int_or_blank(row["fordonsantal"])
    return {
        "track": int_or_blank(row["spår"]),
        "arrival_train": cleaned_train(arrival_train),
        "departure_train": cleaned_train(departure_train),
        "arrival_time": row["starttid"] if arrival_train else "",
        "departure_time": row["sluttid"] if departure_train else "",
        "arrival_number_of_vehicles": veh if arrival_train else "",
        "departure_number_of_vehicles": veh if departure_train else "",
        "day": row["dag"],
        "page": int_or_blank(row["sida"]),
        "page_interval": row["sidintervall"],
        "source_segment_id": row["segment_id"],
        "source_vehicle_count": veh,
        "inference_type": inference_type,
        "confidence": confidence,
        "inferred_parent_segment_id": "",
        "continues_from_prev_page": str(row["fortsätter_från_föregående_sida"]),
        "continues_to_next_page": str(row["fortsätter_till_nästa_sida"]),
        "arrival_label_raw": row["ankomstetikett_gissning"],
        "departure_label_raw": row["avgångsetikett_gissning"],
        "arrival_note_raw": row["ankomst_notering_gissning"],
        "departure_note_raw": row["avgång_notering_gissning"],
        "interpretation_status": row["tolkningsstatus"],
        "raw_number_tokens": "|".join(toks),
        "token_pattern": pattern,
        "manual_review_note": "",
        "review_status": "",
    }


def build_base_rows(rows: List[dict]) -> List[dict]:
    out: List[dict] = []

    # Source-row groups used for continuation heuristics.
    same_start: Dict[tuple[str, str, str, str], List[dict]] = defaultdict(list)
    for r in rows:
        key = (r["dag"], int_or_blank(r["sida"]), int_or_blank(r["spår"]), r["starttid"])
        same_start[key].append(r)

    for row in rows:
        arr, dep, pair_evidence = enhanced_pair(row)
        toks = numeric_tokens(row["alla_etiketter_på_segmentet"])
        pattern = canonical_pattern(toks) if toks else ""
        alpha_in_all = has_letters(row["alla_etiketter_på_segmentet"])
        group_key = (row["dag"], int_or_blank(row["sida"]), int_or_blank(row["spår"]), row["starttid"])
        sibling_rows = [s for s in same_start[group_key] if s["segment_id"] != row["segment_id"]]

        def emit(arrival_train: str, departure_train: str, inference_type: str, confidence: str):
            inf = inference_type if not pair_evidence else f"{inference_type}+{pair_evidence}"
            out.append(base_record(row, toks, pattern, arrival_train, departure_train, inf, confidence))

        # Continuation-only heuristic: a line that already exists from previous page and ends on this page
        # with one attached numeric label is almost always a departure-only row.
        if (
            not arr and not dep and toks
            and row["fortsätter_från_föregående_sida"] and not row["fortsätter_till_nästa_sida"]
            and alpha_in_all
        ):
            if len(toks) == 1:
                emit("", toks[0], "continuation_single_token_departure", "high")
                continue
            if len(toks) == 2:
                sibling_single_tokens = set()
                for s in sibling_rows:
                    stoks = numeric_tokens(s["alla_etiketter_på_segmentet"])
                    if len(stoks) == 1:
                        sibling_single_tokens.add(stoks[0])
                unmatched = [t for t in toks if t not in sibling_single_tokens]
                if len(unmatched) == 1:
                    emit("", unmatched[0], "continuation_attached_pair_resolved_to_departure", "reviewed")
                    continue

        if not toks:
            if arr or dep:
                emit(arr, dep, "parsed_only", "medium")
            continue

        if len(toks) == 1:
            if arr or dep:
                emit(arr, dep, "single_token_keep_parsed", "medium")
            continue

        if len(toks) == 2:
            if arr and dep:
                emit(arr, dep, "clear_pair", "high")
            elif arr or dep:
                other_arr = toks[0]
                other_dep = toks[1]
                if arr and not dep and cleaned_train(other_dep) != arr and not has_letters(row["avgångsetikett_gissning"] + row["avgång_notering_gissning"]):
                    emit(arr, cleaned_train(other_dep), "pair_from_tokens_with_arr_anchor", "high")
                elif dep and not arr and cleaned_train(other_arr) != dep and not has_letters(row["ankomstetikett_gissning"] + row["ankomst_notering_gissning"]):
                    emit(cleaned_train(other_arr), dep, "pair_from_tokens_with_dep_anchor", "high")
                else:
                    emit(arr, dep, "double_token_keep_anchor", "medium")
            else:
                if not alpha_in_all:
                    emit(toks[0], toks[1], "clear_pair_from_raw_tokens", "high")
            continue

        if pattern == "AAB":
            emit(toks[0], toks[2], "clear_pattern_AAB", "high")
            continue

        if pattern == "ABB":
            emit(toks[0], toks[1], "clear_pattern_ABB", "high")
            continue

        if pattern == "ABCC":
            emit(toks[0], toks[2], "clear_pattern_ABCC_split", "high")
            emit(toks[1], toks[3], "clear_pattern_ABCC_split", "high")
            continue

        if pattern == "AABC":
            emit(toks[0], toks[2], "clear_pattern_AABC_split", "high")
            emit(toks[1], toks[3], "clear_pattern_AABC_split", "high")
            continue

        if arr or dep:
            emit(arr, dep, f"ambiguous_keep_anchor_{pattern}", "low")
        elif not alpha_in_all:
            emit(toks[0], toks[-1], f"ambiguous_outer_tokens_{pattern}", "low")

    return out



def resolve_companion_duplicate_pairs(rows: List[dict]) -> List[dict]:
    """Resolve a recurring visual pattern from the PDF:

    Two parallel rows can share the same numeric pair, where one true pair row is accompanied by
    a shorter companion row with the same numbers plus a non-numeric note like U/D. In the raw
    token stream this often appears as AAB or ABB. When a clean AB companion exists on the same
    page/track for the same arrival/departure numbers, reinterpret:
      - AAB companion as arrival-only
      - ABB companion as departure-only
    """
    out = [dict(r) for r in rows]
    groups = defaultdict(list)
    for i, r in enumerate(out):
        if r.get('arrival_train') and r.get('departure_train'):
            key = (r.get('day',''), r.get('page',''), r.get('track',''), r.get('arrival_train',''), r.get('departure_train',''))
            groups[key].append(i)

    for key, idxs in groups.items():
        if len(idxs) < 2:
            continue
        has_ab = any(out[i].get('token_pattern') == 'AB' for i in idxs)
        if not has_ab:
            continue
        for i in idxs:
            pat = out[i].get('token_pattern','')
            if pat == 'AAB':
                out[i]['departure_train'] = ''
                out[i]['departure_time'] = ''
                out[i]['departure_number_of_vehicles'] = ''
                out[i]['confidence'] = 'reviewed'
                out[i]['inference_type'] = 'companion_duplicate_AAB_resolved_to_arrival_only'
            elif pat == 'ABB':
                out[i]['arrival_train'] = ''
                out[i]['arrival_time'] = ''
                out[i]['arrival_number_of_vehicles'] = ''
                out[i]['confidence'] = 'reviewed'
                out[i]['inference_type'] = 'companion_duplicate_ABB_resolved_to_departure_only'
    return out

def hhmm_to_min(value: str) -> int:
    if not value:
        return -1
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def dedupe_exact(rows: List[dict]) -> List[dict]:
    seen = set()
    out = []
    key_fields = [
        "day",
        "page",
        "track",
        "arrival_train",
        "departure_train",
        "arrival_time",
        "departure_time",
        "arrival_number_of_vehicles",
        "departure_number_of_vehicles",
    ]
    for r in rows:
        key = tuple(r[k] for k in key_fields)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def load_drop_keys(path: Path) -> set[Tuple[str, ...]]:
    if not path or not path.exists():
        return set()
    drops = set()
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r.get("review_status") in {"manually_dropped", "auto_dropped_after_review"}:
                key = (
                    r.get("day", ""),
                    r.get("page", ""),
                    r.get("track", ""),
                    r.get("source_segment_id", ""),
                    r.get("arrival_train", ""),
                    r.get("departure_train", ""),
                    r.get("arrival_time", ""),
                    r.get("departure_time", ""),
                )
                drops.add(key)
    return drops


def load_review_overrides(path: Path) -> Tuple[Dict[str, dict], List[dict]]:
    corrections: Dict[str, dict] = {}
    additions: List[dict] = []
    if not path or not path.exists():
        return corrections, additions
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            status = r.get("review_status", "")
            if status == "manually_corrected":
                corrections[r["source_segment_id"]] = dict(r)
            elif status == "manually_added":
                additions.append(dict(r))
    return corrections, additions


def apply_review_overrides(rows: List[dict], drop_keys: set[Tuple[str, ...]], corrections: Dict[str, dict], additions: List[dict]) -> List[dict]:
    out: List[dict] = []
    for r in rows:
        key = (
            r.get("day", ""),
            r.get("page", ""),
            r.get("track", ""),
            r.get("source_segment_id", ""),
            r.get("arrival_train", ""),
            r.get("departure_train", ""),
            r.get("arrival_time", ""),
            r.get("departure_time", ""),
        )
        if key in drop_keys:
            continue
        if r["source_segment_id"] in corrections:
            c = corrections[r["source_segment_id"]]
            merged = dict(r)
            for field in STRICT_FIELDS + AUDIT_EXTRA_FIELDS:
                if field in c:
                    merged[field] = c[field]
            out.append(merged)
        else:
            out.append(r)
    for a in additions:
        out.append({field: a.get(field, "") for field in STRICT_FIELDS + AUDIT_EXTRA_FIELDS})
    return out


def write_csv(path: Path, rows: Iterable[dict], fieldnames: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_csv", type=Path)
    ap.add_argument("output_csv", type=Path)
    ap.add_argument("--audit-csv", type=Path)
    ap.add_argument("--review-audit", type=Path, help="Audit CSV with manually_corrected/manually_added rows")
    ap.add_argument("--drop-review-csv", type=Path, help="CSV containing manually_dropped/auto_dropped_after_review rows")
    args = ap.parse_args()

    source_rows = read_rows(args.input_csv)
    normalized = build_base_rows(source_rows)
    normalized = resolve_companion_duplicate_pairs(normalized)
    normalized = dedupe_exact(normalized)

    drop_keys = load_drop_keys(args.drop_review_csv) if args.drop_review_csv else set()
    corrections, additions = load_review_overrides(args.review_audit) if args.review_audit else ({}, [])
    normalized = apply_review_overrides(normalized, drop_keys, corrections, additions)
    normalized = dedupe_exact(normalized)
    normalized.sort(key=lambda r: (r["day"], int(r["page"] or 0), int(r["track"] or 0), hhmm_to_min(r["arrival_time"] or r["departure_time"]), r["source_segment_id"], r["arrival_train"], r["departure_train"]))

    write_csv(args.output_csv, normalized, STRICT_FIELDS)
    if args.audit_csv:
        write_csv(args.audit_csv, normalized, STRICT_FIELDS + AUDIT_EXTRA_FIELDS)

    print(f"Wrote {len(normalized)} rows to {args.output_csv}")
    if args.audit_csv:
        print(f"Wrote audit CSV to {args.audit_csv}")


if __name__ == "__main__":
    main()
