from __future__ import annotations
import re
from datetime import date as Date
from .workbook_reader import open_workbook

# ── Name prefix stripping ─────────────────────────────────────────────────────
# The dienstroooster marks certain staff with 1-2 char prefixes merged into the
# surname (e.g. "SBALCAEN Matthias" → S + BALCAEN, "ÌLEMEIRE Dominique" → Ì + LEMEIRE,
# "USBROUCKAERT Ruben" → US + BROUCKAERT). Strip these before filling the template.

_SPECIAL_SINGLE = set("iÌÎÏÓ")  # lowercase i + accented uppercase variants


def strip_name_prefix(name: str) -> str:
    if not name:
        return name
    space = name.find(" ")
    if space <= 1:
        return name
    first = name[:space]
    rest = name[space:]  # includes leading space

    # 2-char "US" prefix
    if len(first) > 2 and first[:2] == "US" and first[2].isupper():
        return first[2:] + rest

    # 1-char lowercase or accented prefix
    if first[0].islower() or first[0] in _SPECIAL_SINGLE:
        if len(first) > 1 and first[1].isupper():
            return first[1:] + rest

    # 1-char uppercase S/O prefix, only when remaining surname ≥ 2 chars
    if first[0] in ("S", "O") and len(first) >= 3 and first[1].isupper():
        return first[1:] + rest

    return name


# ── Position normalisation ────────────────────────────────────────────────────

_ABBREV_MAP = {
    "pdb": "pen. des. bewaking",
    "pen.des.bew.": "pen. des. bewaking",
}


def norm_pos(s: str) -> str:
    """Normalise a position label for fuzzy matching."""
    s = re.sub(r"\*+", "", str(s)).strip()
    s = re.sub(r"\s*\([^)]*\)", "", s).strip().lower()
    return _ABBREV_MAP.get(s, s)


# ── Parser ────────────────────────────────────────────────────────────────────

def parse_mutaties_source(file_bytes: bytes, filename: str = "") -> dict:
    """
    Parse a dienstroooster (tomorrow's file) and return:
    {
        "date":       date | None,
        "is_weekend": bool,
        "shifts": {
            normalized_position: {
                "vroeg": ["NAME", ...],
                "dag":   ["NAME", ...],
                "laat":  ["NAME", ...],
            },
            ...
        },
        "nacht": {
            normalized_nacht_role: "NAME",
            ...
        }
    }
    """
    wb = open_workbook(file_bytes, filename)
    result: dict = {"date": None, "is_weekend": False, "shifts": {}, "nacht": {}}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]

        # Parse date from sheet name (e.g. "vrijdag_12_6_2026")
        m = re.search(r"(\d{1,2})[_/\-](\d{1,2})[_/\-](\d{4})", sheet_name)
        if m:
            try:
                d = Date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                result["date"] = d
                result["is_weekend"] = d.weekday() >= 5
            except ValueError:
                pass

        # Find header row: must contain "dienst" and at least "vroege" or "dag"
        header_row_idx = None
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), 1):
            rl = [str(c).lower().strip() if c else "" for c in row]
            if "dienst" in rl and any(v in rl for v in ("vroege", "vroeg", "dag", "late")):
                header_row_idx = i
                break
        if header_row_idx is None:
            continue

        # Determine column indices from header
        hdr = [str(c).lower().strip() if c else "" for c in next(
            ws.iter_rows(min_row=header_row_idx, max_row=header_row_idx, values_only=True)
        )]
        idx = {h: i for i, h in enumerate(hdr) if h}

        col_dienst    = idx.get("dienst", 0)
        col_vroeg     = idx.get("vroege", idx.get("vroeg", 2))
        col_dag       = idx.get("dag", 4)
        col_laat      = idx.get("late", idx.get("laat", 6))
        col_nacht_pos = idx.get("nachtdienst", idx.get("nacht", 8))
        col_nacht_nm  = col_nacht_pos + 2   # name is 2 cols right of the label column

        # Also scan col 12+ for a date cell as fallback ("Vrijdag 12/6/2026")
        if result["date"] is None:
            for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
                for cell in row:
                    if cell and isinstance(cell, str):
                        dm = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", cell)
                        if dm:
                            try:
                                d = Date(int(dm.group(3)), int(dm.group(2)), int(dm.group(1)))
                                result["date"] = d
                                result["is_weekend"] = d.weekday() >= 5
                            except ValueError:
                                pass

        def _cell(row, cidx: int) -> str:
            return str(row[cidx]).strip() if cidx < len(row) and row[cidx] is not None else ""

        nacht_done = False
        last_pk: str | None = None

        for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
            if row is None:
                continue

            # ── Left section: regular shift assignments ───────────────────────
            dienst = _cell(row, col_dienst)
            if dienst:
                pk = norm_pos(dienst)
                last_pk = pk
                # Always register the position (even unstaffed), so exact-name
                # matches in the template beat fuzzy matches to similar positions.
                if pk not in result["shifts"]:
                    result["shifts"][pk] = {"vroeg": [], "dag": [], "laat": []}
            elif last_pk:
                # Continuation row: col A is blank but staff data may still be
                # present (dienstroooster uses blank rows for 2nd/3rd person).
                pk = last_pk
            else:
                pk = None

            if pk:
                vroeg = strip_name_prefix(_cell(row, col_vroeg)) or None
                dag   = strip_name_prefix(_cell(row, col_dag))   or None
                laat  = strip_name_prefix(_cell(row, col_laat))  or None

                if vroeg: result["shifts"][pk]["vroeg"].append(vroeg)
                if dag:   result["shifts"][pk]["dag"].append(dag)
                if laat:  result["shifts"][pk]["laat"].append(laat)

            # ── Right section: nacht assignments ─────────────────────────────
            if not nacht_done:
                nacht_pos = _cell(row, col_nacht_pos)
                if nacht_pos:
                    nl = nacht_pos.lower()
                    # Sentinel: "COURANTE AFWEZIGHEDEN" signals end of nacht section
                    if any(kw in nl for kw in ("courante", "verlof", "afwez")):
                        nacht_done = True
                    else:
                        nacht_nm = strip_name_prefix(_cell(row, col_nacht_nm)) or None
                        if nacht_nm:
                            result["nacht"][nacht_pos.strip().lower()] = nacht_nm

        break  # Only process first data sheet

    return result
