from __future__ import annotations
import os
import sys
import uuid
import json
import shutil
import logging
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import Optional

# ── Ensure imports always resolve from this file's directory (backend/) ───────
# This makes the app startable from ANY working directory (repo root, etc.)
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from models import GenerateRequest, GenerateResponse, ManualEntry
from parsers.celbezetting import parse_celbezetting
from parsers.dispatch import parse_dispatch
from parsers.paleislijst import parse_paleislijst
from matcher import match_and_correct, enrich_manual_entries
from sorter import build_tabs
from excel_writer import generate_workbook, dutch_date_filename
from rapidfuzz import process, fuzz
from dateutil.easter import easter

log.info("✅ All modules imported successfully")


# ── Belgian public holiday detection ─────────────────────────────────────────

def _belgian_holidays(year: int) -> set[date]:
    e = easter(year)
    return {
        date(year, 1,  1),           # Nieuwjaar
        e + timedelta(days=1),       # Paasmaandag
        date(year, 5,  1),           # Dag van de Arbeid
        e + timedelta(days=39),      # Hemelvaartsdag
        e + timedelta(days=50),      # Pinkstermaandag
        date(year, 7, 21),           # Nationale feestdag
        date(year, 8, 15),           # OLV Hemelvaart
        date(year, 11,  1),          # Allerheiligen
        date(year, 11, 11),          # Wapenstilstand
        date(year, 12, 25),          # Kerstmis
    }


def _is_weekend_or_holiday(d: date) -> bool:
    """True for Saturday, Sunday, or Belgian public holiday."""
    return d.weekday() >= 5 or d in _belgian_holidays(d.year)

app = FastAPI(title="Dispatch Generator", version="1.0.0")

_ALLOWED_ORIGINS = [
    "https://dispatch.tmstry.com",
    "https://dispatch-olive.vercel.app",
    "https://dispatch-zy1l.onrender.com",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store ───────────────────────────────────────────────────
# { session_id: { "celbezetting": {...}, "dispatch_files": [...], "paleislijst": [...] } }
_sessions: dict[str, dict] = {}
_jobs: dict[str, dict] = {}  # job_id → {"bytes": ..., "filename": ...}

TMP_DIR = Path("/tmp/dispatch_sessions")
TMP_DIR.mkdir(parents=True, exist_ok=True)


def _get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessie niet gevonden")
    return _sessions[session_id]


# ── Startup logging ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    routes = [f"{m} {r.path}" for r in app.routes for m in getattr(r, "methods", [""])]
    log.info("🚀 Dispatch backend started. Registered routes:")
    for r in routes:
        log.info("   %s", r)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"app": "Dispatch Generator", "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/session")
def create_session():
    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "celbezetting": None,
        "dispatch_files": [],
        "paleislijst": None,
    }
    return {"session_id": sid}


