from __future__ import annotations
from datetime import datetime, time
from .normalizer import normalize_cell
from .workbook_reader import open_workbook


def _to_time(val) -> time | None:
    if val is None:
        return None
    if isinstance(val, time):
        return val
    if isinstance(val, datetime):
        return val.time()
    s = str(val).strip()
    if not s or s in ("\xa0", ""):
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            pass
    return None


def _is_blank_row(row) -> bool:
    return all(
        v is None or (isinstance(v, str) and v.strip() in ("", "\xa0"))
        for v in row
    )


# ── Name splitting ───────────────────────────────────────────────────────────
# Some services (e.g. zorg) put the full name in a single "naam" column,
# formatted as "LASTNAME [LASTNAME2...] Firstname [Middlenames...]".
# We detect this by the ALL-CAPS / mixed-case boundary and split accordingly.
# Middle names after the first name are dropped (user requirement).

def _try_split_full_name(naam: str, voornaam: str | None) -> tuple[str, str | None]:
    """
    If voornaam is absent and naam looks like 'LASTNAME Firstname ...',
    split at the first non-ALL-CAPS token.

    Examples:
      'MAES Saskia'              → ('MAES', 'Saskia')
      'PINTO FERREIRA Dominique' → ('PINTO FERREIRA', 'Dominique')
      'SCHEERS Zion Gonda Marcel'→ ('SCHEERS', 'Zion')   # middle names dropped
      'BEN KHEDIJA Amin'         → ('BEN KHEDIJA', 'Amin')
      'VAN MOOK'                 → ('VAN MOOK', None)    # all caps → no split
    """
    if voornaam:                      # already split — leave unchanged
        return naam, voornaam
    if " " not in naam:               # single token — nothing to split
        return naam, voornaam

    tokens = naam.strip().split()
    naam_parts: list[str] = []
    first_name: str | None = None

    for token in tokens:
        if token.isupper():           # ALL-CAPS → part of surname
            naam_parts.append(token)
        else:                         # mixed-case → first name, stop here
            first_name = token
            break

    # Only split when we have both a clear surname AND a clear first name
    if naam_parts and first_name:
        return " ".join(naam_parts), first_name

    return naam, voornaam             # pattern unclear → leave unchanged


# ── Filename-based fallback detection ────────────────────────────────────────
# Some services omit uur/bestemming; we infer them from the filename.
_FALLBACK_RULES: list[tuple[list[str], time, str]] = [
    # keywords (all must appear in lowercased filename)  →  uur, bestemming
    (["betekening"],  time(9, 0),  "Betekening directeur"),
    (["griffie"],     time(8, 30), "Griffie"),
]


def _detect_fallbacks(source_name: str) -> tuple[time | None, str]:
    """Return (fallback_uur, fallback_bestemming) based on filename keywords."""
    lower = source_name.lower()
    for keywords, uur, best in _FALLBACK_RULES:
        if all(kw in lower for kw in keywords):
            return uur, best
    return None, ""


# ── Keuken dual-time detection ────────────────────────────────────────────────
# The keuken file has two time columns:
#   col A → "MA TOT VRIJ"  (weekday time)
#   col B → "ZA, ZO, FD"  (weekend / holiday time)
# Both are stored in each row; main.py picks the right one at generate time.

def _detect_keuken_cols(col_map: dict) -> tuple[int | None, int | None]:
    """
    Detect keuken-style weekday/weekend time columns from the header col_map.
    Returns (idx_weekday, idx_weekend) or (None, None) if not a keuken file.
    """
    idx_wd = None  # MA TOT VRIJ
    idx_we = None  # ZA, ZO, FD
    for key, idx in col_map.items():
        k = key.lower()
        if "ma" in k and "vrij" in k:
            idx_wd = idx
        elif "za" in k and ("zo" in k or "fd" in k):
            idx_we = idx
    return idx_wd, idx_we


