"use client";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // Check existing auth
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("dispatch_auth") === "1") {
      setAuthed(true);
    }
  }, []);

  // Create session on auth
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

  async function handleDispatch(files: File[]) {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      for (const file of files) {
        const data = await uploadDispatch(sessionId, file);
        setDispatchFiles((prev) => [
          ...prev,
          { filename: file.name, rows: data.rows, index: prev.length },
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
      const data = await uploadPaleislijst(sessionId, files[0]);
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
    setError(null);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
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

  if (result) {
    return (
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Dispatch Generator</h1>
          <ResultsPreview result={result} onReset={reset} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Dispatch Generator</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 font-bold">×</button>
          </div>
        )}

        {/* Step 1 — Celbezetting */}
        <Card step="1" title="Celbezetting" required>
          {celFile ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-800">{celFile}</p>
                <p className="text-xs text-green-600">{celCount} gedetineerden geladen</p>
              </div>
              <button
                onClick={() => { setCelFile(null); setCelCount(null); }}
                className="text-green-600 hover:text-green-800 text-xs underline"
              >
                Vervangen
              </button>
            </div>
          ) : (
            <DropZone
              label="Upload celbezetting (.xlsx)"
              onFiles={handleCelbezetting}
              uploading={loading}
              disabled={loading}
            />
          )}
        </Card>

        {/* Step 2 — Dispatch files */}
        <Card step="2" title="Dispatch-bestanden" required>
          <DropZone
            label="Upload dispatch-bestanden (.xlsx)"
            multiple
            onFiles={handleDispatch}
            uploading={loading}
            disabled={loading || !celFile}
          />
          {dispatchFiles.length > 0 && (
            <ul className="mt-3 space-y-1">
              {dispatchFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
                  <span className="text-gray-700">{f.filename} <span className="text-gray-400 text-xs">({f.rows} rijen)</span></span>
                  <button
                    onClick={() => handleRemoveDispatch(i)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Verwijder
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Step 3 — Paleislijst */}
        <Card step="3" title="Paleislijst (optioneel)">
          {paleisFile ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-green-800">{paleisFile}</p>
              <button
                onClick={() => setPaleisFile(null)}
                className="text-green-600 hover:text-green-800 text-xs underline"
              >
                Vervangen
              </button>
            </div>
          ) : (
            <DropZone
              label="Upload paleislijst (.xlsx) — optioneel"
              onFiles={handlePaleislijst}
              uploading={loading}
              disabled={loading || !celFile}
            />
          )}
        </Card>

        {/* Step 4 — Manual entries */}
        <Card step="4" title="Manuele invoer (optioneel)">
          <ManualEntryTable
            sessionId={sessionId}
            rows={manualRows}
            onChange={setManualRows}
          />
        </Card>

        {/* Step 5 — Date + Generate */}
        <Card step="5" title="Datum en genereren" required>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Datum dispatchlijst
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || !celFile || dispatchFiles.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition"
            >
              {loading ? "Bezig met genereren..." : "Genereer dispatchlijst"}
            </button>
          </div>
          {(!celFile || dispatchFiles.length === 0) && (
            <p className="text-xs text-gray-400 mt-2">
              Upload eerst de celbezetting en minstens één dispatch-bestand.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}

function Card({
  step,
  title,
  required = false,
  children,
}: {
  step: string;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {step}
        </span>
        <h2 className="font-semibold text-gray-800">
          {title}
          {required && <span className="ml-1 text-red-500 text-xs">*</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}
