"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Headline } from "./Kpis";
import { PeriodScope } from "./PeriodScope";
import { WorkloadChart } from "./charts/operation";
import { TopClients } from "./charts/distribution";
import type { ChartCtx, DrillRequest } from "./charts/types";
import { applyFilters, computeKpis, type Filters } from "@/lib/analytics";
import { filterByPeriod } from "@/lib/period";
import { regionalName } from "@/lib/labels";
import { REGIONAL_PLACES } from "@/lib/regions";
import { TEAM_LOGOS, teamKey, teamOrder } from "@/lib/teams";
import type { Dataset, Demand, TabInfo } from "@/lib/types";

interface Props {
  data: Dataset;
  filters: Filters;
  today: string;
  ctx: ChartCtx;
  onDrill: (r: DrillRequest) => void;
  onOpen: (regional: string, team: string | null) => void;
}

/** Rola até a seção e corrige a posição depois que os gráficos acima terminam de montar. */
function jumpTo(id: string) {
  const go = (behavior: ScrollBehavior) => document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
  go("smooth");
  [700, 1400, 2200].forEach((t) => setTimeout(() => go("auto"), t));
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sectionId = (regional: string, team?: string) => (team ? `time-${slug(regional)}-${slug(team)}` : `regional-${slug(regional)}`);

interface Unit {
  regional: string;
  tabs: TabInfo[];
}

/**
 * Página longa com uma seção por regional e, dentro dela, um bloco enxuto por time:
 * Projetos, Status e Insights; Clientes em Pauta; Demandas por Colaboradores e Top 10 Clientes.
 */
export function Panorama({ data, filters, today, ctx, onDrill, onOpen }: Props) {
  const scope = useMemo(() => ({ ...filters, regional: null, team: null }), [filters]);
  const all = data.demands;

  // Regionais na ordem das guias da planilha, como no menu lateral.
  const units: Unit[] = useMemo(() => {
    const codes = [...new Set(data.tabs.map((t) => t.regional))];
    return codes.map((regional) => ({ regional, tabs: data.tabs.filter((t) => t.regional === regional).sort((a, b) => teamOrder(a.team) - teamOrder(b.team)) }));
  }, [data.tabs]);

  const sections = units.map((u) => ({ id: sectionId(u.regional), label: regionalName(u.regional) }));
  const active = useScrollSpy(sections.map((s) => s.id));
  const statusDrill = (rows: Demand[]) => (status: string) => onDrill({ title: status, subtitle: "Demandas por status", rows: rows.filter((d) => d.status === status), apply: { status } });

  return (
    <div className="space-y-12">
      <nav aria-label="Regionais do Panorama" className="no-print sticky top-[68px] z-20 -mx-4 border-b border-white/[0.06] bg-ink/80 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <ul className="flex gap-1.5 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(s.id);
                }}
                className={`block rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                  active === s.id ? "border-white/30 bg-white/[0.12] text-paper" : "border-white/[0.08] bg-white/[0.03] text-paper-mute hover:border-white/20 hover:text-paper"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {units.map((u) => (
        <section key={u.regional} id={sectionId(u.regional)} className="scroll-mt-[118px] space-y-5">
          <RegionalBand regional={u.regional} teams={u.tabs.map((t) => t.team)} onOpen={() => onOpen(u.regional, null)} />
          {u.tabs.map((t) => (
            <TeamBlock key={t.title} tab={t} caps={data.capabilities} onStatus={statusDrill} all={all} scope={scope} filters={filters} today={today} ctx={ctx} onOpen={() => onOpen(u.regional, t.team)} />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Faixa de abertura de cada regional: foto da cidade desfocada ocupando toda a largura,
 * só atrás do nome, para marcar a troca de regional sem pesar sobre os gráficos.
 */
function RegionalBand({ regional, teams, onOpen }: { regional: string; teams: string[]; onOpen: () => void }) {
  const photo = REGIONAL_PLACES[regional]?.photos[0];
  return (
    <header className="relative -mx-4 overflow-hidden border-y border-white/[0.08] sm:-mx-6">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full scale-110 select-none object-cover" style={{ objectPosition: photo.position ?? "50% 50%", filter: "blur(14px) saturate(125%)" }} />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: photo
            ? "radial-gradient(ellipse 60% 90% at 50% 50%, rgba(231,16,61,0.18) 0%, rgba(231,16,61,0) 70%), linear-gradient(rgba(11,11,12,0.55), rgba(11,11,12,0.7))"
            : "radial-gradient(ellipse 60% 120% at 50% 50%, rgba(231,16,61,0.22) 0%, rgba(231,16,61,0) 70%), #121214",
        }}
      />
      <div className="relative flex flex-col items-center justify-center px-4 py-9 text-center sm:py-11">
        <p className="eyebrow text-paper-dim">{teams.length > 1 ? `Regional · ${teams.join(" e ")}` : `Regional · ${teams[0] ?? ""}`}</p>
        <h2 className="display mt-1.5 text-[52px] leading-none text-paper sm:text-[72px]">{regionalName(regional)}</h2>
        <button onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-paper-dim hover:text-paper">
          Abrir dashboard da regional <ArrowRight size={14} />
        </button>
      </div>
    </header>
  );
}

function TeamBlock(p: {
  tab: TabInfo;
  caps: Dataset["capabilities"];
  onStatus: (rows: Demand[]) => (status: string) => void;
  all: Demand[];
  scope: Filters;
  filters: Filters;
  today: string;
  ctx: ChartCtx;
  onOpen: () => void;
}) {
  const { tab } = p;
  const teamFilters = useMemo(() => ({ ...p.scope, regional: tab.regional, team: tab.team }), [p.scope, tab.regional, tab.team]);
  const base = useMemo(() => applyFilters(p.all, teamFilters), [p.all, teamFilters]);
  const rows = useMemo(() => filterByPeriod(base, p.filters.period, p.today), [base, p.filters.period, p.today]);
  const kpis = useMemo(() => computeKpis(rows, p.today), [rows, p.today]);
  const ctx = useMemo(() => ({ ...p.ctx, filters: teamFilters }), [p.ctx, teamFilters]);
  const logo = TEAM_LOGOS[teamKey(tab.team)];
  return (
    <div id={sectionId(tab.regional, tab.team)} className="scroll-mt-[118px] space-y-4 rounded-[28px] border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-[34px] items-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.src} alt={tab.team} width={logo.w} height={logo.h} className={`${logo.className} w-auto`} />
          ) : (
            <span className="display text-[26px] text-paper">{tab.team}</span>
          )}
        </div>
        <button onClick={p.onOpen} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-paper-dim hover:text-paper">
          Abrir dashboard de {tab.team} <ArrowRight size={14} />
        </button>
      </div>
      {tab.rows === 0 ? (
        <p className="card px-6 py-8 text-center text-[13px] text-paper-mute">Pauta ainda sem registros. Os indicadores de {tab.team} aparecem assim que a primeira linha da guia for preenchida.</p>
      ) : !rows.length ? (
        <p className="card px-6 py-8 text-center text-[13px] text-paper-mute">Nenhuma demanda de {tab.team} no filtro atual.</p>
      ) : (
        <>
          <Headline k={kpis} caps={p.caps} rows={rows} trendRows={base} today={p.today} onStatus={p.onStatus(rows)} onDrill={p.ctx.drill} row />
          <LazyMount estimate={460}>
            <div className="grid grid-cols-12 gap-4">
              <PeriodScope base={base} ctx={ctx} global={p.filters.period} render={(r) => <WorkloadChart rows={r} ctx={ctx} mode="clique" className="col-span-12 lg:col-span-8" />} />
              <PeriodScope Chart={TopClients} base={base} ctx={ctx} global={p.filters.period} className="col-span-12 lg:col-span-4" />
            </div>
          </LazyMount>
        </>
      )}
    </div>
  );
}

/* ---------- Utilitários ---------- */

/** Só monta os gráficos quando a seção se aproxima da tela: a página fica leve mesmo com várias regionais. */
function LazyMount({ children, estimate }: { children: React.ReactNode; estimate: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show || !ref.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShow(true), { rootMargin: "900px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show]);
  return <div ref={ref}>{show ? children : <div className="card animate-pulse opacity-40" style={{ minHeight: estimate }} />}</div>;
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    const onScroll = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}
