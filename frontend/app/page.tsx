"use client";
import { useEffect, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import { VERSION } from "@/lib/version";
import { fireConfetti } from "@/lib/confetti";
import DropZone from "@/components/DropZone";
import ManualEntryTable from "@/components/ManualEntryTable";
import ResultsPreview from "@/components/ResultsPreview";
import {
  createSession,
  uploadCelbezetting,
  uploadDispatch,
  removeDispatch,
  uploadPaleislijst,
  generate,
} from "@/lib/api";
import { ManualRow, DispatchFile, GenerateResult } from "@/lib/types";
import HelpModal from "@/components/HelpModal";

const LOADING_MESSAGES = [
  "Cellen worden gecheckt…",
  "Gedetineerden worden gesorteerd…",
  "Celnummers worden gecorrigeerd…",
  "Bestemmingen worden opgezocht…",
  "Secties worden ingedeeld…",
  "Lijsten worden opgesteld…",
  "Bijna klaar…",
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [celFile, setCelFile] = useState<string | null>(null);
  const [celCount, setCelCount] = useState<number | null>(null);
  const [dispatchFiles, setDispatchFiles] = useState<DispatchFile[]>([]);
  const [paleisFile, setPaleisFile] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("dispatch_auth") === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed && !sessionId) {
      createSession().then(setSessionId).catch(() => setError("Sessie aanmaken mislukt"));
    }
  }, [authed, sessionId]);

  async function handleCelbezetting(files: File[]) {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await uploadCelbezetting(sessionId, files[0]);
      setCelFile(files[0].name);
      setCelCount(data.count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDispatch(files: File[], category: "dispatch" | "agenda" | "bezoek" = "dispatch") {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      for (const file of files) {
        const data = await uploadDispatch(sessionId, file);
        setDispatchFiles((prev) => [
          ...prev,
          { filename: file.name, rows: data.rows, index: prev.length, category },
        ]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveDispatch(index: number) {
    if (!sessionId) return;
    try {
      await removeDispatch(sessionId, index);
      setDispatchFiles((prev) => {
        const next = prev.filter((_, i) => i !== index);
        return next.map((f, i) => ({ ...f, index: i }));
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handlePaleislijst(files: File[]) {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      await uploadPaleislijst(sessionId, files[0]);
      setPaleisFile(files[0].name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!sessionId) return;
    setLoading(true);
    setLoadingMsg(LOADING_MESSAGES[0]);
    setError(null);

    let msgIdx = 0;
    loadingTimerRef.current = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    try {
      const entries = manualRows
        .filter((r) => r.naam.trim())
        .map((r) => ({
          uur: r.uur || null,
          celnr: r.celnr ? parseInt(r.celnr) : null,
          naam: r.naam,
          voornaam: r.voornaam || null,
          bestemming: r.bestemming,
        }));
      const data = await generate(sessionId, entries, targetDate);
      setResult(data);
      fireConfetti();
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      setLoading(false);
    }
  }

  function reset() {
    setSessionId(null);
    setCelFile(null);
    setCelCount(null);
    setDispatchFiles([]);
    setPaleisFile(null);
    setManualRows([]);
    setResult(null);
    setError(null);
    createSession().then(setSessionId);
  }

  if (!authed) {
    return <AuthGate onAuth={() => setAuthed(true)} />;
  }

  // ── Results page ─────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080C14] pt-10">
        <div className="relative">
          {/* Hero image */}
          <div className="relative overflow-hidden" style={{ height: "82vh", minHeight: "520px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-prison.PNG" alt=""
              className="absolute inset-0 w-full h-full object-cover object-center" />
            {/* Top vignette + blue tint */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(8,12,20,0.55) 0%, transparent 45%)" }} />
            {/* Title */}
            <div className="absolute inset-x-0 text-center" style={{ top: "22%" }}>
              <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-white/50 mb-2">
                Intern systeem
              </p>
              <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)]">
                Dispatch Generator
              </h1>
            </div>
          </div>

          {/* Bottom gradient — spills behind cards */}
          <div className="absolute inset-x-0 opacity-100 dark:opacity-0 pointer-events-none transition-opacity duration-300"
            style={{ top: "calc(82vh * 0.30)", height: "calc(82vh * 0.70 + 11rem)", background: "linear-gradient(to top, #F8FAFC 0%, #F8FAFC 38%, transparent 85%)" }} />
          <div className="absolute inset-x-0 opacity-0 dark:opacity-100 pointer-events-none transition-opacity duration-300"
            style={{ top: "calc(82vh * 0.30)", height: "calc(82vh * 0.70 + 11rem)", background: "linear-gradient(to top, #080C14 0%, #080C14 38%, transparent 85%)" }} />

          {/* Cards */}
          <div className="relative -mt-44 px-4 pb-6">
            <div className="max-w-4xl mx-auto">
              <ResultsPreview result={result} onBack={() => setResult(null)} onReset={reset} />
            </div>
          </div>
        </div>

        <Footer onHelp={() => setShowHelp(true)} />
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  // ── Upload page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080C14] pt-10">
      <div className="relative">
        {/* Hero image */}
        <div className="relative overflow-hidden" style={{ height: "68vh", minHeight: "440px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-aerial.PNG" alt=""
            className="absolute inset-0 w-full h-full object-cover object-center" />
          {/* Top vignette */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(8,12,20,0.5) 0%, transparent 40%)" }} />
          {/* Title */}
          <div className="absolute inset-x-0 text-center" style={{ top: "20%" }}>
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-white/50 mb-2">
              Intern systeem
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)]">
              Dispatch Generator
            </h1>
          </div>
        </div>

        {/* Bottom gradient — spills behind cards */}
        <div className="absolute inset-x-0 opacity-100 dark:opacity-0 pointer-events-none transition-opacity duration-300"
          style={{ top: "calc(68vh * 0.30)", height: "calc(68vh * 0.70 + 9rem)", background: "linear-gradient(to top, #F8FAFC 0%, #F8FAFC 38%, transparent 85%)" }} />
        <div className="absolute inset-x-0 opacity-0 dark:opacity-100 pointer-events-none transition-opacity duration-300"
          style={{ top: "calc(68vh * 0.30)", height: "calc(68vh * 0.70 + 9rem)", background: "linear-gradient(to top, #080C14 0%, #080C14 38%, transparent 85%)" }} />

        {/* Cards */}
        <div className="relative -mt-36 px-4 pb-6">
          <div className="max-w-4xl mx-auto space-y-4">

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-400/20 rounded-xl px-5 py-3.5">
                <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-400/20 flex items-center justify-center text-red-500 text-xs font-bold flex-shrink-0">!</span>
                <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none transition">×</button>
              </div>
            )}

            {/* Step 1 — Celbezetting */}
            <Card step="1" title="Celbezetting" required>
              {celFile ? (
                <FileSuccess
                  name={celFile}
                  meta={`${celCount} gedetineerden geladen`}
                  onReplace={() => { setCelFile(null); setCelCount(null); }}
                />
              ) : (
                <DropZone label="Upload celbezetting (.xlsx)" onFiles={handleCelbezetting}
                  uploading={loading} disabled={loading} />
              )}
            </Card>

            {/* Step 2 — Dispatch */}
            <Card step="2" title="Dispatch-bestanden" required
              badge={dispatchFiles.filter(f => f.category === "dispatch").length}>
              <DropZone label="Upload dispatch-bestanden (.xlsx)" multiple
                onFiles={(f) => handleDispatch(f, "dispatch")} uploading={loading} disabled={loading || !celFile} />
              <FileList files={dispatchFiles.filter(f => f.category === "dispatch")} onRemove={handleRemoveDispatch} />
            </Card>

            {/* Step 3 — Agenda */}
            <Card step="3" title="Agenda / Hoorzitting"
              badge={dispatchFiles.filter(f => f.category === "agenda").length}>
              <DropZone label="Upload agenda- of hoorzittingsbestand (.xlsx)" multiple
                onFiles={(f) => handleDispatch(f, "agenda")} uploading={loading} disabled={loading || !celFile} />
              <FileList files={dispatchFiles.filter(f => f.category === "agenda")} onRemove={handleRemoveDispatch} />
            </Card>

            {/* Step 4 — Bezoek */}
            <Card step="4" title="Gereserveerde bezoeken"
              badge={dispatchFiles.filter(f => f.category === "bezoek").length}>
              <DropZone label="Upload bezoekbestand (.xlsx / .pdf)" multiple accept=".xlsx,.xls,.pdf"
                onFiles={(f) => handleDispatch(f, "bezoek")} uploading={loading} disabled={loading || !celFile} />
              <FileList files={dispatchFiles.filter(f => f.category === "bezoek")} onRemove={handleRemoveDispatch} />
            </Card>

            {/* Step 5 — Paleislijst */}
            <Card step="5" title="Paleislijst">
              {paleisFile ? (
                <FileSuccess name={paleisFile} onReplace={() => setPaleisFile(null)} />
              ) : (
                <DropZone label="Upload paleislijst (.xlsx)" onFiles={handlePaleislijst}
                  uploading={loading} disabled={loading || !celFile} />
              )}
            </Card>

            {/* Step 6 — Manual entries */}
            <Card step="6" title="Manuele invoer">
              <ManualEntryTable sessionId={sessionId} rows={manualRows} onChange={setManualRows} />
            </Card>

            {/* Step 7 — Date + Generate */}
            <Card step="7" title="Datum en genereren" required>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Datum dispatchlijst
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ focusRingColor: "rgba(61,124,247,0.4)" } as React.CSSProperties}
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !celFile || dispatchFiles.length === 0}
                  className="relative flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)",
                    boxShadow: (!loading && celFile && dispatchFiles.length > 0)
                      ? "0 0 24px rgba(61,124,247,0.4), 0 4px 16px rgba(0,0,0,0.2)"
                      : "none",
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="w-3.5 h-3.5 spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                        <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                      </svg>
                      {loadingMsg}
                    </>
                  ) : (
                    <>
                      Genereer dispatchlijst
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              {(!celFile || dispatchFiles.length === 0) && (
                <p className="text-xs text-slate-400 dark:text-slate-600 mt-3">
                  Upload eerst de celbezetting en minstens één dispatch-bestand.
                </p>
              )}
            </Card>

          </div>
        </div>
      </div>

      <Footer onHelp={() => setShowHelp(true)} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({
  step,
  title,
  required = false,
  badge,
  children,
}: {
  step: string;
  title: string;
  required?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span
          className="flex-shrink-0 w-7 h-7 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm"
          style={{ background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)" }}
        >
          {step}
        </span>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h2 className="font-semibold text-slate-800 dark:text-white text-[15px] leading-snug">
            {title}
          </h2>
          {required && (
            <span className="text-[10px] font-semibold text-red-400 border border-red-400/35 rounded-full px-2 py-px leading-tight">
              verplicht
            </span>
          )}
          {badge !== undefined && badge > 0 && (
            <span
              className="text-white text-[11px] font-bold px-2.5 py-px rounded-full"
              style={{ background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)" }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function FileSuccess({
  name,
  meta,
  onReplace,
}: {
  name: string;
  meta?: string;
  onReplace: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-400/[0.06] border border-emerald-100 dark:border-emerald-400/20 rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate">{name}</p>
          {meta && <p className="text-xs text-emerald-600 dark:text-emerald-500">{meta}</p>}
        </div>
      </div>
      <button
        onClick={onReplace}
        className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 font-medium ml-3 flex-shrink-0 transition"
      >
        Vervangen
      </button>
    </div>
  );
}

function FileList({
  files,
  onRemove,
}: {
  files: DispatchFile[];
  onRemove: (index: number) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {files.map((f) => (
        <li
          key={f.index}
          className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-xl px-4 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-1 h-5 rounded-full flex-shrink-0"
              style={{ background: "linear-gradient(180deg, #3D7CF7, #8B5CF6)" }} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{f.filename}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{f.rows} rijen</p>
            </div>
          </div>
          <button
            onClick={() => onRemove(f.index)}
            className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 text-lg leading-none ml-3 flex-shrink-0 transition"
            title="Verwijderen"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function Footer({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="text-center py-8 flex flex-col items-center gap-2">
      <button
        onClick={onHelp}
        className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
        style={{ color: "#3D7CF7" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        hoe het werkt
      </button>
      <p className="text-xs text-slate-300 dark:text-slate-700">v{VERSION}</p>
    </div>
  );
}
