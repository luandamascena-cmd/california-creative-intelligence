// Filtros e agregações. Toda a dashboard deriva de uma única base filtrada.

import type { Demand, StatusCategory } from "./types";
import { addDaysISO, diffDays, todayISO } from "./text";

export interface Filters {
  regional: string | null;
  team: string | null;
  bu: string | null;
  client: string | null;
  person: string | null;
  format: string | null;
  status: string | null;
  priority: string | null;
  projectType: string | null;
  dateField: "start" | "due";
  from: string | null;
  to: string | null;
}

export const EMPTY_FILTERS: Filters = {
  regional: null,
  team: null,
  bu: null,
  client: null,
  person: null,
  format: null,
  status: null,
  priority: null,
  projectType: null,
  dateField: "start",
  from: null,
  to: null,
};

/** Filtros que o usuário escolhe além do contexto de navegação (regional e time). */
export const SECONDARY_KEYS = ["bu", "client", "person", "format", "status", "priority", "projectType"] as const;

export function applyFilters(rows: Demand[], f: Filters): Demand[] {
  return rows.filter((d) => {
    if (f.regional && d.regional !== f.regional) return false;
    if (f.team && d.team !== f.team) return false;
    if (f.bu && d.bu !== f.bu) return false;
    if (f.client && d.client !== f.client) return false;
    if (f.person && !d.people.includes(f.person)) return false;
    if (f.format && d.format !== f.format) return false;
    if (f.status && d.status !== f.status) return false;
    if (f.priority && d.priority !== f.priority) return false;
    if (f.projectType && d.projectType !== f.projectType) return false;
    if (f.from || f.to) {
      const v = d[f.dateField];
      if (!v) return false;
      if (f.from && v < f.from) return false;
      if (f.to && v > f.to) return false;
    }
    return true;
  });
}

export function countBy<T>(rows: T[], key: (r: T) => string | string[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r);
    (Array.isArray(k) ? k : [k]).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  });
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function distinctBy<T>(rows: T[], group: (r: T) => string, item: (r: T) => string): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const g = group(r);
    const s = m.get(g) ?? new Set<string>();
    s.add(item(r));
    m.set(g, s);
  });
  return m;
}

export const pct = (v: number, total: number) => (total ? (v / total) * 100 : 0);
export const fmtPct = (v: number, total: number) => `${pct(v, total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function isLate(d: Demand, today: string) {
  return d.isOpen && !!d.due && d.due < today;
}
export function isDueSoon(d: Demand, today: string, days = 7) {
  return d.isOpen && !!d.due && d.due >= today && d.due <= addDaysISO(today, days);
}

const EXTERNAL_TYPES = new Set(["cliente", "prospeccao", "concorrencia"]);
export function isExternalWork(d: Demand) {
  return EXTERNAL_TYPES.has(
    d.projectType
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase(),
  );
}

export interface Kpis {
  demands: number;
  projects: number;
  clients: number;
  externalClients: number;
  people: number;
  teams: number;
  regionals: number;
  bus: number;
  open: number;
  byCat: Record<StatusCategory, number>;
  late: number;
  dueSoon: number;
  intake30: number;
  intakePrev30: number;
  medianPlannedDays: number | null;
}

export function computeKpis(rows: Demand[], today = todayISO()): Kpis {
  const byCat = { briefing: 0, pauta: 0, aprovacao: 0, travado: 0, finalizado: 0, outro: 0 } as Record<StatusCategory, number>;
  rows.forEach((d) => byCat[d.statusCategory]++);
  const d30 = addDaysISO(today, -30);
  const d60 = addDaysISO(today, -60);
  const durations = rows
    .filter((d) => d.start && d.due && d.due >= d.start)
    .map((d) => diffDays(d.start!, d.due!))
    .sort((a, b) => a - b);
  return {
    demands: rows.length,
    projects: new Set(rows.map((d) => d.projectKey)).size,
    clients: new Set(rows.map((d) => d.client)).size,
    externalClients: new Set(rows.filter(isExternalWork).map((d) => d.client)).size,
    people: new Set(rows.flatMap((d) => d.people)).size,
    teams: new Set(rows.map((d) => d.sourceTab)).size,
    regionals: new Set(rows.map((d) => d.regional)).size,
    bus: new Set(rows.map((d) => d.bu)).size,
    open: rows.filter((d) => d.isOpen).length,
    byCat,
    late: rows.filter((d) => isLate(d, today)).length,
    dueSoon: rows.filter((d) => isDueSoon(d, today)).length,
    intake30: rows.filter((d) => d.start && d.start > d30 && d.start <= today).length,
    intakePrev30: rows.filter((d) => d.start && d.start > d60 && d.start <= d30).length,
    medianPlannedDays: durations.length ? durations[Math.floor(durations.length / 2)] : null,
  };
}

/** Rótulos curtos para as categorias de status. */
export const CAT_LABEL: Record<StatusCategory, string> = {
  pauta: "Em pauta",
  aprovacao: "Em aprovação",
  briefing: "Em briefing",
  travado: "Travado",
  finalizado: "Finalizado",
  outro: "Outro",
};

export function toCsv(rows: Demand[]): string {
  const cols: [string, (d: Demand) => string][] = [
    ["Guia", (d) => d.sourceTab],
    ["Linha", (d) => String(d.row)],
    ["Regional", (d) => d.regional],
    ["Time", (d) => d.team],
    ["Grupo", (d) => d.group],
    ["Tarefa", (d) => d.task],
    ["Projeto (regra)", (d) => d.projectLabel],
    ["Cliente", (d) => d.client],
    ["Business Unit", (d) => d.bu],
    ["Status", (d) => d.status],
    ["Início", (d) => d.start ?? ""],
    ["Entrega", (d) => d.due ?? ""],
    ["Prioridade", (d) => d.priority],
    ["Planejamento", (d) => d.planners.join(", ")],
    ["Diretor de Arte", (d) => d.artDirectors.join(", ")],
    ["Formato", (d) => d.format],
    ["Tipo de projeto", (d) => d.projectType],
    ["Função", (d) => d.role],
    ["Observações", (d) => d.notes],
  ];
  const esc = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "﻿" + [cols.map((c) => c[0]).join(";"), ...rows.map((d) => cols.map((c) => esc(c[1](d))).join(";"))].join("\n");
}
