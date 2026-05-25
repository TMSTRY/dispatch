from __future__ import annotations
import unicodedata
import re


def normalize_name(s) -> str:
    if not s:
        return ""
    s = str(s).strip().upper()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"['’`]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_cell(c) -> int | None:
    if c is None:
        return None
    s = str(c).strip()
    s = s.split(".")[0]  # handle floats like '522.0'
    if not s or not s.lstrip("0").isdigit() and s != "0":
        try:
            return int(float(s))
        except (ValueError, TypeError):
            return None
    try:
        return int(s)
    except ValueError:
        return None


def normalize_key(naam: str, voornaam: str | None) -> str:
    n = normalize_name(naam)
    v = normalize_name(voornaam) if voornaam else ""
    return f"{n} {v}".strip() if v else n


def get_section(celnr: int | None) -> int | None:
    if celnr is None:
        return None
    if 0 <= celnr <= 57:   # vrouwen; 58-70 is BD (Beperkte Detentie) — no section tab
        return 10
    if 100 <= celnr <= 130:
        return 1
    if 200 <= celnr <= 230:
        return 2
    if 300 <= celnr <= 330:
        return 3
    if 400 <= celnr <= 435:
        return 4
    if 500 <= celnr <= 530:
        return 5
    if 600 <= celnr <= 630:
        return 6
    if 700 <= celnr <= 730:
        return 7
    if 800 <= celnr <= 830:
        return 8
    if 900 <= celnr <= 930:
        return 9
    return None
