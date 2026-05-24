"use client";
import { useState } from "react";
import { GenerateResult } from "@/lib/types";
import { downloadUrl } from "@/lib/api";

interface Props {
  result: GenerateResult;
  onReset: () => void;
}

export default function ResultsPreview({ result, onReset }: Props) {
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
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-800 font-semibold text-lg mb-1">Dispatchlijst gegenereerd</p>
        <p className="text-green-600 text-sm mb-4">{result.filename}</p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-block bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold rounded-lg px-6 py-3 text-sm transition cursor-pointer"
        >
          {downloading ? "Bezig met downloaden..." : "Download XLSX"}
        </button>
      </div>

      {/* Corrections */}
      {result.corrections.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-700 mb-2">
            Celnummer-correcties ({result.corrections.length})
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800">Naam</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800">Voornaam</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800">Cel (ingevoerd)</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800">Cel (gecorrigeerd)</th>
                  <th className="text-left px-3 py-2 font-semibold text-blue-800">Bron</th>
                </tr>
              </thead>
              <tbody>
                {result.corrections.map((c, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                    <td className="px-3 py-1.5">{c.naam}</td>
                    <td className="px-3 py-1.5">{c.voornaam}</td>
                    <td className="px-3 py-1.5 text-orange-600">{c.original_celnr ?? "—"}</td>
                    <td className="px-3 py-1.5 text-green-700 font-medium">{c.corrected_celnr}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{c.source}</td>
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
          <h3 className="font-semibold text-gray-700 mb-2">
            Niet gevonden in celbezetting ({result.unmatched.length})
          </h3>
          <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-orange-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800">Naam</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800">Voornaam</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800">Celnr</th>
                  <th className="text-left px-3 py-2 font-semibold text-orange-800">Bron</th>
                </tr>
              </thead>
              <tbody>
                {result.unmatched.map((u, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-orange-50"}>
                    <td className="px-3 py-1.5">{u.naam}</td>
                    <td className="px-3 py-1.5">{u.voornaam ?? "—"}</td>
                    <td className="px-3 py-1.5">{u.celnr ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{u.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.corrections.length === 0 && result.unmatched.length === 0 && (
        <p className="text-center text-gray-500 text-sm">Geen correcties of waarschuwingen.</p>
      )}

      <div className="text-center pt-2">
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Nieuwe lijst starten
        </button>
      </div>
    </div>
  );
}