def parse_dispatch(file_bytes: bytes, source_name: str = "dispatch") -> list[dict]:
    wb = open_workbook(file_bytes, source_name)

    fallback_uur, fallback_best = _detect_fallbacks(source_name)

    rows_out: list[dict] = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]

        # Find header row.
        # Accepted formats:
        #   1. Regular dispatch: row contains "naam" AND "bestemming"
        #   2. Agenda/hoorzitting: row contains "rad" AND a cell containing "naam"
        #   3. Bezoek: row contains "shift" AND "type bezoek" (AND "naam")
        header_row_idx = None
        col_map = {}
        is_agenda = False
        is_bezoek = False
        for i, row in enumerate(ws.iter_rows(min_row=1, values_only=True), 1):
            row_lower = [str(c).strip().lower() if c is not None else "" for c in row]
            is_regular = "naam" in row_lower and "bestemming" in row_lower
            is_agenda_hdr = "rad" in row_lower and any("naam" in v for v in row_lower)
            is_bezoek_hdr = "shift" in row_lower and "type bezoek" in row_lower and "naam" in row_lower
            if is_bezoek_hdr or is_regular or is_agenda_hdr:
                header_row_idx = i
                is_bezoek = is_bezoek_hdr and not is_regular
                is_agenda = is_agenda_hdr and not is_regular and not is_bezoek
                for j, val in enumerate(row):
                    lv = str(val).strip().lower() if val is not None else ""
                    if lv:
                        col_map[lv] = j
                if "uur" not in col_map:
                    col_map["uur"] = 0
                break

        if header_row_idx is None:
            continue  # sheet has no recognizable dispatch data

        # Check for keuken dual-time layout
        idx_uur_wd, idx_uur_we = _detect_keuken_cols(col_map)
        is_keuken = idx_uur_wd is not None and idx_uur_we is not None

        # Bezoek: "shift" → uur, "type bezoek" → bestemming
        # "naam" / "voornaam" = gedetineerde (not "bezoeker naam" / "bezoeker voornaam")
        if is_bezoek:
            idx_uur  = col_map.get("shift", col_map.get("uur", 0))
            idx_best = col_map.get("type bezoek", col_map.get("bestemming", 4))
        else:
            idx_uur  = col_map.get("uur", 0)
            idx_best = col_map.get("bestemming", 4)

        # "celnr." (with dot) is used in agenda files
        idx_cel  = next((col_map[k] for k in ("celnr", "celnr.") if k in col_map), 1)
        # "naam gedet." is used in agenda files
        idx_naam = next((col_map[k] for k in ("naam", "naam gedet.") if k in col_map), 2)
        idx_voor = col_map.get("voornaam", 3)
        # Agenda-specific: RAD column (date of hearing) and fixed overrides
        idx_rad  = col_map.get("rad")
        if is_agenda:
            fallback_best = "Hoorzitting"
            fallback_uur  = time(10, 0)
            idx_best = None  # no bestemming column in agenda files — always use fallback

        # Columns to exclude from skip-status scan (avoid false matches on names)
        _name_cols = {idx_naam, idx_voor}

        # Bezoek deduplication: one row per (naam, voornaam, shift)
        _bezoek_seen: set[tuple] = set()

        for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
            if _is_blank_row(row):
                continue

            naam_raw = row[idx_naam] if len(row) > idx_naam else None
            if naam_raw is None or str(naam_raw).strip() in ("", "\xa0"):
                continue

            naam_val = str(naam_raw).strip()

            # Skip placeholder / template rows where the naam cell contains a
            # column header label (e.g. a repeated "Naam" row at the bottom of
            # a sheet used as a manual-entry template).
            if naam_val.lower() in {"naam", "name", "voornaam", "firstname"}:
                continue

            # Agenda-specific filters:
            if is_agenda:
                # Skip rows without a RAD date — these have no scheduled hearing
                rad_val = row[idx_rad] if (idx_rad is not None and len(row) > idx_rad) else None
                if rad_val is None:
                    continue
                # Skip BVM / IBVR rows — internal measures, not transported
                row_text = " ".join(str(v).lower() for v in row if v is not None)
                if "bvm" in row_text or "ibvr" in row_text:
                    continue

            # Skip rows marked as "rust" or "atv" in any non-name column.
            # Keuken and magazijn files mark unavailable detainees this way.
            if any(
                str(row[i]).strip().lower() in {"rust", "atv"}
                for i in range(len(row))
                if i not in _name_cols and row[i] is not None
            ):
                continue

            cel_val  = normalize_cell(row[idx_cel]  if len(row) > idx_cel  else None)
            voor_raw = row[idx_voor] if len(row) > idx_voor else None
            voor_val = str(voor_raw).strip() if voor_raw else None
            best_raw = (row[idx_best] if (idx_best is not None and len(row) > idx_best) else None)
            best_val = str(best_raw).strip() if best_raw else ""

            if voor_val in ("", "\xa0"):
                voor_val = None
            if best_val in ("\xa0",):
                best_val = ""

            # Split combined "LASTNAME Firstname" → separate naam / voornaam
            naam_val, voor_val = _try_split_full_name(naam_val, voor_val)

            if is_keuken:
                # Store both times; main.py resolves which to use based on target date
                uur_wd = _to_time(row[idx_uur_wd] if len(row) > idx_uur_wd else None)
                uur_we = _to_time(row[idx_uur_we] if len(row) > idx_uur_we else None)
                rows_out.append({
                    "uur":       None,   # resolved later
                    "uur_wd":    uur_wd,
                    "uur_we":    uur_we,
                    "dual_uur":  True,
                    "celnr":     cel_val,
                    "naam":      naam_val,
                    "voornaam":  voor_val,
                    "bestemming": best_val or fallback_best,
                    "source":    source_name,
                })
            else:
                uur_val = _to_time(row[idx_uur] if len(row) > idx_uur else None)

                # Apply filename-based fallbacks for missing uur / bestemming
                if uur_val is None and fallback_uur is not None:
                    uur_val = fallback_uur
                if not best_val and fallback_best:
                    best_val = fallback_best

                # Bezoek deduplication: same detainee + same shift → keep only first
                if is_bezoek:
                    dedup_key = (naam_val.lower(), (voor_val or "").lower(), uur_val)
                    if dedup_key in _bezoek_seen:
                        continue
                    _bezoek_seen.add(dedup_key)

                rows_out.append({
                    "uur":        uur_val,
                    "celnr":      cel_val,
                    "naam":       naam_val,
                    "voornaam":   voor_val,
                    "bestemming": best_val,
                    "source":     source_name,
                })

    return rows_out
