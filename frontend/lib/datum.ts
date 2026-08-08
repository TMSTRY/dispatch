/**
 * Spiegelt _belgian_holidays / _is_weekend_or_holiday uit backend/main.py.
 *
 * De backend kiest de keukentijden (MA TOT VRIJ vs ZA, ZO, FD) op basis van de
 * gekozen datum, en rekent feestdagen daarbij mee als weekend. Wijkt deze lijst
 * af van de backend, dan toont de tool een geruststellende maar foute melding —
 * hou beide dus gelijk.
 */

/** Paaszondag volgens het algoritme van Meeus/Jones/Butcher. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function key(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Belgische wettelijke feestdagen, per naam. */
function belgianHolidays(year: number): Map<string, string> {
  const e = easterSunday(year);
  const entries: [Date, string][] = [
    [new Date(year, 0, 1),    "Nieuwjaar"],
    [addDays(e, 1),           "Paasmaandag"],
    [new Date(year, 4, 1),    "Dag van de Arbeid"],
    [addDays(e, 39),          "Hemelvaartsdag"],
    [addDays(e, 50),          "Pinkstermaandag"],
    [new Date(year, 6, 21),   "Nationale feestdag"],
    [new Date(year, 7, 15),   "O.L.V. Hemelvaart"],
    [new Date(year, 10, 1),   "Allerheiligen"],
    [new Date(year, 10, 11),  "Wapenstilstand"],
    [new Date(year, 11, 25),  "Kerstmis"],
  ];
  return new Map(entries.map(([d, naam]) => [key(d), naam]));
}

export interface DatumInfo {
  /** "zondag 9 augustus 2026" */
  volledig: string;
  /** "zo 9 aug" — compact, voor de samenvatting */
  kort: string;
  /** True wanneer de backend de weekend-/feestdaguren gebruikt. */
  weekendTarief: boolean;
  /** Naam van de feestdag, indien van toepassing. */
  feestdag?: string;
  geldig: boolean;
}

/** Beschrijft een ISO-datum ("2026-08-09") voor weergave in de interface. */
export function beschrijfDatum(iso: string): DatumInfo {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { volledig: iso, kort: iso, weekendTarief: false, geldig: false };

  // Lokaal construeren: new Date("2026-08-09") is UTC-middernacht en kan in een
  // andere tijdzone op de vorige dag uitkomen.
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) {
    return { volledig: iso, kort: iso, weekendTarief: false, geldig: false };
  }

  const feestdag = belgianHolidays(d.getFullYear()).get(key(d));
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

  return {
    volledig: new Intl.DateTimeFormat("nl-BE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(d),
    kort: new Intl.DateTimeFormat("nl-BE", {
      weekday: "short", day: "numeric", month: "short",
    }).format(d),
    weekendTarief: isWeekend || feestdag !== undefined,
    feestdag,
    geldig: true,
  };
}
