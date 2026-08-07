from __future__ import annotations
import re
from datetime import time
from io import BytesIO
from .normalizer import normalize_cell
from .dispatch import _try_split_full_name

try:
    import pdfplumber
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False


# Let op de lookarounds i.p.v. \b: '18:30u' heeft een letter achter de minuten,
# waardoor een \b-grens daar niet matcht.
_TIME_RE = re.compile(r"(?<!\d)(\d{1,2})[u:.](\d{2})(?!\d)")


def _extract_time(text: str) -> time | None:
    """Return the first HHuMM / HH:MM found in text."""
    m = _TIME_RE.search(text or "")
    if not m:
        return None
    h, mn = int(m.group(1)), int(m.group(2))
    return time(h, mn) if 0 <= h <= 23 and 0 <= mn <= 59 else None


def _smart_cap(s: str) -> str:
    """'kapel' → 'Kapel'; leave already-capitalised text untouched."""
    s = s.strip()
    return s[0].upper() + s[1:] if s and s.islower() else s


def _parse_titel(lines: list[str]) -> tuple[time | None, str]:
    """
    Read uur + bestemming from the title block above the table.

    Typical layout:
        Woensdag 5 augustus 2026
        Katholiek / Protestantse eredienst
        Meditatie - kapel 18:30u        ← uur + lokaal staan hier

    The line holding the time is the one that matters: everything after the
    last ' - ' is the location, with the time stripped off.
    """
    for line in lines:
        uur = _extract_time(line)
        if uur is None:
            continue

        rest = _TIME_RE.sub("", line).strip(" -–\t")
        if " - " in rest or "–" in rest:
            rest = re.split(r"\s[-–]\s", rest)[-1].strip()
        rest = rest.rstrip("u").strip()
        return uur, _smart_cap(rest) if rest else ""

    return None, ""


def parse_activiteit_pdf(file_bytes: bytes, source_name: str = "activiteit") -> list[dict]:
    """
    Parse an activity participant PDF (meditatie, eredienst, les, …).

    Expected table:  Cel | Naam | Voornaam
    Uur and location come from the title block above the table.

    Returns dispatch rows: uur, celnr, naam, voornaam, bestemming, source.
    """
    if not _PDF_AVAILABLE:
        raise RuntimeError(
            "pdfplumber is niet geïnstalleerd — PDF-bestanden worden niet ondersteund. "
            "Voer 'pip install pdfplumber' uit op de server."
        )

    rows_out: list[dict] = []
    seen: set[tuple] = set()
    uur_meta: time | None = None
    best_meta = ""

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            # Title block: lines before the table header
            if uur_meta is None and not best_meta:
                text = page.extract_text() or ""
                header_lines: list[str] = []
                for line in text.splitlines():
                    low = line.strip().lower()
                    if low.startswith("cel") and "naam" in low:
                        break  # reached the table header
                    header_lines.append(line)
                uur_meta, best_meta = _parse_titel(header_lines)

            for table in page.extract_tables():
                if not table:
                    continue

                # Locate header row: must contain "cel" and "naam"
                header_idx: int | None = None
                col_map: dict[str, int] = {}
                for i, row in enumerate(table):
                    if not row:
                        continue
                    row_lower = [str(c).strip().lower() if c else "" for c in row]
                    if "cel" in row_lower and "naam" in row_lower:
                        header_idx = i
                        for j, val in enumerate(row):
                            if val:
                                col_map[str(val).strip().lower()] = j
                        break

                if header_idx is None:
                    continue

                idx_cel  = col_map.get("cel", 0)
                idx_naam = col_map.get("naam", 1)
                idx_voor = col_map.get("voornaam", 2)

                for row in table[header_idx + 1:]:
                    if not row or all(c is None or str(c).strip() == "" for c in row):
                        continue

                    naam_raw = row[idx_naam] if len(row) > idx_naam else None
                    if not naam_raw or not str(naam_raw).strip():
                        continue
                    naam_val = str(naam_raw).strip()
                    if naam_val.lower() in ("naam", "voornaam"):
                        continue  # repeated header on a later page

                    voor_raw = row[idx_voor] if len(row) > idx_voor else None
                    voor_val = str(voor_raw).strip() if voor_raw and str(voor_raw).strip() else None

                    # Combined "LASTNAME Firstname" in a single column
                    naam_val, voor_val = _try_split_full_name(naam_val, voor_val)

                    cel_val = normalize_cell(row[idx_cel] if len(row) > idx_cel else None)

                    dedup_key = (naam_val.lower(), (voor_val or "").lower(), uur_meta)
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)

                    rows_out.append({
                        "uur":        uur_meta,
                        "celnr":      cel_val,
                        "naam":       naam_val,
                        "voornaam":   voor_val,
                        "bestemming": best_meta,
                        "source":     source_name,
                    })

    return rows_out
