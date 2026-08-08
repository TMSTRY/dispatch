"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { VERSION } from "@/lib/version";
import { fireConfetti } from "@/lib/confetti";
import DropZone from "@/components/DropZone";
import ManualEntryTable from "@/components/ManualEntryTable";
import ResultsPreview from "@/components/ResultsPreview";
import {
  SessionExpiredError,
  createSessionWithRetry,
  uploadCelbezetting,
  uploadDispatch,
  removeDispatch,
  uploadPaleislijst,
  generate,
} from "@/lib/api";
import { ManualRow, DispatchFile, GenerateResult } from "@/lib/types";
import HelpModal from "@/components/HelpModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { beschrijfDatum } from "@/lib/datum";

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
  const [waking, setWaking] = useState(false);
  const [wakeSeconds, setWakeSeconds] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel?: string;
    tone?: "danger" | "normal"; onConfirm: () => void;
  } | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // De backend bewaart sessies alleen in het geheugen. Slaapt of herstart
  // Render tussendoor, dan is alles wat al geüpload was verdwenen. We houden
  // de bestanden daarom hier bij, zodat we ze bij verlies stil opnieuw kunnen
  // versturen zonder dat de gebruiker werk kwijt is.
  const uploadedRef = useRef<{
    cel: File | null;
    dispatch: { file: File; category: "dispatch" | "agenda" | "bezoek" }[];
    paleis: File | null;
  }>({ cel: null, dispatch: [], paleis: null });

  // Spiegelt sessionId, maar dan synchroon. Nodig omdat een herstel midden in
  // een reeks uploads anders niet zichtbaar is in de closure van de lopende
  // functie — elk volgend bestand zou dan opnieuw een herstel uitlokken.
  const sessionIdRef = useRef<string | null>(null);
  const applySessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  // Backend wekken. Slaapt de Render-instantie, dan duurt het eerste verzoek
  // makkelijk 50s; we blijven proberen en tonen de voortgang in plaats van
  // meteen een fout te geven (voorheen moest je zelf blijven verversen).
  const startSession = useCallback(() => {
    setWaking(true);
    setWakeSeconds(0);
    setError(null);
    createSessionWithRetry()
      .then((id) => { applySessionId(id); setError(null); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Sessie aanmaken mislukt"))
      .finally(() => setWaking(false));
  }, [applySessionId]);

  // Deze pagina rendert alleen na authenticatie (zie AuthProvider), dus we
  // kunnen meteen een sessie opstarten.
  useEffect(() => {
    if (!sessionId && !waking && !error) startSession();
  }, [sessionId, waking, error, startSession]);

  // Secondeteller tijdens het wekken
  useEffect(() => {
    if (!waking) return;
    const t = setInterval(() => setWakeSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [waking]);

  /**
   * Bouwt een verloren sessie opnieuw op: nieuwe sessie aanvragen en alle
   * eerder geüploade bestanden in dezelfde volgorde terugsturen, zodat de
   * indexen van de dispatch-bestanden blijven kloppen.
   */
  const recoverSession = useCallback(async (): Promise<string> => {
    setRecovering(true);
    try {
      const id = await createSessionWithRetry();
      const snap = uploadedRef.current;
      if (snap.cel) await uploadCelbezetting(id, snap.cel);
      for (const d of snap.dispatch) await uploadDispatch(id, d.file);
      if (snap.paleis) await uploadPaleislijst(id, snap.paleis);
      applySessionId(id);
      setRecovered(true);
      setTimeout(() => setRecovered(false), 6000);
      return id;
    } finally {
      setRecovering(false);
    }
  }, [applySessionId]);

  /**
   * Voert een actie uit tegen de huidige sessie. Blijkt die verlopen, dan
   * wordt ze eerst hersteld en daarna de actie opnieuw geprobeerd — de
   * gebruiker merkt er alleen een korte melding van.
   */
  const withSession = useCallback(
    async <T,>(fn: (sid: string) => Promise<T>): Promise<T> => {
      const sid = sessionIdRef.current;
      if (!sid) throw new Error("Nog geen verbinding met de server.");
      try {
        return await fn(sid);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          const freshId = await recoverSession();
          return await fn(freshId);
        }
        throw e;
      }
    },
    [recoverSession],
  );

  async function handleCelbezetting(files: File[]) {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await withSession((sid) => uploadCelbezetting(sid, files[0]));
      uploadedRef.current.cel = files[0];
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

    // Hetzelfde bestand twee keer opladen is 's nachts zo gebeurd en levert
    // dubbele rijen op. Even laten bevestigen in plaats van stil toevoegen.
    const dubbel = files.filter((f) =>
      uploadedRef.current.dispatch.some((d) => d.file.name === f.name),
    );
    if (dubbel.length) {
      setConfirmDialog({
        title: dubbel.length === 1 ? "Dit bestand staat er al" : "Deze bestanden staan er al",
        message:
          `${dubbel.map((f) => f.name).join(", ")} — al eerder toegevoegd. ` +
          "Opnieuw toevoegen kan dubbele rijen op de dispatchlijst geven.",
        confirmLabel: "Toch toevoegen",
        onConfirm: () => { setConfirmDialog(null); void doDispatchUpload(files, category); },
      });
      return;
    }
    await doDispatchUpload(files, category);
  }

  async function doDispatchUpload(files: File[], category: "dispatch" | "agenda" | "bezoek") {
    setLoading(true);
    setError(null);
    try {
      for (const file of files) {
        const data = await withSession((sid) => uploadDispatch(sid, file));
        uploadedRef.current.dispatch.push({ file, category });
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
      await withSession((sid) => removeDispatch(sid, index));
      uploadedRef.current.dispatch.splice(index, 1);
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
      await withSession((sid) => uploadPaleislijst(sid, files[0]));
      uploadedRef.current.paleis = files[0];
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
      const data = await withSession((sid) => generate(sid, entries, targetDate));
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
    setConfirmDialog({
      title: "Nieuwe lijst starten?",
      message:
        "Alle geüploade bestanden en je manuele invoer worden gewist. " +
        "Dit kan niet ongedaan gemaakt worden.",
      confirmLabel: "Ja, opnieuw beginnen",
      tone: "danger",
      onConfirm: () => { setConfirmDialog(null); doReset(); },
    });
  }

  function doReset() {
    uploadedRef.current = { cel: null, dispatch: [], paleis: null };
    applySessionId(null);
    setCelFile(null);
    setCelCount(null);
    setDispatchFiles([]);
    setPaleisFile(null);
    setManualRows([]);
    setResult(null);
    setError(null);
    startSession();
  }

  const datum = beschrijfDatum(targetDate);
  const totaalRijen = dispatchFiles.reduce((n, f) => n + f.rows, 0);
  const manueleRijen = manualRows.filter((r) => r.naam.trim()).length;

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
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          tone={confirmDialog.tone}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
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

            {/* Wek-banner — de gratis Render-instantie slaapt na inactiviteit */}
            {waking && (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-100 dark:border-amber-400/20 rounded-xl px-5 py-3.5">
                <svg className="w-5 h-5 spin flex-shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Server wordt gewekt… {wakeSeconds}s
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                    De backend slaapt na inactiviteit en heeft ongeveer een minuut nodig. Even wachten volstaat — verversen is niet nodig.
                  </p>
                </div>
              </div>
            )}

            {/* Sessie verlopen — bestanden worden automatisch teruggezet */}
            {recovering && (
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/[0.08] border border-blue-100 dark:border-blue-400/20 rounded-xl px-5 py-3.5">
                <svg className="w-5 h-5 spin flex-shrink-0 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Verbinding met de server hersteld
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5">
                    Je bestanden worden opnieuw geladen — je hoeft niets over te doen.
                  </p>
                </div>
              </div>
            )}

            {/* Herstel gelukt — verdwijnt vanzelf */}
            {recovered && !recovering && (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-100 dark:border-emerald-400/20 rounded-xl px-5 py-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-500 text-xs font-bold flex-shrink-0">✓</span>
                <span className="text-sm text-emerald-700 dark:text-emerald-300 flex-1">
                  Alles staat er terug — je kan gewoon verder.
                </span>
              </div>
            )}

            {/* Sessie klaar — korte bevestiging tot de eerste upload */}
            {!waking && sessionId && !celFile && wakeSeconds > 3 && (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-100 dark:border-emerald-400/20 rounded-xl px-5 py-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-500 text-xs font-bold flex-shrink-0">✓</span>
                <span className="text-sm text-emerald-700 dark:text-emerald-300 flex-1">
                  Server is wakker — je kan beginnen.
                </span>
              </div>
            )}

            {/* Error banner */}
            {error && !waking && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/[0.08] border border-red-100 dark:border-red-400/20 rounded-xl px-5 py-3.5">
                <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-400/20 flex items-center justify-center text-red-500 text-xs font-bold flex-shrink-0">!</span>
                <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
                {!sessionId ? (
                  <button onClick={startSession}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-400/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-400/30 transition flex-shrink-0">
                    Opnieuw proberen
                  </button>
                ) : (
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none transition">×</button>
                )}
              </div>
            )}

            {/* Step 1 — Celbezetting */}
            <Card step="1" title="Celbezetting" required>
              {celFile ? (
                <FileSuccess
                  name={celFile}
                  meta={`${celCount} gedetineerden geladen`}
                  onReplace={() => setConfirmDialog({
                    title: "Celbezetting vervangen?",
                    message: "De stappen hieronder blijven staan, maar je moet eerst een nieuwe celbezetting opladen voor je verder kan.",
                    confirmLabel: "Vervangen",
                    onConfirm: () => {
                      setConfirmDialog(null);
                      uploadedRef.current.cel = null;
                      setCelFile(null);
                      setCelCount(null);
                    },
                  })}
                />
              ) : (
                <DropZone label="Upload celbezetting (.xlsx)" onFiles={handleCelbezetting}
                  uploading={loading} disabled={loading || !sessionId} />
              )}
            </Card>

            {/* Step 2 — Dispatch */}
            <Card step="2" title="Dispatch-bestanden" required
              badge={dispatchFiles.filter(f => f.category === "dispatch").length}>
              <DropZone label="Upload dispatch-bestanden (.xlsx / .pdf)" multiple accept=".xlsx,.xls,.pdf"
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
                <FileSuccess name={paleisFile}
                  onReplace={() => { uploadedRef.current.paleis = null; setPaleisFile(null); }} />
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
              {celFile && dispatchFiles.length > 0 && (
                <div className="mb-5 rounded-xl border border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Klaar om te genereren
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-600 dark:text-slate-300">
                    <span><span className="font-semibold">{celCount}</span> gedetineerden in de celbezetting</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span><span className="font-semibold">{dispatchFiles.length}</span> {dispatchFiles.length === 1 ? "bestand" : "bestanden"}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span><span className="font-semibold">{totaalRijen}</span> rijen</span>
                    {manueleRijen > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span><span className="font-semibold">{manueleRijen}</span> manueel</span>
                      </>
                    )}
                    {paleisFile && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>paleislijst</span>
                      </>
                    )}
                    {datum.geldig && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>voor <span className="font-semibold">{datum.volledig}</span></span>
                      </>
                    )}
                  </div>
                </div>
              )}
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
                  {datum.geldig && (
                    <p className="mt-2 text-xs flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{datum.volledig}</span>
                      {datum.weekendTarief ? (
                        <span className="text-[10px] font-semibold px-2 py-px rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-400/25">
                          {datum.feestdag ?? "weekend"} · weekenduren
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-px rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08]">
                          weekdag
                        </span>
                      )}
                    </p>
                  )}
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
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          tone={confirmDialog.tone}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
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
