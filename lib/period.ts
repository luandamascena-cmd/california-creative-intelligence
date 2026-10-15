// Períodos de calendário que contêm a data de hoje: semana, mês, bimestre, trimestre, semestre e ano.
import type { Demand } from "./types";
import { addDaysISO, formatDateBR, weekStartISO } from "./text";

export type PeriodKey = "semana" | "mes" | "bimestre" | "trimestre" | "semestre" | "ano";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "bimestre", label: "Bimestre" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "ano", label: "Ano" },
];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Intervalo [início, fim] (aaaa-mm-dd) do período atual. */
export function periodRange(key: PeriodKey, today: string): [string, string] {
  if (key === "semana") {
    const s = weekStartISO(today);
    return [s, addDaysISO(s, 6)];
  }
  const [y, m] = today.split("-").map(Number);
  const size = { mes: 1, bimestre: 2, trimestre: 3, semestre: 6, ano: 12 }[key];
  const first = Math.floor((m - 1) / size) * size + 1;
  const last = first + size - 1;
  return [`${y}-${pad(first)}-01`, `${y}-${pad(last)}-${pad(lastDay(y, last))}`];
}

/** Descrição por extenso do período atual, para tooltips e rótulos. */
export function periodDescription(key: PeriodKey, today: string): string {
  const [s, e] = periodRange(key, today);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  switch (key) {
    case "semana":
      return `semana de ${formatDateBR(s).slice(0, 5)} a ${formatDateBR(e).slice(0, 5)}`;
    case "mes":
      return `${MONTHS[m - 1]} de ${y}`;
    case "bimestre":
      return `${MONTHS[m - 1]} e ${MONTHS[m]} de ${y}`;
    case "trimestre":
      return `${Math.ceil(m / 3)}º trimestre de ${y}`;
    case "semestre":
      return `${m <= 6 ? 1 : 2}º semestre de ${y}`;
    case "ano":
      return String(y);
  }
}

/**
 * Uma demanda pertence ao período quando o intervalo entre INÍCIO e ENTREGA cruza o período.
 * Demandas abertas sem nenhuma data (em briefing, travadas) contam como pauta atual.
 */
export function filterByPeriod(rows: Demand[], key: PeriodKey | null, today: string): Demand[] {
  if (!key) return rows;
  const [ps, pe] = periodRange(key, today);
  return rows.filter((d) => {
    const s = d.start ?? d.due;
    const e = d.due ?? d.start;
    if (!s || !e) return d.isOpen;
    return s <= pe && e >= ps;
  });
}

export const PERIOD_DEFINITION =
  "Período de calendário que contém a data de hoje. Uma demanda entra no período quando o intervalo entre INÍCIO e ENTREGA cruza esse período; demandas abertas sem datas (em briefing ou travadas) contam como pauta atual.";
