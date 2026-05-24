"use client";
import { useState, useEffect, useRef } from "react";
import { ManualRow, AutocompleteResult } from "@/lib/types";
import { autocomplete } from "@/lib/api";

interface Props {
  sessionId: string | null;
  rows: ManualRow[];
  onChange: (rows: ManualRow[]) => void;
}

function newRow(): ManualRow {
  return { id: Math.random().toString(36).slice(2), uur: "", celnr: "", naam: "", voornaam: "", bestemming: "" };
}

export default function ManualEntryTable({ sessionId, rows, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [celWarnings, setCelWarnings] = useState<Record<string, string>>({});
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
    if (field === "celnr") {
      // Real-time cell validation will happen on blur
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
        [row.id]: `Cel gecorrigeerd: ${row.celnr} → ${match.cel} (celbezetting)`,
      }));
    } else {
      setCelWarnings((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
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
    setCelWarnings((prev) => { const n = { ...prev }; delete n[rowId]; return n; });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {["Uur", "Celnr", "Naam", "Voornaam", "Bestemming", ""].map((h) => (
              <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-1">
                  <input
                    value={row.uur}
                    onChange={(e) => update(row.id, "uur", e.target.value)}
                    placeholder="08:00"
                    className="w-full px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    value={row.celnr}
                    onChange={(e) => update(row.id, "celnr", e.target.value)}
                    onBlur={() => validateCell(row)}
                    placeholder="522"
                    className="w-full px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                  />
                </td>
                <td className="border border-gray-300 p-1 relative">
                  <input
                    value={row.naam}
                    onChange={(e) => update(row.id, "naam", e.target.value)}
                    onFocus={() => setActiveRowId(row.id)}
                    onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                    placeholder="NAAM"
                    className="w-full px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                  />
                  {activeRowId === row.id && suggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 top-full mt-0.5 w-72 bg-white border border-gray-300 rounded shadow-lg text-xs max-h-40 overflow-y-auto">
                      {suggestions.map((s) => (
                        <li
                          key={s.label}
                          onMouseDown={() => applySuggestion(row.id, s)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          {s.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    value={row.voornaam}
                    onChange={(e) => update(row.id, "voornaam", e.target.value)}
                    placeholder="Voornaam"
                    className="w-full px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    value={row.bestemming}
                    onChange={(e) => update(row.id, "bestemming", e.target.value)}
                    placeholder="Bestemming"
                    className="w-full px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                  />
                </td>
                <td className="border border-gray-300 p-1 text-center">
                  <button
                    onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                    className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                    title="Rij verwijderen"
                  >
                    ×
                  </button>
                </td>
              </tr>
              {celWarnings[row.id] && (
                <tr key={`${row.id}-warn`}>
                  <td colSpan={6} className="bg-yellow-50 text-yellow-800 text-xs px-3 py-1 border-b border-yellow-200">
                    {celWarnings[row.id]}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => onChange([...rows, newRow()])}
        className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Rij toevoegen
      </button>
    </div>
  );
}
