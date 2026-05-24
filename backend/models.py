from __future__ import annotations
from pydantic import BaseModel
from datetime import time
from typing import Optional


class ManualEntry(BaseModel):
    uur: Optional[str] = None       # "HH:MM" string from frontend
    celnr: Optional[int] = None
    naam: str = ""
    voornaam: Optional[str] = None
    bestemming: str = ""


class CorrectionEntry(BaseModel):
    naam: str
    voornaam: str
    original_celnr: Optional[int]
    corrected_celnr: int
    source: str


class UnmatchedEntry(BaseModel):
    naam: str
    voornaam: Optional[str]
    celnr: Optional[int]
    source: str


class GenerateRequest(BaseModel):
    manual_entries: list[ManualEntry] = []
    target_date: str   # "YYYY-MM-DD"


class GenerateResponse(BaseModel):
    job_id: str
    filename: str
    corrections: list[CorrectionEntry]
    warnings: list[str]
    unmatched: list[UnmatchedEntry]
