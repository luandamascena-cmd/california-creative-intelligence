// Camada de tratamento: transforma as guias brutas da planilha em uma base única e padronizada.
// Função pura, sem acesso à rede, para poder ser testada com snapshots.

import type {
  Capabilities,
  Demand,
  QualityIssue,
  Reconciliation,
  StatusCategory,
  TabInfo,
} from "./types";
import { addDaysISO, clean, normKey, parseDate, splitPeople, todayISO } from "./text";
import { tabLabel } from "./labels";

export interface RawSheet {
  title: string;
  values: string[][];
}

/** Guias de pauta seguem o padrão "REGIONAL | TIME". */
export const PAUTA_TAB = /^\s*([A-Za-zÀ-ÿ]{2,4})\s*\|\s*(.+?)\s*$/;
export const LISTS_TAB = "listas";
export const OVERVIEW_TAB = "visao geral";

type Field =
  | "group"
  | "task"
  | "client"
  | "bu"
  | "status"
  | "start"
  | "due"
  | "priority"
  | "planners"
  | "artDirectors"
  | "format"
  | "projectType"
  | "role"
  | "notes"
  | "project"
  | "completed";

const ALIASES: Record<Field, string[]> = {
  group: ["grupo"],
  task: ["tarefa", "demanda", "job"],
  client: ["cliente"],
  bu: ["business unit", "bu", "unidade de negocio"],
  status: ["status"],
  start: ["inicio", "data de inicio", "abertura"],
  due: ["entrega", "prazo", "data de entrega"],
  priority: ["prioridade"],
  planners: ["planejamento", "planejador"],
  artDirectors: ["diretor de arte", "direcao de arte", "diretores de arte"],
  format: ["formato"],
  projectType: ["tipo de projeto"],
  role: ["funcao"],
  notes: ["observacoes", "observacao", "obs"],
  project: ["projeto", "projeto pai", "id do projeto"],
  completed: ["conclusao", "data de conclusao", "finalizado em", "entregue em"],
};

const REQUIRED: Field[] = ["task", "client", "bu", "status", "start", "due", "planners", "artDirectors", "format"];

const STATUS_MAP: Record<string, StatusCategory> = {
  "em briefing": "briefing",
  "aguardando briefing": "briefing",
  "em pauta": "pauta",
  "em andamento": "pauta",
  "em producao": "pauta",
  "em aprovacao": "aprovacao",
  "aprovacao": "aprovacao",
  travado: "travado",
  standby: "travado",
  pausado: "travado",
  finalizado: "finalizado",
  concluido: "finalizado",
  entregue: "finalizado",
};

export function statusCategory(status: string): StatusCategory {
  return STATUS_MAP[normKey(status)] ?? "outro";
}

function findHeader(values: string[][]): { row: number; map: Partial<Record<Field, number>> } | null {
  for (let r = 0; r < Math.min(values.length, 15); r++) {
    const keys = (values[r] ?? []).map(normKey);
    if (!keys.some((k) => ALIASES.task.includes(k))) continue;
    const map: Partial<Record<Field, number>> = {};
    (Object.keys(ALIASES) as Field[]).forEach((field) => {
      const idx = keys.findIndex((k) => ALIASES[field].includes(k));
      if (idx >= 0) map[field] = idx;
    });
    return { row: r, map };
  }
  return null;
}

function parseLists(sheet: RawSheet | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!sheet || !sheet.values.length) return out;
  const header = sheet.values[0];
  header.forEach((h, c) => {
    const name = clean(h);
    if (!name || name.length > 40) return;
    const vals: string[] = [];
    for (let r = 1; r < sheet.values.length; r++) {
      const v = clean(sheet.values[r]?.[c]);
      if (v && !vals.includes(v)) vals.push(v);
    }
    if (vals.length) out[name] = vals;
  });
  return out;
}

/** Monta um dicionário canônico: chave normalizada → grafia oficial. */
function dictionary(official: string[] | undefined) {
  const map = new Map<string, string>();
  (official ?? []).forEach((v) => map.set(normKey(v), v));
  return map;
}

