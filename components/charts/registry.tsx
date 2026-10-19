"use client";

// Catálogo de gráficos: o que existe, como se chama, que base usa e em que formatos pode ser redesenhado.
import type { ChartKey } from "@/lib/layout";
import { countBy } from "@/lib/analytics";
import { regionalName } from "@/lib/labels";
import type { ChartProps } from "./types";
import type { AltSpec } from "./alt";
import { STATUS_COLORS, STATUS_ORDER } from "../theme";
import { BuChart, ClientsChart, FormatsByBu, FormatsChart, NatureChart, PriorityChart, TopClients } from "./distribution";
import { PeopleChart, StatusChart, WorkloadChart } from "./operation";
import { DeadlinesPanel, TimelineChart } from "./time";
import { HeatmapChart, ProjectsByBu, RegionalChart } from "./structure";

export interface ChartDef {
  /** Nome no catálogo do modo de edição. */
  label: string;
  Comp: (p: ChartProps) => React.ReactNode;
  /** Usa a base sem regional e time (compara regionais e times entre si). */
  cross?: boolean;
  /** Não tem seletor de período próprio (já trabalha com escala de tempo). */
  noPeriod?: boolean;
  /** Formatos alternativos disponíveis. Ausente: o gráfico só tem o formato original. */
  alt?: AltSpec;
}

const byField = (field: "client" | "bu" | "format" | "priority" | "projectType", title: string, dimension: string): AltSpec => ({
  title,
  dimension,
  data: (rows, ctx) => countBy(rows, (d) => d[field]).map((s) => ({ ...s, color: field === "bu" ? ctx.buColors[s.name] : undefined })),
  drill: (name, rows) => ({ title: name, subtitle: title, rows: rows.filter((d) => d[field] === name), apply: { [field]: name } }),
});

export const CHARTS: Record<ChartKey, ChartDef> = {
  clients: { label: "Demandas por Clientes", Comp: ClientsChart, alt: byField("client", "Demandas por Clientes", "Cliente") },
  bu: { label: "Demandas por Business Unit", Comp: BuChart, alt: byField("bu", "Demandas por Business Unit", "Business Unit") },
  formats: { label: "Formatos das Demandas", Comp: FormatsChart, alt: byField("format", "Formatos das Demandas", "Formato") },
  timeline: { label: "Evolução das Demandas", Comp: TimelineChart, noPeriod: true },
  status: {
    label: "Status das Demandas",
    Comp: StatusChart,
    alt: {
      title: "Status das Demandas",
      dimension: "Status",
      data: (rows) => {
        const m = new Map<string, { value: number; cat: keyof typeof STATUS_COLORS }>();
        rows.forEach((d) => {
          const s = m.get(d.status) ?? { value: 0, cat: d.statusCategory };
          s.value++;
          m.set(d.status, s);
        });
        return [...m.entries()]
          .sort((a, b) => STATUS_ORDER.indexOf(a[1].cat as never) - STATUS_ORDER.indexOf(b[1].cat as never))
          .map(([name, s]) => ({ name, value: s.value, color: STATUS_COLORS[s.cat] }));
      },
      drill: (name, rows) => ({ title: name, subtitle: "Demandas por status", rows: rows.filter((d) => d.status === name), apply: { status: name } }),
    },
  },
  people: {
    label: "Projetos por Colaboradores",
    Comp: PeopleChart,
    alt: {
      title: "Volume por Colaboradores",
      dimension: "Colaborador",
      data: (rows) => countBy(rows, (d) => d.people),
      drill: (name, rows) => ({ title: name, subtitle: "Demandas do colaborador", rows: rows.filter((d) => d.people.includes(name)), apply: { person: name } }),
    },
  },
  workload: { label: "Demandas por Colaboradores", Comp: WorkloadChart },
  deadlines: { label: "Prazos e Atrasos", Comp: DeadlinesPanel },
  topClients: {
    label: "Top 10 Clientes",
    Comp: TopClients,
    alt: { ...byField("client", "Top 10 Clientes", "Cliente"), data: (rows) => countBy(rows, (d) => d.client).slice(0, 10) },
  },
  regional: {
    label: "Projetos por Regionais",
    Comp: RegionalChart,
    cross: true,
    alt: {
      title: "Demandas por Regionais",
      dimension: "Regional",
      data: (rows) => countBy(rows, (d) => regionalName(d.regional)),
      drill: (name, rows) => {
        const list = rows.filter((d) => regionalName(d.regional) === name);
        return { title: name, subtitle: "Demandas da regional", rows: list, apply: list[0] ? { regional: list[0].regional, team: null } : undefined };
      },
    },
  },
  projectsBu: {
    label: "Projetos por Business Unit",
    Comp: ProjectsByBu,
    alt: {
      title: "Projetos por Business Unit",
      dimension: "Business Unit",
      unit: "projetos",
      data: (rows, ctx) => {
        const m = new Map<string, Set<string>>();
        rows.forEach((d) => m.set(d.bu, (m.get(d.bu) ?? new Set()).add(d.projectKey)));
        return [...m.entries()].map(([name, s]) => ({ name, value: s.size, color: ctx.buColors[name] })).sort((a, b) => b.value - a.value);
      },
      drill: (name, rows) => ({ title: name, subtitle: "Projetos da Business Unit", rows: rows.filter((d) => d.bu === name), apply: { bu: name } }),
    },
  },
  heatmap: { label: "Times por Business Unit", Comp: HeatmapChart, cross: true },
  nature: { label: "Natureza do Trabalho por Business Unit", Comp: NatureChart, alt: byField("projectType", "Demandas por Tipo de Projeto", "Tipo de projeto") },
  formatsBu: { label: "Formatos por Business Unit", Comp: FormatsByBu },
  priority: { label: "Demandas por Prioridade", Comp: PriorityChart, alt: byField("priority", "Demandas por Prioridade", "Prioridade") },
};
