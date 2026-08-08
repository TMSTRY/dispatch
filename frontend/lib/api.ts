const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * De backend houdt sessies alleen in het geheugen. Slaapt of herstart de
 * Render-instantie tussendoor, dan is de sessie weg en antwoordt elke
 * vervolgstap met 404 "Sessie niet gevonden". We geven dat een eigen type
 * zodat de pagina het stil kan herstellen in plaats van de gebruiker met
 * een foutmelding en verloren uploads achter te laten.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("Sessie verlopen");
    this.name = "SessionExpiredError";
  }
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: string }).detail;
  if (res.status === 404 && typeof detail === "string" && detail.toLowerCase().includes("sessie")) {
    throw new SessionExpiredError();
  }
  throw new Error(detail ?? fallback);
}

export async function createSession(signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE}/session`, { method: "POST", signal });
  if (!res.ok) throw new Error("Sessie aanmaken mislukt");
  const data = await res.json();
  return data.session_id as string;
}

/**
 * De backend draait op Render's gratis tier en valt na inactiviteit in slaap.
 * Het eerste verzoek wekt hem, maar dat duurt makkelijk 50 seconden en faalt
 * of blijft hangen zolang hij nog niet klaar is. Daarom proberen we het hier
 * herhaaldelijk in plaats van meteen op te geven — dat scheelde voorheen
 * handmatig verversen tot het toevallig lukte.
 */
export async function createSessionWithRetry(opts: {
  totalTimeoutMs?: number;
  attemptTimeoutMs?: number;
  pauseMs?: number;
  onAttempt?: (attempt: number) => void;
} = {}): Promise<string> {
  const totalTimeoutMs   = opts.totalTimeoutMs   ?? 120_000;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? 20_000;
  const pauseMs          = opts.pauseMs          ?? 2_000;

  const deadline = Date.now() + totalTimeoutMs;
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt += 1;
    opts.onAttempt?.(attempt);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), attemptTimeoutMs);
    try {
      return await createSession(ctrl.signal);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }

    if (Date.now() + pauseMs >= deadline) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  throw new Error(
    lastError instanceof Error && lastError.name !== "AbortError"
      ? `Server niet bereikbaar: ${lastError.message}`
      : "Server reageert niet. Probeer opnieuw — de backend heeft soms een minuut nodig om op te starten.",
  );
}

export async function uploadCelbezetting(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/celbezetting`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) await throwApiError(res, "Upload celbezetting mislukt");
  return res.json();
}

export async function uploadDispatch(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/dispatch`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) await throwApiError(res, "Upload dispatch mislukt");
  return res.json();
}

export async function removeDispatch(sessionId: string, index: number) {
  const res = await fetch(`${BASE}/session/${sessionId}/dispatch/${index}`, {
    method: "DELETE",
  });
  if (!res.ok) await throwApiError(res, "Verwijderen mislukt");
  return res.json();
}

export async function uploadPaleislijst(sessionId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/session/${sessionId}/paleislijst`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) await throwApiError(res, "Upload paleislijst mislukt");
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
  if (!res.ok) await throwApiError(res, "Genereren mislukt");
  return res.json();
}

export function downloadUrl(jobId: string): string {
  return `${BASE}/download/${jobId}`;
}

export interface WerkersSummary {
  removed: Array<{ naam: string; cel: string | number }>;
  updated: Array<{ naam: string; van: string | number; naar: string | number }>;
}

export async function updateWerkers(
  mutatiesFile: File,
  werkersFile: File,
): Promise<{ job_id: string; filename: string; summary: WerkersSummary }> {
  const fd = new FormData();
  fd.append("mutatielijst", mutatiesFile);
  fd.append("werkerslijst", werkersFile);
  const res = await fetch(`${BASE}/werkers/update`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Werkerslijst update mislukt");
  }
  return res.json();
}

export async function generateMutaties(templateFile: File, sourceFile: File) {
  const fd = new FormData();
  fd.append("template", templateFile);
  fd.append("source", sourceFile);
  const res = await fetch(`${BASE}/mutaties/generate`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Genereren mutatielijst mislukt");
  }
  return res.json() as Promise<{ job_id: string; filename: string }>;
}
