export interface ManualRow {
  id: string;
  uur: string;
  celnr: string;
  naam: string;
  voornaam: string;
  bestemming: string;
}

export interface AutocompleteResult {
  naam: string;
  voornaam: string;
  cel: number;
  label: string;
}

export interface CorrectionEntry {
  naam: string;
  voornaam: string;
  original_celnr: number | null;
  corrected_celnr: number;
  source: string;
}

export interface UnmatchedEntry {
  naam: string;
  voornaam: string | null;
  celnr: number | null;
  source: string;
}

export interface GenerateResult {
  job_id: string;
  filename: string;
  corrections: CorrectionEntry[];
  warnings: string[];
  unmatched: UnmatchedEntry[];
}

export interface DispatchFile {
  filename: string;
  rows: number;
  index: number;
  category: "dispatch" | "agenda" | "bezoek";
}

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
