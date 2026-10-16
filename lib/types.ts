// Tipos compartilhados entre servidor e cliente.

export type StatusCategory =
  | "briefing"
  | "pauta"
  | "aprovacao"
  | "travado"
  | "finalizado"
  | "outro";

export interface DemandLink {
  label: string;
  url: string;
}

/** Um registro operacional (uma linha de uma guia de pauta). */
export interface Demand {
  id: string;
  /** Nome exato da guia de origem, ex.: "SP | Content House". */
  sourceTab: string;
  /** Linha na planilha (1-based), para rastrear a origem do dado. */
  row: number;
  regional: string;
  /** Time executor, lido do nome da guia (ex.: "Content House"). */
  team: string;
  group: string;
  task: string;
  client: string;
  /** Business Unit da demanda, lida da coluna BUSINESS UNIT. */
  bu: string;
  status: string;
  statusCategory: StatusCategory;
  /** Datas em ISO (yyyy-mm-dd) ou null. */
  start: string | null;
  due: string | null;
  priority: string;
  planners: string[];
  artDirectors: string[];
  /** União sem repetição de planejamento + direção de arte. */
  people: string[];
  format: string;
  projectType: string;
  role: string;
  notes: string;
  /** Links da coluna LINKS (apresentações, documentos, pastas). */
  links: DemandLink[];
  projectKey: string;
  projectLabel: string;
  isOpen: boolean;
}

export type IssueSeverity = "erro" | "alerta" | "info";

export interface QualityIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  tab?: string;
  rows?: number[];
}

export interface TabInfo {
  title: string;
  regional: string;
  team: string;
  rows: number;
  headerRow: number | null;
  missingColumns: string[];
}

export interface Reconciliation {
  tab: string;
  metric: string;
  sheet: number;
  dashboard: number;
}

export interface Capabilities {
  hasStatus: boolean;
  hasDates: boolean;
  hasDue: boolean;
  hasFormat: boolean;
  hasPriority: boolean;
  hasPeople: boolean;
  hasProjectColumn: boolean;
  hasCompletionDate: boolean;
}

export interface Dataset {
  version: string;
  syncedAt: string;
  source: "google-sheets" | "demo";
  sourceLabel: string;
  spreadsheetTitle: string;
  tabs: TabInfo[];
  demands: Demand[];
  issues: QualityIssue[];
  reconciliation: Reconciliation[];
  capabilities: Capabilities;
  /** Valores oficiais da guia Listas, quando existe. */
  lists: Record<string, string[]>;
  refreshSeconds: number;
}

export interface DataResponse {
  ok: boolean;
  data?: Dataset;
  error?: string;
  /** Presente quando a sincronização falhou mas há dados anteriores em cache. */
  stale?: boolean;
}
