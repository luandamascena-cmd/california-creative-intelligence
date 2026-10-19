// Layout compartilhado das páginas de gráficos: ordem, largura e tipo de cada gráfico.
// O administrador edita e salva; todos os acessos passam a ver a mesma arrumação.

export const CHART_KEYS = [
  "clients",
  "bu",
  "formats",
  "timeline",
  "status",
  "people",
  "workload",
  "deadlines",
  "topClients",
  "regional",
  "projectsBu",
  "heatmap",
  "nature",
  "formatsBu",
  "priority",
] as const;
export type ChartKey = (typeof CHART_KEYS)[number];

/** Larguras possíveis, em colunas de uma grade de 12 (telas grandes). */
export const SPANS = [3, 4, 5, 6, 7, 8, 9, 12] as const;
export type Span = (typeof SPANS)[number];

export const VARIANTS = ["padrao", "barras-h", "barras-v", "rosca", "lista", "tabela"] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_LABEL: Record<Variant, string> = {
  padrao: "Original",
  "barras-h": "Barras horizontais",
  "barras-v": "Barras verticais",
  rosca: "Rosca",
  lista: "Ranking",
  tabela: "Tabela",
};

export interface Widget {
  id: string;
  chart: ChartKey;
  span: Span;
  variant?: Variant;
}

export interface SharedLayout {
  version: 1;
  /** Dashboard (Visão Geral, regional e time). */
  dashboard: Widget[];
  /** Modelo aplicado a todas as seções do Panorama. */
  panorama: Widget[];
  updatedAt: string | null;
  /** Ajustes pontuais já aplicados a um layout salvo (ver app/api/layout/route.ts). */
  migrations?: string[];
}

const w = (chart: ChartKey, span: Span): Widget => ({ id: chart, chart, span });

export const DEFAULT_LAYOUT: SharedLayout = {
  version: 1,
  dashboard: [
    w("clients", 5), w("bu", 4), w("formats", 3),
    w("timeline", 7), w("status", 5),
    w("workload", 12),
    w("people", 6), w("nature", 6),
    w("deadlines", 8), w("topClients", 4),
    w("regional", 3), w("projectsBu", 4), w("heatmap", 5),
    w("formatsBu", 6), w("priority", 6),
  ],
  panorama: [w("status", 5), w("clients", 4), w("formats", 3), w("people", 6), w("timeline", 6)],
  updatedAt: null,
};

/** Classes de largura por gráfico (literais, para o Tailwind gerar todas). */
export const SPAN_CLASS: Record<Span, string> = {
  3: "col-span-12 lg:col-span-6 2xl:col-span-3",
  4: "col-span-12 lg:col-span-6 2xl:col-span-4",
  5: "col-span-12 lg:col-span-6 2xl:col-span-5",
  6: "col-span-12 lg:col-span-6 2xl:col-span-6",
  7: "col-span-12 lg:col-span-6 2xl:col-span-7",
  8: "col-span-12 2xl:col-span-8",
  9: "col-span-12 2xl:col-span-9",
  12: "col-span-12",
};
export const SPAN_LABEL: Record<Span, string> = { 3: "1/4", 4: "1/3", 5: "5/12", 6: "1/2", 7: "7/12", 8: "2/3", 9: "3/4", 12: "Inteira" };

function cleanList(list: unknown): Widget[] | null {
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const out: Widget[] = [];
  for (const raw of list.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const chart = r.chart as ChartKey;
    if (!CHART_KEYS.includes(chart)) continue;
    const id = typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : chart;
    if (seen.has(id)) continue;
    seen.add(id);
    const span = (SPANS as readonly number[]).includes(Number(r.span)) ? (Number(r.span) as Span) : 6;
    const variant = VARIANTS.includes(r.variant as Variant) ? (r.variant as Variant) : undefined;
    out.push({ id, chart, span, ...(variant && variant !== "padrao" ? { variant } : {}) });
  }
  return out;
}

/** Valida um layout recebido (do arquivo ou do navegador). Partes inválidas voltam ao padrão. */
export function sanitizeLayout(input: unknown): SharedLayout {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    version: 1,
    dashboard: cleanList(o.dashboard) ?? DEFAULT_LAYOUT.dashboard,
    panorama: cleanList(o.panorama) ?? DEFAULT_LAYOUT.panorama,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
    migrations: Array.isArray(o.migrations) ? o.migrations.filter((m): m is string => typeof m === "string").slice(0, 50) : [],
  };
}
