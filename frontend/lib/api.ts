const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function createSession(): Promise<string> {
  const res = await fetch(`${BASE}/session`, { method: "POST" });
  if (!res.ok) throw new Error("Sessie aanmaken mislukt");
  const data = await res.json();
  return data.session_id as string;
}

export async function uploadCelbezetting(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/celbezetting`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload celbezetting mislukt");
  }
  return res.json();
}

export async function uploadDispatch(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/dispatch`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload dispatch mislukt");
  }
  return res.json();
}

export async function removeDispatch(sessionId: string, index: number) {
  const res = await fetch(`${BASE}/session/${sessionId}/dispatch/${index}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Verwijderen mislukt");
  return res.json();
}

export async function uploadPaleislijst(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/paleislijst`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload paleislijst mislukt");
  }
  return res.json();
}

export async function autocomplete(sessionId: string, q: string) {
  if (!q.trim()) return { results: [] };
  const res = await fetch(
    `${BASE}/session/${sessionId}/autocomplete?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) return { results: [] };
  return res.json();
}

export async function generate(
  sessionId: string,
  manualEntries: object[],
  targetDate: string
) {
  const res = await fetch(`${BASE}/session/${sessionId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manual_entries: manualEntries, target_date: targetDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Genereren mislukt");
  }
  return res.json();
}

export function downloadUrl(jobId: string): string {
  return `${BASE}/download/${jobId}`;
}
