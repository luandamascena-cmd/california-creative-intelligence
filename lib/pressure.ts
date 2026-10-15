// Termômetro da pauta: indica onde a criação está mais pressionada.
// A planilha não registra capacidade nem horas, então o índice usa apenas sinais observáveis:
// prazos vencidos e concentração de demandas abertas em uma mesma pessoa.

import type { Demand } from "./types";
import { addDaysISO } from "./text";

export type PressureLevel = "critico" | "atencao" | "estavel" | "sem-dados";

export const PRESSURE_RULES = {
  /** % das demandas abertas com ENTREGA vencida. */
  lateCritical: 0.25,
  lateWarning: 0.1,
  /** Maior número de demandas abertas nas mãos de uma única pessoa. */
  peakCritical: 12,
  peakWarning: 7,
};

export const LEVEL_LABEL: Record<PressureLevel, string> = {
  critico: "Sobrecarga",
  atencao: "Atenção",
  estavel: "Estável",
  "sem-dados": "Sem registros",
};

export const LEVEL_COLOR: Record<PressureLevel, string> = {
  critico: "#E7103D",
  atencao: "#E0A73A",
  estavel: "#2BB37F",
  "sem-dados": "#5E5D5A",
};

export interface Pressure {
  total: number;
  open: number;
  late: number;
  dueSoon: number;
  blocked: number;
  peak: { name: string; count: number } | null;
  lateRatio: number;
  /** 0 a 1: quanto do limite de sobrecarga já foi atingido (o maior dos dois sinais). */
  index: number;
  level: PressureLevel;
  reasons: string[];
}

export function computePressure(rows: Demand[], today: string): Pressure {
  const open = rows.filter((d) => d.isOpen);
  const late = open.filter((d) => d.due && d.due < today).length;
  const in7 = addDaysISO(today, 7);
  const dueSoon = open.filter((d) => d.due && d.due >= today && d.due <= in7).length;
  const blocked = open.filter((d) => d.statusCategory === "travado").length;
  const byPerson = new Map<string, number>();
  open.forEach((d) => d.people.forEach((p) => byPerson.set(p, (byPerson.get(p) ?? 0) + 1)));
  const top = [...byPerson.entries()].sort((a, b) => b[1] - a[1])[0];
  const peak = top ? { name: top[0], count: top[1] } : null;
  const lateRatio = open.length ? late / open.length : 0;
  const R = PRESSURE_RULES;

  let level: PressureLevel = "estavel";
  const reasons: string[] = [];
  if (!rows.length) level = "sem-dados";
  else {
    if (lateRatio >= R.lateCritical) reasons.push(`${Math.round(lateRatio * 100)}% das abertas com prazo vencido`);
    if (peak && peak.count >= R.peakCritical) reasons.push(`${peak.name} com ${peak.count} demandas abertas`);
    if (reasons.length) level = "critico";
    else {
      if (lateRatio >= R.lateWarning) reasons.push(`${Math.round(lateRatio * 100)}% das abertas com prazo vencido`);
      if (peak && peak.count >= R.peakWarning) reasons.push(`${peak.name} com ${peak.count} demandas abertas`);
      if (reasons.length) level = "atencao";
    }
  }
  const index = rows.length ? Math.min(1, Math.max(lateRatio / R.lateCritical, (peak?.count ?? 0) / R.peakCritical)) : 0;
  return { total: rows.length, open: open.length, late, dueSoon, blocked, peak, lateRatio, index, level, reasons };
}

export const PRESSURE_DEFINITION =
  `Sobrecarga: ${Math.round(PRESSURE_RULES.lateCritical * 100)}% ou mais das demandas abertas com prazo vencido, ou alguém com ${PRESSURE_RULES.peakCritical} ou mais demandas abertas. ` +
  `Atenção: a partir de ${Math.round(PRESSURE_RULES.lateWarning * 100)}% vencidas ou ${PRESSURE_RULES.peakWarning} demandas abertas com uma mesma pessoa. ` +
  `A planilha não registra horas nem capacidade, por isso o índice mede sinais de pressão, não produtividade.`;
