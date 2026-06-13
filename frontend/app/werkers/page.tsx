"use client";
import { useState, useRef } from "react";
import { updateWerkers, downloadUrl, type WerkersSummary } from "@/lib/api";
import { VERSION } from "@/lib/version";

function FileZone({
  label,
  sublabel,
  file,
  onFile,
  disabled,
}: {
  label: string;
  sublabel: string;
  file: File | null;
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const f = Array.from(e.dataTransfer.files).find(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"),
    );
    if (f) onFile(f);
  }

  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className={`glass rounded-2xl p-6 cursor-pointer transition-all ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      style={{
        border: drag ? "1.5px dashed #3D7CF7" : undefined,
        boxShadow: drag ? "0 0 0 3px rgba(61,124,247,0.12)" : undefined,
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
        {label}
      </p>
      {file ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-sm">{sublabel}</span>
        </div>
      )}
    </div>
  );
}

function SummaryTable({ summary }: { summary: WerkersSummary }) {
  const hasRemoved = summary.removed.length > 0;
  const hasUpdated = summary.updated.length > 0;

  if (!hasRemoved && !hasUpdated) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
        Geen wijzigingen gevonden in de MUTATIES sheet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasRemoved && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
            Verwijderd ({summary.removed.length})
          </p>
          <div className="rounded-xl overflow-hidden border border-red-400/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-400/10">
                  <th className="text-left px-3 py-2 font-medium text-red-300">Naam</th>
                  <th className="text-left px-3 py-2 font-medium text-red-300">Cel</th>
                </tr>
              </thead>
              <tbody>
                {summary.removed.map((r, i) => (
                  <tr key={i} className="border-t border-red-400/10">
                    <td className="px-3 py-1.5 text-slate-300">{r.naam}</td>
                    <td className="px-3 py-1.5 text-slate-400">{r.cel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasUpdated && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
            Gemuteerd ({summary.updated.length})
          </p>
          <div className="rounded-xl overflow-hidden border border-amber-400/20">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-400/10">
                  <th className="text-left px-3 py-2 font-medium text-amber-300">Naam</th>
                  <th className="text-left px-3 py-2 font-medium text-amber-300">Van cel</th>
                  <th className="text-left px-3 py-2 font-medium text-amber-300">Naar cel</th>
                </tr>
              </thead>
              <tbody>
                {summary.updated.map((u, i) => (
                  <tr key={i} className="border-t border-amber-400/10">
                    <td className="px-3 py-1.5 text-slate-300">{u.naam}</td>
                    <td className="px-3 py-1.5 text-slate-400">{u.van}</td>
                    <td className="px-3 py-1.5 text-slate-400">{u.naar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WerkersPage() {
  const [mutatiesFile, setMutatiesFile] = useState<File | null>(null);
  const [werkersFile,  setWerkersFile]  = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [jobId,     setJobId]     = useState<string | null>(null);
  const [filename,  setFilename]  = useState("");
  const [summary,   setSummary]   = useState<WerkersSummary | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const ready = !!mutatiesFile && !!werkersFile && !loading;

  async function handleGenerate() {
    if (!mutatiesFile || !werkersFile) return;
    setLoading(true);
    setError(null);
    setJobId(null);
    setSummary(null);
    try {
      const res = await updateWerkers(mutatiesFile, werkersFile);
      setJobId(res.job_id);
      setFilename(res.filename);
      setSummary(res.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#080C14] pt-16">
      {/* Hero */}
      <div className="relative" style={{ height: "52vh", minHeight: "360px" }}>
        <img
          src="/hero-aerial.PNG"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ filter: "brightness(0.4)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, #080C14 0%, #080C14 30%, transparent 80%)" }}
        />
        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-10 max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">
            Intern systeem
          </p>
          <h1 className="text-3xl font-bold text-white">Werkerslijst bijwerken</h1>
          <p className="mt-2 text-sm text-slate-400">
            Upload de ingevulde mutatielijst en de huidige werkerslijst — de tool verwijdert uitgaanden,
            past celnummers aan en sorteert opnieuw per sectie.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-2xl mx-auto px-4 -mt-2 pb-20 space-y-4">

        {/* Step 1 */}
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Stap 1 — Upload bestanden
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FileZone
              label="Mutatielijst (ingevuld)"
              sublabel="Sleep of klik · .xlsx"
              file={mutatiesFile}
              onFile={setMutatiesFile}
            />
            <FileZone
              label="Werkerslijst (huidig)"
              sublabel="Sleep of klik · .xlsx"
              file={werkersFile}
              onFile={setWerkersFile}
            />
          </div>
        </div>

        {/* Step 2 */}
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Stap 2 — Verwerk
          </p>
          <button
            onClick={handleGenerate}
            disabled={!ready}
            className="w-full relative overflow-hidden rounded-xl py-3 px-5 font-semibold text-sm text-white transition-all"
            style={{
              background: ready
                ? "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)"
                : "rgba(100,116,139,0.3)",
              boxShadow: ready ? "0 0 24px rgba(61,124,247,0.38)" : "none",
              cursor: ready ? "pointer" : "not-allowed",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 spin" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                Verwerken…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Werkerslijst bijwerken
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </span>
            )}
          </button>
          {(!mutatiesFile || !werkersFile) && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 text-center">
              Upload beide bestanden om verder te gaan.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="glass rounded-2xl p-4 border border-red-400/30 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {jobId && summary && (
          <>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">Klaar</p>
              <a
                href={downloadUrl(jobId)}
                download={filename}
                className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all"
                style={{
                  background: "rgba(52,211,153,0.12)",
                  color: "#34d399",
                  border: "1px solid rgba(52,211,153,0.25)",
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="truncate">{filename}</span>
              </a>
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Overzicht wijzigingen
              </p>
              <SummaryTable summary={summary} />
            </div>
          </>
        )}
      </div>

      <footer className="text-center pb-6 text-xs text-slate-500">v{VERSION}</footer>
    </main>
  );
}
