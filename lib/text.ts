// Utilitários de texto e data usados no servidor e no navegador.

/** Remove espaços extras, inclusive quebras de linha e espaços não separáveis. */
export function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[ \s]+/g, " ").trim();
}

/** Chave de comparação: sem acentos, minúscula, só letras e números separados por espaço. */
export function normKey(value: unknown): string {
  return clean(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Divide células com múltiplos responsáveis ("A, B; C / D"). */
export function splitPeople(value: unknown): string[] {
  const raw = clean(value);
  if (!raw) return [];
  return raw
    .split(/\s*[,;/\n]\s*|\s+\+\s+/)
    .map((p) => clean(p))
    .filter(Boolean);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Interpreta datas no formato brasileiro (dd/mm/aa, dd/mm/aaaa), ISO (aaaa-mm-dd)
 * e números de série do Google Sheets. Retorna ISO ou null.
 */
export function parseDate(value: unknown): { iso: string | null; invalid: boolean } {
  const raw = clean(value);
  if (!raw) return { iso: null, invalid: false };

  let y: number, m: number, d: number;
  const br = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (br) {
    d = +br[1];
    m = +br[2];
    y = +br[3];
    if (y < 100) y += 2000;
  } else if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Math.floor(+raw);
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  } else {
    return { iso: null, invalid: true };
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return { iso: null, invalid: true };
  }
  return { iso: `${y}-${pad(m)}-${pad(d)}`, invalid: false };
}

export const TIMEZONE = "America/Sao_Paulo";

/** Data de hoje (aaaa-mm-dd) no fuso de São Paulo. */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA já retorna aaaa-mm-dd
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  return Math.round((tb - ta) / 86400000);
}

export function formatDateBR(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Segunda-feira da semana ISO da data informada. */
export function weekStartISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // 0 = segunda
  return addDaysISO(iso, -dow);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}
