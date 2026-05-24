from __future__ import annotations
from datetime import time
from rapidfuzz import process, fuzz
from parsers.normalizer import normalize_key, normalize_cell, normalize_name
from models import CorrectionEntry, UnmatchedEntry


def _parse_manual_time(s: str | None) -> time | None:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            from datetime import datetime
            return datetime.strptime(s, fmt).time()
        except ValueError:
            pass
    return None


def match_and_correct(
    rows: list[dict],
    celbezetting: dict,
) -> tuple[list[dict], list[CorrectionEntry], list[UnmatchedEntry]]:
    """
    Cross-references dispatch rows against celbezetting.
    Corrects cell numbers. Returns matched rows, corrections, unmatched.
    """
    lookup: dict[str, dict] = celbezetting.get("lookup", {})
    all_keys = list(lookup.keys())

    matched: list[dict] = []
    corrections: list[CorrectionEntry] = []
    unmatched: list[UnmatchedEntry] = []

    for row in rows:
        naam = row.get("naam", "")
        voornaam = row.get("voornaam")
        celnr_orig = row.get("celnr")
        source = row.get("source", "")

        # Handle combined naam (voornaam is None, naam may contain full name)
        if voornaam is None and naam and " " in naam.strip():
            parts = naam.strip().split(" ", 1)
            potential_naam = parts[0]
            potential_voor = parts[1]
        else:
            potential_naam = naam
            potential_voor = voornaam or ""

        search_key = normalize_key(potential_naam, potential_voor)

        # Try exact match first
        record = lookup.get(search_key)

        # Fallback: fuzzy match
        if record is None and all_keys:
            result = process.extractOne(
                search_key,
                all_keys,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=85,
            )
            if result:
                record = lookup[result[0]]

        if record is None:
            unmatched.append(UnmatchedEntry(
                naam=naam,
                voornaam=voornaam,
                celnr=celnr_orig,
                source=source,
            ))
            # Still include the row with original cell
            matched.append({
                **row,
                "naam": naam,
                "voornaam": voornaam or "",
                "corrected": False,
            })
            continue

        correct_cel = record["cel"]
        display_naam = record["naam"]
        display_voor = record["voornaam"]

        if celnr_orig is not None and correct_cel is not None and celnr_orig != correct_cel:
            corrections.append(CorrectionEntry(
                naam=display_naam,
                voornaam=display_voor,
                original_celnr=celnr_orig,
                corrected_celnr=correct_cel,
                source=source,
            ))

        matched.append({
            **row,
            "naam": display_naam,
            "voornaam": display_voor,
            "celnr": correct_cel if correct_cel is not None else celnr_orig,
            "corrected": celnr_orig != correct_cel if (celnr_orig is not None and correct_cel is not None) else False,
        })

    return matched, corrections, unmatched


def enrich_manual_entries(entries: list[dict], celbezetting: dict) -> list[dict]:
    """Convert raw manual entry dicts to dispatch rows with time parsing."""
    result = []
    for e in entries:
        result.append({
            "uur": _parse_manual_time(e.get("uur")),
            "celnr": e.get("celnr"),
            "naam": e.get("naam", ""),
            "voornaam": e.get("voornaam"),
            "bestemming": e.get("bestemming", ""),
            "source": "manual",
        })
    return result
