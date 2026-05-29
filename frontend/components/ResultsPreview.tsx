"use client";
import { useState } from "react";
import { GenerateResult } from "@/lib/types";
import { downloadUrl } from "@/lib/api";

interface Props {
  result: GenerateResult;
  onBack: () => void;
  onReset: () => void;
}

export default function ResultsPreview({ result, onBack, onReset }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl(result.job_id));
      if (!res.ok) throw new Error("Download mislukt");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="([^"]+)"/i);
      const xFilename = res.headers.get("X-Filename");
      const filename =
        utf8Match ? decodeURIComponent(utf8Match[1])
        : xFilename ? xFilename
        : plainMatch ? plainMatch[1]
        : result.filename;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download mislukt. Probeer opnieuw.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Success + download ─────────────────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Gradient header stripe */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #3D7CF7 0%, #8B5CF6 50%, #10B981 100%)" }}
        />
        <div className="p-8 text-center">
          {/* Checkmark */}
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            Lijst gegenereerd
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-mono">
            {result.filename}
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(248,250,252,0.8)",
                color: "#475569",
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Terug
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #3D7CF7 0%, #8B5CF6 100%)",
                boxShadow: downloading ? "none" : "0 0 20px rgba(61,124,247,0.35), 0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {downloading ? (
                <>
                  <svg className="w-3.5 h-3.5 spin" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                  </svg>
                  Downloaden…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download XLSX
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Corrections ──────────────────────────────────────────────────── */}
      {result.corrections.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Celnummer-correcties
              <span className="ml-2 text-xs font-bold text-white px-2 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg, #3D7CF7, #8B5CF6)" }}>
                {result.corrections.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.05]">
                  {["Naam", "Voornaam", "Ingevoerd", "Gecorrigeerd", "Bron"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.corrections.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{c.naam}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{c.voornaam}</td>
                    <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400 font-mono">{c.original_celnr ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{c.corrected_celnr}</td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Unmatched ────────────────────────────────────────────────────── */}
      {result.unmatched.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Niet gevonden in celbezetting
              <span className="ml-2 text-xs font-bold text-white px-2 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}>
                {result.unmatched.length}
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.05]">
                  {["Naam", "Voornaam", "Celnr", "Bron"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.unmatched.map((u, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{u.naam}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{u.voornaam ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">{u.celnr ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500">{u.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.corrections.length === 0 && result.unmatched.length === 0 && (
        <div className="glass rounded-2xl px-6 py-5 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Geen correcties of waarschuwingen — alles klopt.
          </p>
        </div>
      )}

      <div className="text-center pt-1">
        <button
          onClick={onReset}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition underline underline-offset-2"
        >
          Nieuwe lijst starten
        </button>
      </div>
    </div>
  );
}
