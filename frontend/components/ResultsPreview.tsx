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
      // Prefer filename from Content-Disposition header, fall back to result.filename
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
    } catch (e) {
      alert("Download mislukt. Probeer opnieuw.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Download */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
        <p className="text-green-800 dark:text-green-300 font-semibold text-lg mb-1">
          Dispatchlijst gegenereerd
        </p>
        <p className="text-green-600 dark:text-green-400 text-sm mb-4">{result.filename}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg px-5 py-3 text-sm transition"
          >
            ← Terug
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-block bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold rounded-lg px-6 py-3 text-sm transition cursor-pointer"
          >
            {downloading ? "Bezig met downloaden..." : "Download XLSX"}
          </button>
        </div>
      </div>

      {/* Corrections */}
      {result.corrections.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Celnummer-correcties ({result.corrections.length})
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-100 dark:bg-blue-900/40">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 dark:text-blue-300">Naam</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 dark:text-blue-300">Voornaam</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 dark:text-blue-300">Cel (ingevoerd)</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 dark:text-blue-300">Cel (gecorrigeerd)</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800 dark:text-blue-300">Bron</th>
                </tr>
              </thead>
              <tbody>
                {result.corrections.map((c, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-blue-50 dark:bg-blue-900/10"
                    }
                  >
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{c.naam}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{c.voornaam}</td>
                    <td className="px-3 py-1.5 text-orange-600 dark:text-orange-400">{c.original_celnr ?? "—"}</td>
                    <td className="px-3 py-1.5 text-green-700 dark:text-green-400 font-medium">{c.corrected_celnr}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Unmatched */}
      {result.unmatched.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Niet gevonden in celbezetting ({result.unmatched.length})
          </h3>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-orange-100 dark:bg-orange-900/40">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800 dark:text-orange-300">Naam</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800 dark:text-orange-300">Voornaam</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800 dark:text-orange-300">Celnr</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800 dark:text-orange-300">Bron</th>
                </tr>
              </thead>
              <tbody>
                {result.unmatched.map((u, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-orange-50 dark:bg-orange-900/10"
                    }
                  >
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{u.naam}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{u.voornaam ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">{u.celnr ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{u.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.corrections.length === 0 && result.unmatched.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
          Geen correcties of waarschuwingen.
        </p>
      )}

      <div className="text-center pt-2">
        <button
          onClick={onReset}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        >
          Nieuwe lijst starten
        </button>
      </div>
    </div>
  );
}
