// Nomes sempre por extenso na interface: nada de siglas para regionais ou Business Unit.
import { REGIONAL_PLACES } from "./regions";

/** Nome por extenso da regional (ex.: "SP" → "São Paulo"). */
export function regionalName(code: string | null | undefined): string {
  if (!code) return "";
  return REGIONAL_PLACES[code]?.city ?? code;
}

/** Nome por extenso de uma guia de time (ex.: "SP | Content House" → "São Paulo · Content House"). */
export function teamLabel(regional: string, team: string): string {
  return `${regionalName(regional)} · ${team}`;
}

export function tabLabel(title: string): string {
  const m = title.match(/^\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
  return m ? teamLabel(m[1].trim().toUpperCase(), m[2]) : title;
}

const LOWER = new Set(["de", "da", "do", "das", "dos", "e", "em", "por", "para", "com", "a", "o", "as", "os", "no", "na", "nos", "nas", "ao", "à", "x", "×"]);

/** Títulos: palavras com inicial maiúscula, exceto conectivos (de, por, e...). */
export function titleCase(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w, i) => {
      if (/^\s+$/.test(w) || !w) return w;
      const lower = w.toLowerCase();
      if (i > 0 && LOWER.has(lower)) return lower;
      if (/^[A-Z0-9]{2,}$/.test(w) || /\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}
