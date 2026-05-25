from __future__ import annotations
from datetime import datetime, time
from .normalizer import normalize_cell
from .workbook_reader import open_workbook


_WEIGER_TERMS    = ("weigert", "weigering", "refus", "refuse", "wenst niet te verschijnen")
_PALEIS_SKIP     = {"1erit", "1ste rit", "1e rit"}
_UITHALING_HDR   = {"uithalingen", "uithalingen:"}
_VIRTUAL_CELLS   = {"80000", "70000"}
_MEDISCH_TERMS   = ("medisch", "medical", "medic")

# All recognised column-name aliases for the cell-number column.
# The paleislijst is exported by different systems with varying headers.
_CEL_ALIASES     = ("celnummer", "cell", "cel", "cellnr")


def _to_time(val) -> time | None:
    if val is None:
        return None
    if isinstance(val, time):
        return val
    if isinstance(val, datetime):
        return val.time()
    return None


def _is_zero_time(t: time | None) -> bool:
    return t is not None and t.hour == 0 and t.minute == 0


def _row_has_weiger(row) -> bool:
    """Return True if any cell in the row contains a refusal keyword."""
    for cell in row:
        if cell is None:
            continue
        s = str(cell).lower()
        if any(term in s for term in _WEIGER_TERMS):
            return True
    return False


def parse_paleislijst(file_bytes: bytes, filename: str = "") -> list[dict]:
    wb = open_workbook(file_bytes, filename)
    ws = wb.active

    # ── Find header row ───────────────────────────────────────────────────────
    # Accept any row that contains "naam" AND at least one cell-alias.
    header_row_idx = None
    col_map: dict[str, int] = {}

    for i, row in enumerate(ws.iter_rows(min_row=1, values_only=True), 1):
        row_lower = [str(c).strip().lower() if c is not None else "" for c in row]
        has_naam = "naam" in row_lower
        has_cel  = any(alias in row_lower for alias in _CEL_ALIASES)
        if has_naam and has_cel:
            header_row_idx = i
            for j, val in enumerate(row):
                if val is not None:
                    col_map[str(val).strip().lower()] = j
            break

    if header_row_idx is None:
        raise ValueError(
            "Geen header-rij gevonden in paleislijst "
            "(verwacht: Naam + Celnummer / Cell / Cel)"
        )

    # ── Column indices (robust: try multiple aliases) ─────────────────────────
    def _col(*aliases: str, default: int = 0) -> int:
        for a in aliases:
            if a in col_map:
                return col_map[a]
        return default

    idx_naam         = _col("naam",          default=0)
    idx_voor         = _col("voornaam",       default=1)
    idx_cel          = _col(*_CEL_ALIASES,    default=4)
    idx_onderwerp    = _col("onderwerp", "instantie", default=None)  # type: ignore[arg-type]
    idx_type         = _col("type",           default=None)          # type: ignore[arg-type]
    idx_start        = _col("start", "uur",   default=7)

    rows_out: list[dict] = []
    section = "paleis"   # switches to "uithaling" when UITHALINGEN header is hit

    for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
        naam_raw = row[idx_naam] if len(row) > idx_naam else None
        if naam_raw is None:
            continue

        naam_str = str(naam_raw).strip()
        if not naam_str:
            continue

        naam_lower = naam_str.lower()

        # Section header: switch to uithaling mode
        if naam_lower in _UITHALING_HDR:
            section = "uithaling"
            continue

        # Skip paleis-internal divider labels
        if naam_lower in _PALEIS_SKIP:
            continue

        # ── Filters ──────────────────────────────────────────────────────────

        # Refusal: check the entire row (column position varies per export)
        if _row_has_weiger(row):
            continue

        # Virtual / placeholder cell numbers
        cel_raw = row[idx_cel] if len(row) > idx_cel else None
        cel_str = str(cel_raw).strip() if cel_raw is not None else ""
        if cel_str in _VIRTUAL_CELLS:
            continue

        # No valid cell number at all
        cel_int = normalize_cell(cel_raw)
        if cel_int is None:
            continue

        # 00:00 time → person is not being transported
        start_raw = row[idx_start] if len(row) > idx_start else None
        uur_val = _to_time(start_raw)
        if _is_zero_time(uur_val):
            continue

        # ── Voornaam ─────────────────────────────────────────────────────────
        voor_raw = row[idx_voor] if len(row) > idx_voor else None
        voor_str = str(voor_raw).strip() if voor_raw else None
        if voor_str == "":
            voor_str = None

        # ── Bestemming — section-based ────────────────────────────────────────
        if section == "uithaling":
            # Check onderwerp/type columns for "medisch" if they exist
            combined_parts = []
            for idx in (idx_onderwerp, idx_type):
                if idx is not None and len(row) > idx and row[idx]:
                    combined_parts.append(str(row[idx]).lower())
            combined = " ".join(combined_parts)
            if any(term in combined for term in _MEDISCH_TERMS):
                bestemming = "medische uithaling"
            else:
                bestemming = "uithaling"
        else:
            bestemming = "paleis"

        rows_out.append({
            "uur":        uur_val,
            "celnr":      cel_int,
            "naam":       naam_str,
            "voornaam":   voor_str,
            "bestemming": bestemming,
            "source":     "paleislijst",
        })

    return rows_out
