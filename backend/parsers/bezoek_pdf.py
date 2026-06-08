from __future__ import annotations
import re
from datetime import time
from io import BytesIO
from .normalizer import normalize_cell

try:
    import pdfplumber
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False


def _parse_shift(s: str) -> time | None:
    """Extract the start time from strings like '10u00 - 12u00' or 'Ma - Vr: 16u15 - 17u15'."""
    if not s:
        return None
    m = re.search(r'\b(\d{1,2})[u:](\d{2})\b', s)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        t = time(h, mn)
        # Gemeenschappelijk bezoek 13:15 → round down to 13:00 (same as Excel bezoek correction)
        if t == time(13, 15):
            t = time(13, 0)
        return t
    return None


def parse_bezoek_pdf(file_bytes: bytes, source_name: str = "bezoek") -> list[dict]:
    """
    Parse a DG EPI 'Gereserveerde bezoeken' PDF into dispatch rows.

    Expected columns (order detected dynamically via header row):
        Naam | Voornaam | Gebouw | Cel | Bezoeker naam | Bezoeker voornaam
        | Type bezoek | Shift | Tafel | Gevangenis

    Output per row:
        uur        → start time extracted from Shift
        celnr      → Cel (leading zeros stripped via normalize_cell)
        naam       → Naam (detainee)
        voornaam   → Voornaam (detainee)
        bestemming → Type bezoek ("Ongestoord bezoek" / "Gemeenschappelijk bezoek")
        source     → source_name (filename)
    """
    if not _PDF_AVAILABLE:
        raise RuntimeError(
            "pdfplumber is niet geïnstalleerd — PDF-bestanden worden niet ondersteund. "
            "Voer 'pip install pdfplumber' uit op de server."
        )

    rows_out: list[dict] = []
    seen: set[tuple] = set()

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue

            # Locate header row: must contain both "naam" and "shift"
            header_idx: int | None = None
            col_map: dict[str, int] = {}

            for i, row in enumerate(table):
                if row is None:
                    continue
                row_lower = [str(c).strip().lower() if c else "" for c in row]
                if "naam" in row_lower and "shift" in row_lower:
                    header_idx = i
                    for j, val in enumerate(row):
                        if val:
                            col_map[str(val).strip().lower()] = j
                    break

            if header_idx is None:
                continue  # no recognisable header on this page

            idx_naam  = col_map.get("naam", 0)
            idx_voor  = col_map.get("voornaam", 1)
            idx_cel   = col_map.get("cel", 3)
            idx_shift = col_map.get("shift", 7)
            idx_type  = col_map.get("type bezoek", 6)

            for row in table[header_idx + 1:]:
                if not row:
                    continue
                if all(c is None or str(c).strip() == "" for c in row):
                    continue  # blank separator row

                naam_raw = row[idx_naam] if len(row) > idx_naam else None
                if not naam_raw or not str(naam_raw).strip():
                    continue

                naam_val = str(naam_raw).strip()

                voor_raw = row[idx_voor] if len(row) > idx_voor else None
                voor_val = str(voor_raw).strip() if voor_raw and str(voor_raw).strip() else None

                cel_raw   = row[idx_cel]   if len(row) > idx_cel   else None
                shift_raw = row[idx_shift] if len(row) > idx_shift else None
                type_raw  = row[idx_type]  if len(row) > idx_type  else None

                cel_val  = normalize_cell(cel_raw)
                uur_val  = _parse_shift(str(shift_raw).strip() if shift_raw else "")
                best_val = str(type_raw).strip() if type_raw else "Bezoek"

                # Deduplication: same detainee, same shift, same visit type → keep first
                dedup_key = (naam_val.lower(), (voor_val or "").lower(), uur_val, best_val.lower())
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                rows_out.append({
                    "uur":        uur_val,
                    "celnr":      cel_val,
                    "naam":       naam_val,
                    "voornaam":   voor_val,
                    "bestemming": best_val,
                    "source":     source_name,
                })

    return rows_out
