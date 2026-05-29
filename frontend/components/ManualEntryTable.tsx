"use client";
import { useState, useRef } from "react";
import { ManualRow, AutocompleteResult } from "@/lib/types";
import { autocomplete } from "@/lib/api";

interface Props {
  sessionId: string | null;
  rows: ManualRow[];
  onChange: (rows: ManualRow[]) => void;
}

function newRow(): ManualRow {
  return {
    id: Math.random().toString(36).slice(2),
    uur: "",
    celnr: "",
    naam: "",
    voornaam: "",
    bestemming: "",
  };
}

export default function ManualEntryTable({ sessionId, rows, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [celWarnings, setCelWarnings] = useState<Record<string, string>>({});
  const [bulkCount, setBulkCount] = useState(5);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(id: string, field: keyof ManualRow, value: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    if (field === "naam" && sessionId) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (value.trim().length >= 2) {
          const data = await autocomplete(sessionId, value);
          setSuggestions(data.results ?? []);
          setActiveRowId(id);
        } else {
          setSuggestions([]);
        }
      }, 250);
    }
  }

  async function validateCell(row: ManualRow) {
    if (!sessionId || !row.naam || !row.celnr) return;
    const data = await autocomplete(sessionId, row.naam);
    const match = (data.results ?? []).find(
      (r: AutocompleteResult) => r.naam.toUpperCase() === row.naam.toUpperCase()
    );
    if (match && match.cel !== null && String(match.cel) !== row.celnr.trim()) {
      setCelWarnings((prev) => ({
        ...prev,
        [row.id]: `Cel gecorrigeerd: ${row.celnr} → ${match.cel}`,
      }));
    } else {
      setCelWarnings((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
    }
  }

  function applySuggestion(rowId: string, s: AutocompleteResult) {
    onChange(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, naam: s.naam, voornaam: s.voornaam, celnr: String(s.cel ?? "") }
          : r
      )
    );
    setSuggestions([]);
    setActiveRowId(null);
    setCelWarnings((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
  }

  const cellCls =
    "border-b border-slate-100 dark:border-white/[0.05] p-1";

  const inputCls =
    "w-full px-2 py-1 text-sm bg-transparent text-slate-800 dark:text-slate-200 " +
    "placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none " +
    "focus:bg-brand-500/[0.06] dark:focus:bg-brand-500/[0.08] rounded transition";

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse min-w-[560px]">
        <thead>
          <tr>
            {["Uur", "Celnr", "Naam", "Voornaam", "Bestemming", ""].map((h) => (
              <th
                key={h}
                className="border-b border-slate-200 dark:border-white/[0.08] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                <td className={cellCls} style={{ width: "80px" }}>
                  <input value={row.uur} onChange={(e) => update(row.id, "uur", e.target.value)}
                    placeholder="08:00" className={inputCls} />
                </td>
                <td className={cellCls} style={{ width: "72px" }}>
                  <input value={row.celnr} onChange={(e) => update(row.id, "celnr", e.target.value)}
                    onBlur={() => validateCell(row)} placeholder="522" className={inputCls} />
                </td>
                <td className={`${cellCls} relative`}>
                  <input
                    value={row.naam}
                    onChange={(e) => update(row.id, "naam", e.target.value)}
                    onFocus={() => setActiveRowId(row.id)}
                    onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                    placeholder="NAAM"
                    className={inputCls}
                  />
                  {activeRowId === row.id && suggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 top-full mt-1 w-72 rounded-xl overflow-hidden shadow-2xl text-xs border"
                      style={{
                        background: "rgba(13,20,36,0.97)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        backdropFilter: "blur(20px)",
                      }}>
                      {suggestions.map((s) => (
                        <li
                          key={s.label}
                          onMouseDown={() => applySuggestion(row.id, s)}
                          className="px-3 py-2.5 hover:bg-white/[0.06] cursor-pointer text-slate-200 transition"
                        >
                          {s.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={cellCls}>
                  <input value={row.voornaam} onChange={(e) => update(row.id, "voornaam", e.target.value)}
                    placeholder="Voornaam" className={inputCls} />
                </td>
                <td className={cellCls}>
                  <input value={row.bestemming} onChange={(e) => update(row.id, "bestemming", e.target.value)}
                    placeholder="Bestemming" className={inputCls} />
                </td>
                <td className={cellCls} style={{ width: "36px" }}>
                  <button
                    onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition text-base leading-none"
                    title="Rij verwijderen"
                  >
                    ×
                  </button>
                </td>
              </tr>
              {celWarnings[row.id] && (
                <tr key={`${row.id}-warn`}>
                  <td colSpan={6} className="px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/[0.07] border-b border-amber-100 dark:border-amber-400/20">
                    ⚠ {celWarnings[row.id]}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* Add row controls */}
      <div className="mt-4 flex flex-col gap-2 items-start">
        <button
          onClick={() => onChange([...rows, newRow()])}
          className="text-xs font-medium text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span> Rij toevoegen
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange([...rows, ...Array.from({ length: bulkCount }, newRow)])}
            className="text-xs font-medium text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition"
          >
            +
          </button>
          <input
            type="number"
            min={1}
            max={50}
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            className="w-14 px-2 py-1 text-xs text-center border border-slate-200 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
          />
          <button
            onClick={() => onChange([...rows, ...Array.from({ length: bulkCount }, newRow)])}
            className="text-xs font-medium text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition"
          >
            rijen toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}
