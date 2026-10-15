"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Database, Loader2, X } from "lucide-react";
import { useDataset } from "./useDataset";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FilterBar } from "./FilterBar";
import { KpiGrid } from "./Kpis";
import { Insights } from "./Insights";
import { Drawer, downloadCsv } from "./Drawer";
import { GlossaryModal, QualityModal } from "./Panels";
import { Wordmark } from "./Wordmark";
import { BuChart, ClientsChart, FormatsByBu, FormatsChart, NatureChart, PriorityChart, TopClients } from "./charts/distribution";
import { PeopleChart, StatusChart, WorkloadChart } from "./charts/operation";
import { DeadlinesPanel, TimelineChart } from "./charts/time";
import { HeatmapChart, ProjectsByBu, RegionalChart } from "./charts/structure";
import type { ChartCtx, DrillRequest } from "./charts/types";
import { applyFilters, computeKpis, EMPTY_FILTERS, isLate, toCsv, CAT_LABEL, type Filters } from "@/lib/analytics";
import { todayISO } from "@/lib/text";
import { colorMap } from "./theme";

const STORE = "ci-filters-v1";
const KEYS = Object.keys(EMPTY_FILTERS) as (keyof Filters)[];

function readFilters(): Filters {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  const qs = new URLSearchParams(window.location.search);
  // Vindo da central: "Visão Geral" sempre abre o consolidado, sem filtros antigos.
  if (qs.has("visao")) return EMPTY_FILTERS;
  if ([...qs.keys()].some((k) => KEYS.includes(k as keyof Filters))) {
    const f = { ...EMPTY_FILTERS } as Record<string, string | null>;
    KEYS.forEach((k) => (f[k] = qs.get(k) ?? (k === "dateField" ? "start" : null)));
    return f as unknown as Filters;
  }
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") };
  } catch {
    return EMPTY_FILTERS;
  }
}

