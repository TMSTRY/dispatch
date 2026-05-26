from __future__ import annotations
from datetime import time
from parsers.normalizer import get_section

_VERZORGING_KEYWORDS = ("verzorging", "van damme", "tiberghien")

# BD (Beperkte Detentie): cells 58–70 are always mapped to cell 62 in Verzorging.
_BD_RANGE = range(58, 71)


def _sort_key_time(row: dict):
    t = row.get("uur")
    if t is None:
        return (99, 99)
    return (t.hour, t.minute)


def _sort_key_time_dest_cel(row: dict):
    return (_sort_key_time(row), str(row.get("bestemming", "")).lower(), row.get("celnr") or 99999)


def _sort_key_time_cel_dest(row: dict):
    return (_sort_key_time(row), row.get("celnr") or 99999, str(row.get("bestemming", "")).lower())


def is_verzorging(row: dict) -> bool:
    """
    Return True only when the bestemming is a medical appointment:
    "verzorging", "van damme" or "tiberghien" (doctor names).
    Nothing else — zorg activities (Zorgwandeling, zorgatelier, …)
    belong on lijst disp, not on the Verzorging tab.
    """
    dest = str(row.get("bestemming", "")).lower()
    return any(kw in dest for kw in _VERZORGING_KEYWORDS)


def build_tabs(rows: list[dict]) -> dict[str, list[dict]]:
    """
    Returns dict with keys: 'lijst disp', 'verzorging', 'sectie 1'..'sectie 10'
    """
    tabs: dict[str, list[dict]] = {
        "lijst disp": [],
        "verzorging": [],
        **{f"sectie {i}": [] for i in range(1, 11)},
    }

    for row in rows:
        celnr = row.get("celnr")
        section = get_section(celnr)

        # Route to section tab
        if section is not None:
            tabs[f"sectie {section}"].append(row)

        # Route to lijst disp or verzorging
        if is_verzorging(row):
            # BD cells always get celnr 62 on the Verzorging tab
            verzorg_row = {**row, "celnr": 62} if celnr in _BD_RANGE else row
            tabs["verzorging"].append(verzorg_row)
        else:
            tabs["lijst disp"].append(row)

    # Sort each tab
    tabs["lijst disp"].sort(key=_sort_key_time_dest_cel)
    tabs["verzorging"].sort(key=_sort_key_time_dest_cel)

    for i in range(1, 10):
        tabs[f"sectie {i}"].sort(key=_sort_key_time_cel_dest)

    # Sectie 10: uur, bestemming, cel
    tabs["sectie 10"].sort(key=_sort_key_time_dest_cel)

    return tabs


def insert_hour_separators(rows: list[dict]) -> list[dict | None]:
    """Insert None sentinel between different hour blocks (for verzorging)."""
    result: list[dict | None] = []
    current_hour = None
    for row in rows:
        t = row.get("uur")
        hour_key = (t.hour, t.minute) if t else None
        if current_hour is not None and hour_key != current_hour:
            result.append(None)  # blank separator row
        result.append(row)
        current_hour = hour_key
    return result