const VERSION_PATTERNS: RegExp[] = [
  /\((?:v|versao)\s*\d+\)/gi,
  /\bversao\s*\d+\b/gi,
  /\bv\s?\d+\b/gi,
  /\((?:ingles|english|eng|en|espanhol|es)\)/gi,
  /\|\s*(?:eng|en|ingles|english)\s*$/gi,
  /\b(?:eng|ingles)\b\s*$/gi,
];

/** Estima o projeto a partir do nome da tarefa: remove versões, idioma e o nome do cliente. */
function estimateProjectKey(task: string, client: string): string {
  let t = clean(task)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  t = t.replace(/^\[[^\]]*\]\s*/, "");
  VERSION_PATTERNS.forEach((re) => (t = t.replace(re, " ")));
  let key = normKey(t);
  const ck = normKey(client);
  if (ck) key = (" " + key + " ").replace(" " + ck + " ", " ").trim();
  return `${ck}::${key}`;
}

export interface NormalizeResult {
  tabs: TabInfo[];
  demands: Demand[];
  issues: QualityIssue[];
  reconciliation: Reconciliation[];
  capabilities: Capabilities;
  lists: Record<string, string[]>;
}

export function normalizeWorkbook(sheets: RawSheet[], now: Date = new Date()): NormalizeResult {
  const issues: QualityIssue[] = [];
  const tabs: TabInfo[] = [];
  const demands: Demand[] = [];

  const listsSheet = sheets.find((s) => normKey(s.title) === LISTS_TAB);
  const lists = parseLists(listsSheet);
  const dicts = {
    client: dictionary(lists["Cliente"]),
    person: dictionary(lists["Pessoa"]),
    format: dictionary(lists["Formato"]),
    bu: dictionary(lists["Business Unit"]),
    status: dictionary(lists["Status"]),
    priority: dictionary(lists["Prioridade"]),
    projectType: dictionary(lists["Tipo de projeto"]),
  };
  const hasLists = Object.keys(lists).length > 0;

  // Valores fora das listas oficiais, agregados para não poluir o painel.
  const offList = new Map<string, { field: string; value: string; rows: number[]; tab: string }>();
  const canon = (dict: Map<string, string>, value: string, field: string, tab: string, row: number) => {
    const v = clean(value);
    if (!v) return "";
    const hit = dict.get(normKey(v));
    if (hit) return hit;
    if (hasLists && dict.size) {
      const k = `${field}::${normKey(v)}`;
      const entry = offList.get(k) ?? { field, value: v, rows: [], tab };
      entry.rows.push(row);
      offList.set(k, entry);
    }
    return v;
  };

  // Uniformiza grafias livres (fora das listas) para a forma mais frequente.
  const freeForms = new Map<string, Map<string, number>>();
  const seenExact = new Map<string, string>();
  const seenNear = new Map<string, { tab: string; row: number }>();

  let capStatus = false,
    capDates = false,
    capDue = false,
    capFormat = false,
    capPriority = false,
    capPeople = false,
    capProject = false,
    capCompleted = false;

  for (const sheet of sheets) {
    const m = sheet.title.match(PAUTA_TAB);
    if (!m) continue;
    const regional = m[1].toUpperCase();
    const team = clean(m[2]);
    const header = findHeader(sheet.values);
    if (!header) {
      tabs.push({ title: sheet.title, regional, team, rows: 0, headerRow: null, missingColumns: ["TAREFA"] });
      issues.push({
        severity: "erro",
        code: "sem-cabecalho",
        tab: sheet.title,
        message: `A guia "${tabLabel(sheet.title)}" não tem a linha de cabeçalho com a coluna TAREFA e foi ignorada.`,
      });
      continue;
    }
    const col = header.map;
    const missing = REQUIRED.filter((f) => col[f] === undefined).map((f) => ALIASES[f][0].toUpperCase());
    if (missing.length) {
      issues.push({
        severity: "alerta",
        code: "colunas-ausentes",
        tab: sheet.title,
        message: `Colunas não encontradas em "${tabLabel(sheet.title)}": ${missing.join(", ")}.`,
      });
    }
    capStatus ||= col.status !== undefined;
    capDates ||= col.start !== undefined;
    capDue ||= col.due !== undefined;
    capFormat ||= col.format !== undefined;
    capPriority ||= col.priority !== undefined;
    capPeople ||= col.planners !== undefined || col.artDirectors !== undefined;
    capProject ||= col.project !== undefined;
    capCompleted ||= col.completed !== undefined;

    const get = (r: string[], f: Field) => (col[f] === undefined ? "" : clean(r[col[f]!]));
    let count = 0;

    for (let r = header.row + 1; r < sheet.values.length; r++) {
      const raw = sheet.values[r] ?? [];
      if (!raw.some((c) => clean(c))) continue;
      const rowNumber = r + 1;
      let task = get(raw, "task");
      if (!task) {
        issues.push({
          severity: "alerta",
          code: "sem-tarefa",
          tab: sheet.title,
          rows: [rowNumber],
          message: `Linha ${rowNumber} de "${tabLabel(sheet.title)}" tem dados mas está sem TAREFA.`,
        });
        task = "(sem título)";
      }

      const client = canon(dicts.client, get(raw, "client"), "Cliente", sheet.title, rowNumber);
      const bu = canon(dicts.bu, get(raw, "bu"), "Business Unit", sheet.title, rowNumber);
      const status = canon(dicts.status, get(raw, "status"), "Status", sheet.title, rowNumber);
      const format = canon(dicts.format, get(raw, "format"), "Formato", sheet.title, rowNumber);
      const priority = canon(dicts.priority, get(raw, "priority"), "Prioridade", sheet.title, rowNumber);
      const projectType = canon(dicts.projectType, get(raw, "projectType"), "Tipo de projeto", sheet.title, rowNumber);
      const planners = splitPeople(get(raw, "planners")).map((p) =>
        canon(dicts.person, p, "Pessoa", sheet.title, rowNumber),
      );
      const artDirectors = splitPeople(get(raw, "artDirectors")).map((p) =>
        canon(dicts.person, p, "Pessoa", sheet.title, rowNumber),
      );
      const people = Array.from(new Set([...planners, ...artDirectors]));

      const startP = parseDate(get(raw, "start"));
      const dueP = parseDate(get(raw, "due"));
      if (startP.invalid || dueP.invalid) {
        issues.push({
          severity: "alerta",
          code: "data-invalida",
          tab: sheet.title,
          rows: [rowNumber],
          message: `Data não reconhecida na linha ${rowNumber} de "${tabLabel(sheet.title)}" ("${task}").`,
        });
      }
      if (startP.iso && dueP.iso && dueP.iso < startP.iso) {
        issues.push({
          severity: "alerta",
          code: "entrega-antes-inicio",
          tab: sheet.title,
          rows: [rowNumber],
          message: `"${task}" tem ENTREGA anterior ao INÍCIO (linha ${rowNumber}).`,
        });
      }

      const cat = statusCategory(status);
      if (!status) {
        issues.push({
          severity: "alerta",
          code: "sem-status",
          tab: sheet.title,
          rows: [rowNumber],
          message: `"${task}" está sem STATUS (linha ${rowNumber}).`,
        });
      }

      const projectRaw = get(raw, "project");
      const projectKey = projectRaw ? `p::${normKey(projectRaw)}` : estimateProjectKey(task, client);

      const d: Demand = {
        id: `${sheet.title}#${rowNumber}`,
        sourceTab: sheet.title,
        row: rowNumber,
        regional,
        team,
        group: get(raw, "group"),
        task,
        client: client || "(sem cliente)",
        bu: bu || "(sem Business Unit)",
        status: status || "(sem status)",
        statusCategory: cat,
        start: startP.iso,
        due: dueP.iso,
        priority: priority || "(sem prioridade)",
        planners,
        artDirectors,
        people,
        format: format || "(sem formato)",
        projectType: projectType || "(sem tipo)",
        role: get(raw, "role"),
        notes: get(raw, "notes"),
        projectKey,
        projectLabel: projectRaw || "",
        isOpen: cat !== "finalizado",
      };

      // Duplicatas exatas (todas as colunas iguais) contam uma vez só.
      const exactSig = [
        normKey(d.task), normKey(d.client), normKey(d.bu), normKey(d.status), d.start, d.due,
        normKey(d.priority), d.planners.map(normKey).join("+"), d.artDirectors.map(normKey).join("+"),
        normKey(d.format), normKey(d.projectType), normKey(d.role), normKey(d.group),
      ].join("|");
      const prev = seenExact.get(exactSig);
      if (prev) {
        // Alertas da linha duplicada já foram registrados na original.
        for (let i = issues.length - 1; i >= 0; i--) {
          const it = issues[i];
          if (it.tab === sheet.title && it.rows?.length === 1 && it.rows[0] === rowNumber) issues.splice(i, 1);
        }
        issues.push({
          severity: "alerta",
          code: "duplicata-exata",
          tab: sheet.title,
          rows: [rowNumber],
          message: `"${task}" (linha ${rowNumber}) é idêntica a ${prev} e foi contada uma única vez.`,
        });
        continue;
      }
      seenExact.set(exactSig, `${tabLabel(sheet.title)}, linha ${rowNumber}`);

      // Possíveis duplicatas: mesma tarefa, cliente e datas, com algum campo diferente.
      const nearSig = [normKey(d.task), normKey(d.client), d.start, d.due].join("|");
      const near = seenNear.get(nearSig);
      if (near) {
        issues.push({
          severity: "alerta",
          code: "possivel-duplicata",
          tab: sheet.title,
          rows: [near.row, rowNumber],
          message: `"${task}" aparece nas linhas ${near.row} e ${rowNumber} com mesmas datas e campos diferentes. Mantidas as duas; confirme se é a mesma demanda.`,
        });
      } else {
        seenNear.set(nearSig, { tab: sheet.title, row: rowNumber });
      }

      const fk = normKey(d.client);
      const forms = freeForms.get(fk) ?? new Map<string, number>();
      forms.set(d.client, (forms.get(d.client) ?? 0) + 1);
      freeForms.set(fk, forms);

      demands.push(d);
      count++;
    }

    tabs.push({ title: sheet.title, regional, team, rows: count, headerRow: header.row + 1, missingColumns: missing });
  }

  // Unifica variações de grafia de clientes fora da lista (ex.: "CONSTRUCAP" e "Construcap").
  for (const d of demands) {
    const forms = freeForms.get(normKey(d.client));
    if (forms && forms.size > 1) {
      const best = [...forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
      d.client = best;
    }
  }

  // Rótulo dos projetos estimados: a tarefa com o nome mais curto do grupo.
  const groups = new Map<string, Demand[]>();
  demands.forEach((d) => {
    const g = groups.get(d.projectKey) ?? [];
    g.push(d);
    groups.set(d.projectKey, g);
  });
  groups.forEach((list) => {
    const label = list.find((d) => d.projectLabel)?.projectLabel ??
      [...list].sort((a, b) => a.task.length - b.task.length)[0].task;
    list.forEach((d) => (d.projectLabel = label));
  });

  offList.forEach((e) => {
    issues.push({
      severity: "info",
      code: "fora-da-lista",
      tab: e.tab,
      rows: e.rows,
      message: `${e.field} "${e.value}" não consta na guia Listas (${e.rows.length} ${e.rows.length === 1 ? "registro" : "registros"}).`,
    });
  });

  const openNoDue = demands.filter((d) => d.isOpen && !d.due && d.statusCategory !== "travado" && d.statusCategory !== "briefing");
  if (openNoDue.length) {
    issues.push({
      severity: "alerta",
      code: "aberta-sem-prazo",
      message: `${openNoDue.length} ${openNoDue.length === 1 ? "demanda aberta e em produção está" : "demandas abertas e em produção estão"} sem data de ENTREGA.`,
      rows: openNoDue.map((d) => d.row),
    });
  }
  const finishedNoDates = demands.filter((d) => !d.isOpen && (!d.start || !d.due));
  if (finishedNoDates.length) {
    issues.push({
      severity: "info",
      code: "finalizada-sem-data",
      message: `${finishedNoDates.length} demandas finalizadas sem INÍCIO ou ENTREGA ficam fora da linha do tempo.`,
    });
  }
  const noPeople = demands.filter((d) => d.people.length === 0);
  if (noPeople.length) {
    issues.push({
      severity: "alerta",
      code: "sem-responsavel",
      message: `${noPeople.length} ${noPeople.length === 1 ? "demanda" : "demandas"} sem responsável em PLANEJAMENTO ou DIRETOR DE ARTE.`,
      rows: noPeople.map((d) => d.row),
    });
  }
  const noPriority = demands.filter((d) => d.priority === "(sem prioridade)");
  if (noPriority.length) {
    issues.push({
      severity: "info",
      code: "sem-prioridade",
      message: `${noPriority.length} ${noPriority.length === 1 ? "demanda está" : "demandas estão"} sem PRIORIDADE.`,
      rows: noPriority.map((d) => d.row),
    });
  }
  if (!capProject) {
    issues.push({
      severity: "info",
      code: "projeto-estimado",
      message:
        "Não existe coluna PROJETO. A contagem de projetos é uma estimativa: tarefas do mesmo cliente com o mesmo nome, ignorando versões (V2, V3) e idioma (ENG, Inglês), formam um projeto.",
    });
  }
  if (!capCompleted) {
    issues.push({
      severity: "info",
      code: "sem-data-conclusao",
      message:
        "Não existe coluna de data de conclusão. Por isso não é possível medir entregas dentro do prazo nem tempo médio de execução; ENTREGA é tratada como prazo planejado.",
    });
  }

  const reconciliation = reconcile(sheets, demands, tabs, now);
  reconciliation
    .filter((r) => r.sheet !== r.dashboard)
    .forEach((r) =>
      issues.push({
        severity: "info",
        code: "conferencia",
        tab: r.tab,
        message: `Conferência com a Visão Geral: ${r.metric} em "${tabLabel(r.tab)}" é ${r.sheet} na planilha e ${r.dashboard} aqui.`,
      }),
    );

  return {
    tabs,
    demands,
    issues,
    reconciliation,
    lists,
    capabilities: {
      hasStatus: capStatus,
      hasDates: capDates,
      hasDue: capDue,
      hasFormat: capFormat,
      hasPriority: capPriority,
      hasPeople: capPeople,
      hasProjectColumn: capProject,
      hasCompletionDate: capCompleted,
    },
  };
}

/** Compara os números calculados com o quadro "Por time" da guia Visão Geral. */
function reconcile(sheets: RawSheet[], demands: Demand[], tabs: TabInfo[], now: Date): Reconciliation[] {
  const sheet = sheets.find((s) => normKey(s.title) === OVERVIEW_TAB);
  if (!sheet) return [];
  const rIdx = sheet.values.findIndex((row) => row.some((c) => normKey(c) === "por time"));
  if (rIdx < 0) return [];
  const head = sheet.values[rIdx].map(normKey);
  const labelCol = head.indexOf("por time");
  const cols = {
    Tarefas: head.indexOf("tarefas"),
    Ativas: head.indexOf("ativas"),
    Atrasadas: head.indexOf("atrasadas"),
    "Em 7 dias": head.indexOf("em 7 dias"),
  };
  const today = todayISO(now);
  const in7 = addDaysISO(today, 7);
  const out: Reconciliation[] = [];
  for (let r = rIdx + 1; r < sheet.values.length; r++) {
    const label = clean(sheet.values[r]?.[labelCol]);
    if (!label || normKey(label) === "total") break;
    const tab = tabs.find((t) => normKey(t.title) === normKey(label));
    if (!tab) continue;
    const rows = demands.filter((d) => d.sourceTab === tab.title);
    const open = rows.filter((d) => d.isOpen);
    const calc: Record<string, number> = {
      Tarefas: rows.length,
      Ativas: open.length,
      Atrasadas: open.filter((d) => d.due && d.due < today).length,
      "Em 7 dias": open.filter((d) => d.due && d.due >= today && d.due <= in7).length,
    };
    (Object.keys(cols) as (keyof typeof cols)[]).forEach((metric) => {
      const c = cols[metric];
      if (c < 0) return;
      const v = Number(clean(sheet.values[r]?.[c]).replace(",", "."));
      if (Number.isNaN(v)) return;
      out.push({ tab: tab.title, metric, sheet: v, dashboard: calc[metric] });
    });
  }
  return out;
}