export default function Dashboard() {
  const { data, state, error, refresh } = useDataset();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [ready, setReady] = useState(false);
  const [drill, setDrill] = useState<DrillRequest | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [quality, setQuality] = useState(false);
  const [glossary, setGlossary] = useState(false);
  const [today, setToday] = useState(todayISO());

  useEffect(() => {
    setFilters(readFilters());
    try {
      setCollapsed(localStorage.getItem("ci-collapsed") === "1");
    } catch {}
    setReady(true);
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Persistência dos filtros (somente preferências não sensíveis) na URL e no navegador.
  useEffect(() => {
    if (!ready) return;
    const qs = new URLSearchParams();
    KEYS.forEach((k) => {
      const v = filters[k];
      if (v && !(k === "dateField" && v === "start")) qs.set(k, v);
    });
    const url = `${window.location.pathname}${qs.toString() ? "?" + qs : ""}`;
    window.history.replaceState(null, "", url);
    try {
      localStorage.setItem(STORE, JSON.stringify(filters));
    } catch {}
  }, [filters, ready]);

  // Filtros que apontam para valores que deixaram de existir na planilha são descartados.
  useEffect(() => {
    if (!data) return;
    const tabs = data.tabs;
    setFilters((f) => {
      const next = { ...f };
      if (f.regional && !tabs.some((t) => t.regional === f.regional)) next.regional = null;
      if (f.team && !tabs.some((t) => t.team === f.team && (!next.regional || t.regional === next.regional))) next.team = null;
      return next;
    });
  }, [data]);

  const update = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const navigate = useCallback((regional: string | null, team: string | null) => {
    setFilters((f) => ({ ...f, regional, team }));
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const all = data?.demands ?? [];
  const tabs = data?.tabs ?? [];
  const rows = useMemo(() => applyFilters(all, filters), [all, filters]);
  /** Base sem regional/time: usada para comparar regionais e na matriz time × BU. */
  const crossRows = useMemo(() => applyFilters(all, { ...filters, regional: null, team: null }), [all, filters]);
  /** Base do contexto de navegação: alimenta as opções dos filtros. */
  const navRows = useMemo(() => applyFilters(all, { ...EMPTY_FILTERS, regional: filters.regional, team: filters.team }), [all, filters.regional, filters.team]);
  const kpis = useMemo(() => computeKpis(rows, today), [rows, today]);

  const buOrder = useMemo(() => {
    const listed = data?.lists["Business Unit"] ?? [];
    const present = [...new Set(all.map((d) => d.bu))];
    return [...listed.filter((b) => present.includes(b)), ...present.filter((b) => !listed.includes(b)).sort()];
  }, [data, all]);
  const buColors = useMemo(() => colorMap(buOrder), [buOrder]);

  const ctx: ChartCtx | null = data
    ? { today, buColors, buOrder, tabs, filters, capabilities: data.capabilities, drill: setDrill, navigate }
    : null;

  const context = filters.regional ? `${filters.regional}${filters.team ? " · " + filters.team : " · todos os times"}` : "Visão Geral";
  const contextTabs = tabs.filter((t) => (!filters.regional || t.regional === filters.regional) && (!filters.team || t.team === filters.team));
  const emptyContext = !!filters.regional && !navRows.length;
  const teamsInRegional = tabs.filter((t) => t.regional === filters.regional).map((t) => t.team);

  // Modo apresentação: tela cheia, sem barra lateral; rotação opcional pelas regionais com dados.
  const togglePresent = async () => {
    if (!presenting) {
      setPresenting(true);
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {}
    } else {
      setPresenting(false);
      setRotating(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const onFs = () => !document.fullscreenElement && presenting && setPresenting(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting]);
  const rotIdx = useRef(0);
  useEffect(() => {
    if (!rotating) return;
    const stops: (string | null)[] = [null, ...[...new Set(tabs.filter((t) => t.rows > 0).map((t) => t.regional))]];
    const id = setInterval(() => {
      rotIdx.current = (rotIdx.current + 1) % stops.length;
      setFilters((f) => ({ ...f, regional: stops[rotIdx.current], team: null }));
    }, 30_000);
    return () => clearInterval(id);
  }, [rotating, tabs]);

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
        <Wordmark full className="text-[28px]" />
        {state === "error" ? (
          <div className="max-w-md space-y-3">
            <p className="flex items-center justify-center gap-2 text-clf-coral">
              <AlertTriangle size={16} /> Não foi possível carregar a pauta.
            </p>
            <p className="text-[13px] text-paper-mute">{error}</p>
            <button className="btn mx-auto" onClick={refresh}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-paper-mute">
            <Loader2 size={15} className="animate-spin" /> Lendo as guias da planilha
          </p>
        )}
      </main>
    );
  }

  const alerts = data.issues.filter((i) => i.severity !== "info").length;
  const half = "col-span-12 xl:col-span-6";

  return (
    <div className="flex min-h-screen bg-ink">
      {!presenting && (
        <Sidebar
          tabs={tabs}
          regional={filters.regional}
          team={filters.team}
          collapsed={collapsed}
          alerts={alerts}
          onToggle={() => {
            setCollapsed((c) => {
              try {
                localStorage.setItem("ci-collapsed", c ? "0" : "1");
              } catch {}
              return !c;
            });
          }}
          onNavigate={navigate}
          onQuality={() => setQuality(true)}
          onGlossary={() => setGlossary(true)}
        />
      )}

      {/* Navegação móvel */}
      <AnimatePresence>
        {mobileNav && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)}>
            <motion.nav initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="h-full w-[270px] overflow-y-auto border-r border-ink-700 bg-ink-900 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <Wordmark className="text-[14px]" />
                <button onClick={() => setMobileNav(false)} aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>
              <a href="/" className="mb-1 block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-ink-800">
                Central
              </a>
              <button className="mb-1 block w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-ink-800" onClick={() => navigate(null, null)}>
                Visão Geral
              </button>
              {tabs.map((t) => (
                <button key={t.title} className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-paper-dim hover:bg-ink-800" onClick={() => navigate(t.regional, t.team)}>
                  {t.title} <span className="text-paper-faint">({t.rows})</span>
                </button>
              ))}
              <button className="mt-4 block w-full rounded-lg px-3 py-2 text-left text-[13px] text-paper-dim hover:bg-ink-800" onClick={() => setQuality(true)}>
                Qualidade dos dados
              </button>
              <button className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-paper-dim hover:bg-ink-800" onClick={() => setGlossary(true)}>
                Definições das métricas
              </button>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1">
        <Topbar
          data={data}
          state={state}
          error={error}
          context={context}
          presenting={presenting}
          rotating={rotating}
          onRefresh={refresh}
          onPresent={togglePresent}
          onRotate={() => setRotating((r) => !r)}
          onMobileMenu={() => setMobileNav(true)}
          onExportCsv={() => downloadCsv(`california-pauta-${today}`, toCsv(rows))}
          onSearchPick={(kind, value, row) => {
            if (kind === "client") update({ client: value });
            else if (kind === "person") update({ person: value });
            else if (row) setDrill({ title: row.task, subtitle: row.client, rows: all.filter((d) => d.projectKey === row.projectKey) });
          }}
        />

        <main className={`mx-auto w-full max-w-[2200px] space-y-4 px-4 py-5 sm:px-6 ${presenting ? "2xl:px-10" : ""}`}>
          {data.source === "demo" && (
            <div className="flex items-start gap-3 rounded-xl border border-[#c98500]/40 bg-[#c98500]/10 px-4 py-3 text-[12.5px] text-paper-dim">
              <Database size={15} className="mt-0.5 shrink-0 text-[#e0a73a]" />
              <span>
                <b className="text-paper">Modo demonstração.</b> {data.sourceLabel}. Configure as credenciais do Google para leitura ao vivo; esta faixa some automaticamente.
              </span>
            </div>
          )}
          {state === "stale" && (
            <div role="status" className="flex items-start gap-3 rounded-xl border border-clf-red/40 bg-clf-red/10 px-4 py-3 text-[12.5px] text-paper-dim">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-clf-red" />
              <span>
                <b className="text-paper">Exibindo a última leitura bem-sucedida.</b> {error}
              </span>
            </div>
          )}

          {!presenting && <FilterBar base={navRows} filters={filters} caps={data.capabilities} teams={teamsInRegional} onChange={update} onClear={() => setFilters((f) => ({ ...EMPTY_FILTERS, regional: f.regional, team: f.team }))} />}

          {!rows.length && (
            <div className="card px-6 py-10 text-center">
              <p className="display text-[24px]">{emptyContext ? "Pauta ainda sem registros" : "Sem demandas neste recorte"}</p>
              <p className="mx-auto mt-2 max-w-xl text-[13px] text-paper-mute">
                {emptyContext
                  ? `${contextTabs.length === 1 ? "A guia" : "As guias"} ${contextTabs.map((t) => t.title).join(", ")} ${contextTabs.length === 1 ? "existe" : "existem"} na planilha, mas ainda não ${contextTabs.length === 1 ? "tem" : "têm"} demandas. Indicadores e gráficos deste recorte aparecem sozinhos assim que a primeira linha for preenchida. Abaixo, a comparação com as demais regionais.`
                  : "Nenhuma demanda atende à combinação de filtros. Remova algum filtro para ampliar o recorte."}
              </p>
            </div>
          )}

          {rows.length > 0 && <KpiGrid
            k={kpis}
            caps={data.capabilities}
            onStatus={(cat) => setDrill({ title: CAT_LABEL[cat], subtitle: "Demandas por status", rows: rows.filter((d) => d.statusCategory === cat) })}
            onLate={() => setDrill({ title: "Atrasadas", subtitle: "Abertas com prazo vencido", rows: rows.filter((d) => isLate(d, today)) })}
          />}

          <Insights rows={rows} today={today} />

          {ctx && !rows.length && (
            <div className="grid grid-cols-12 gap-4">
              <RegionalChart rows={crossRows} ctx={ctx} className="col-span-12 lg:col-span-5" />
              <HeatmapChart rows={crossRows} ctx={ctx} className="col-span-12 lg:col-span-7" />
            </div>
          )}

          {ctx && rows.length > 0 && (
            <div className="grid grid-cols-12 gap-4">
              <ClientsChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-5" />
              <BuChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-4" />
              <FormatsChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-3" />

              <TimelineChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-7" />
              <StatusChart rows={rows} ctx={ctx} className="col-span-12 2xl:col-span-5" />

              <PeopleChart rows={rows} ctx={ctx} className={half} />
              <WorkloadChart rows={rows} ctx={ctx} className={half} />

              <DeadlinesPanel rows={rows} ctx={ctx} className="col-span-12 2xl:col-span-8" />
              <TopClients rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-4" />

              <RegionalChart rows={crossRows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-3" />
              <ProjectsByBu rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-4" />
              <HeatmapChart rows={crossRows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-5" />

              <NatureChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-12 2xl:col-span-6" />
              <FormatsByBu rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-3" />
              <PriorityChart rows={rows} ctx={ctx} className="col-span-12 lg:col-span-6 2xl:col-span-3" />
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-4 text-[11.5px] text-paper-faint">
            <span>
              Fonte: {data.spreadsheetTitle} · {data.tabs.length} guias · atualização automática a cada {data.refreshSeconds} s
            </span>
            <button className="hover:text-paper" onClick={() => setQuality(true)}>
              {alerts ? `${alerts} ${alerts === 1 ? "alerta" : "alertas"} de qualidade dos dados` : "Dados sem alertas"} · ver detalhes
            </button>
          </footer>
        </main>
      </div>

      <Drawer
        req={drill}
        today={today}
        onClose={() => setDrill(null)}
        onApply={(r) => {
          if (r.apply) update(r.apply);
          setDrill(null);
        }}
      />
      <QualityModal data={data} open={quality} onClose={() => setQuality(false)} />
      <GlossaryModal open={glossary} onClose={() => setGlossary(false)} />
    </div>
  );
}