@app.post("/session/{session_id}/celbezetting")
async def upload_celbezetting(session_id: str, file: UploadFile = File(...)):
    session = _get_session(session_id)
    raw = await file.read()
    try:
        result = parse_celbezetting(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Fout bij verwerking celbezetting: {e}")
    session["celbezetting"] = result
    count = len(result.get("autocomplete", []))
    return {"status": "ok", "count": count, "filename": file.filename}


@app.post("/session/{session_id}/dispatch")
async def upload_dispatch(session_id: str, file: UploadFile = File(...)):
    session = _get_session(session_id)
    raw = await file.read()
    source_name = file.filename or "dispatch"
    try:
        rows = parse_dispatch(raw, source_name=source_name)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Fout bij verwerking dispatch-bestand: {e}")
    session["dispatch_files"].append({"filename": source_name, "rows": rows})
    return {"status": "ok", "rows": len(rows), "filename": source_name}


@app.delete("/session/{session_id}/dispatch/{index}")
def remove_dispatch(session_id: str, index: int):
    session = _get_session(session_id)
    files = session["dispatch_files"]
    if index < 0 or index >= len(files):
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    removed = files.pop(index)
    return {"status": "ok", "removed": removed["filename"]}


@app.post("/session/{session_id}/paleislijst")
async def upload_paleislijst(session_id: str, file: UploadFile = File(...)):
    session = _get_session(session_id)
    raw = await file.read()
    try:
        rows = parse_paleislijst(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Fout bij verwerking paleislijst: {e}")
    session["paleislijst"] = rows
    return {"status": "ok", "rows": len(rows), "filename": file.filename}


@app.get("/session/{session_id}/autocomplete")
def autocomplete(session_id: str, q: str = ""):
    session = _get_session(session_id)
    cel_data = session.get("celbezetting")
    if not cel_data or not q.strip():
        return {"results": []}

    from parsers.normalizer import normalize_name
    q_norm = normalize_name(q)
    autocomplete_list = cel_data.get("autocomplete", [])

    results = []
    for record in autocomplete_list:
        key = record["key"]
        if q_norm in key:
            results.append({
                "naam": record["naam"],
                "voornaam": record["voornaam"],
                "cel": record["cel"],
                "label": f"{record['naam']} — {record['voornaam']} — {record['cel']}",
            })
        if len(results) >= 10:
            break

    # Fuzzy fallback if exact substring finds too little
    if len(results) < 3 and autocomplete_list:
        all_keys = [r["key"] for r in autocomplete_list]
        fuzzy = process.extract(q_norm, all_keys, scorer=fuzz.partial_ratio, limit=8, score_cutoff=70)
        seen_keys = {r["key"] for r in results}
        key_to_record = {r["key"]: r for r in autocomplete_list}
        for match_key, score, _ in fuzzy:
            if match_key not in seen_keys:
                rec = key_to_record.get(match_key)
                if rec:
                    results.append({
                        "naam": rec["naam"],
                        "voornaam": rec["voornaam"],
                        "cel": rec["cel"],
                        "label": f"{rec['naam']} — {rec['voornaam']} — {rec['cel']}",
                    })
                    seen_keys.add(match_key)

    return {"results": results[:10]}


@app.post("/session/{session_id}/generate")
async def generate(session_id: str, request: GenerateRequest):
    session = _get_session(session_id)

    cel_data = session.get("celbezetting")
    if not cel_data:
        raise HTTPException(status_code=422, detail="Geen celbezetting geüpload")

    dispatch_files = session.get("dispatch_files", [])
    if not dispatch_files and not request.manual_entries:
        raise HTTPException(status_code=422, detail="Geen dispatch-bestanden of manuele invoer")

    # Parse target date first — needed to resolve keuken dual-time rows
    try:
        target_date = date.fromisoformat(request.target_date)
    except ValueError:
        target_date = date.today()

    use_weekend = _is_weekend_or_holiday(target_date)
    log.info("Target date: %s | weekend/feestdag: %s", target_date, use_weekend)

    # Collect all rows
    all_rows: list[dict] = []
    for df in dispatch_files:
        all_rows.extend(df["rows"])

    pal = session.get("paleislijst")
    if pal:
        all_rows.extend(pal)

    manual_rows = enrich_manual_entries(
        [e.model_dump() for e in request.manual_entries],
        cel_data,
    )
    all_rows.extend(manual_rows)

    # Resolve keuken dual-time rows: pick weekday or weekend column
    for row in all_rows:
        if row.get("dual_uur"):
            row["uur"] = row["uur_we"] if use_weekend else row["uur_wd"]

    # Match against celbezetting
    matched, corrections, unmatched = match_and_correct(all_rows, cel_data)

    # Build tabs
    tabs = build_tabs(matched)

    # Generate workbook
    wb = generate_workbook(tabs, target_date)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    xlsx_bytes = buf.read()

    job_id = str(uuid.uuid4())
    filename = dutch_date_filename(target_date)
    _jobs[job_id] = {"bytes": xlsx_bytes, "filename": filename}

    return GenerateResponse(
        job_id=job_id,
        filename=filename,
        corrections=corrections,
        warnings=[
            f"Geen celbezetting gevonden voor: {u.naam} {u.voornaam or ''} (cel {u.celnr}, bron: {u.source})"
            for u in unmatched
        ],
        unmatched=unmatched,
    )


@app.get("/download/{job_id}")
def download(job_id: str):
    from urllib.parse import quote
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download niet gevonden of verlopen")
    filename = job["filename"]
    # RFC 5987: supports full Unicode filenames (Donderdag 14 Mei 2026.xlsx etc.)
    encoded = quote(filename, safe="")
    return StreamingResponse(
        BytesIO(job["bytes"]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded}",
            "X-Filename": filename,
        },
    )
