"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { PresentProvider } from "./present";
import { PresentTicker } from "./PresentTicker";
import { PulseToasts, useFlash, useSheetPulse } from "./SheetPulse";
import { Headline } from "./Kpis";
import { PeriodScope } from "./PeriodScope";
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
  /** Modo apresentação: liga o "modo telão" (percurso automático, animações, letreiro e avisos). */
  presenting?: boolean;
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

/** Uma parada do percurso automático do modo telão. */
interface Stop {
  key: string;
  kind: "band" | "team";
  regional: string;
  team?: string;
  /** Bloco a mostrar e, na segunda parada do time, o trecho dentro dele (Colaboradores em Pauta). */
  targetId: string;
  selector?: string;
  phase?: "top" | "bottom";
  dur: number;
  label: string;
}

const bandId = (regional: string) => `faixa-${slug(regional)}`;

function scrollToStop(s: Stop, reduce: boolean | null) {
  let el = document.getElementById(s.targetId);
  if (el && s.selector) el = (el.querySelector(s.selector) as HTMLElement | null) ?? el;
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 126;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
}


/**
 * Página longa com uma seção por regional e, dentro dela, um bloco enxuto por time:
 * Projetos, Status e Insights; Clientes em Pauta; Colaboradores em Pauta; Top 10 Clientes.
 */
export function Panorama({ data, filters, today, ctx, onDrill, onOpen, presenting }: Props) {
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

  /* ---------- Modo telão ---------- */
  const live = !!presenting;
  const reduce = useReducedMotion();
  // Quanto há para mostrar em cada time: o percurso pula trechos vazios e dá tempo ao holofote.
  const periodRows = useMemo(() => filterByPeriod(applyFilters(all, scope), filters.period, today), [all, scope, filters.period, today]);
  const counts = useMemo(() => {
    const m = new Map<string, { rows: number; clients: number; people: number }>();
    data.tabs.forEach((t) => {
      const rows = periodRows.filter((d) => d.sourceTab === t.title);
      const open = rows.filter((d) => d.isOpen);
      m.set(t.title, { rows: rows.length, clients: new Set(open.map((d) => d.client)).size, people: new Set(open.flatMap((d) => d.people)).size });
    });
    return m;
  }, [periodRows, data.tabs]);
  const stops: Stop[] = useMemo(
    () =>
      units.flatMap((u) => [
        { key: `b-${u.regional}`, kind: "band" as const, regional: u.regional, targetId: bandId(u.regional), dur: 6500, label: regionalName(u.regional) },
        ...u.tabs.flatMap((t): Stop[] => {
          const id = sectionId(u.regional, t.team);
          const label = `${regionalName(u.regional)} · ${t.team}`;
          const c = counts.get(t.title) ?? { rows: 0, clients: 0, people: 0 };
          if (!c.rows) return [{ key: `t-${t.title}`, kind: "team", regional: u.regional, team: t.team, targetId: id, phase: "top", dur: 6000, label }];
          // Abertura: gráficos e insights; com clientes em pauta, soma o tempo do holofote (até 3, 3,8 s cada).
          const top = c.clients ? 4500 + Math.min(3, c.clients) * 3800 + 2500 : 11000;
          const out: Stop[] = [{ key: `t-${t.title}`, kind: "team", regional: u.regional, team: t.team, targetId: id, phase: "top", dur: top, label }];
          if (c.people)
            out.push({ key: `p-${t.title}`, kind: "team", regional: u.regional, team: t.team, targetId: id, selector: '[data-strip="colaboradores"]', phase: "bottom", dur: 1800 + Math.min(3, c.people) * 3800 + 4000, label });
          return out;
        }),
      ]),
    [units, counts],
  );
  const [stopIdx, setStopIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState<Record<string, number>>({});
  const stop = live ? stops[stopIdx % Math.max(1, stops.length)] : undefined;

  useEffect(() => {
    if (!live) {
      setStopIdx(0);
      setPaused(false);
    }
  }, [live]);
  // A cada parada: conta a entrada (para os gráficos se montarem de novo) e rola até ela.
  useEffect(() => {
    if (!stop) return;
    if (stop.kind === "band" || stop.phase === "top") setEntries((e) => ({ ...e, [stop.targetId]: (e[stop.targetId] ?? 0) + 1 }));
    const t1 = window.setTimeout(() => scrollToStop(stop, reduce), 60);
    const t2 = window.setTimeout(() => scrollToStop(stop, reduce), 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.key, live]);
  // Avança para a próxima parada. Depende só da chave e da duração: uma nova leitura da planilha não reinicia o tempo.
  useEffect(() => {
    if (!stop || paused) return;
    const t = window.setTimeout(() => setStopIdx((i) => (i + 1) % stops.length), stop.dur);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.key, stop?.dur, paused, stops.length]);
  const go = useCallback((n: number) => setStopIdx((i) => (i + n + stops.length) % stops.length), [stops.length]);
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, go]);

  const { toasts, flash } = useSheetPulse(all, data.version, live);

  return (
    <div className={`space-y-12 ${live ? "ci-present pb-20" : ""}`}>
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
          <RegionalBand regional={u.regional} teams={u.tabs.map((t) => t.team)} onOpen={() => onOpen(u.regional, null)} live={live} entry={entries[bandId(u.regional)] ?? 0} />
          {u.tabs.map((t) => {
            const id = sectionId(u.regional, t.team);
            return (
              <TeamBlock
                key={t.title}
                tab={t}
                caps={data.capabilities}
                onStatus={statusDrill}
                all={all}
                scope={scope}
                filters={filters}
                today={today}
                ctx={ctx}
                onOpen={() => onOpen(u.regional, t.team)}
                present={{ on: live, paused, phase: stop?.targetId === id ? stop.phase ?? null : null }}
                entry={entries[id] ?? 0}
                flash={flash[t.title] ?? 0}
              />
            );
          })}
        </section>
      ))}

      {live && (
        <>
          <PresentTicker demands={all} today={today} syncedAt={data.syncedAt} paused={paused} />
          {stop && (
            <div className="no-print fixed bottom-[56px] right-4 z-40 flex items-center gap-3 rounded-full border border-white/[0.1] bg-ink/85 py-1.5 pl-4 pr-1.5 shadow-2xl backdrop-blur-xl">
              <div className="min-w-[180px]">
                <p className="text-[11.5px] font-medium text-paper">{stop.label}</p>
                <span className="mt-1 block h-[2px] w-full overflow-hidden rounded-full bg-white/[0.1]">
                  {paused ? (
                    <span className="block h-full w-1/2 bg-paper-mute" />
                  ) : (
                    <motion.span key={`${stop.key}-${stopIdx}`} className="block h-full bg-clf-red" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: stop.dur / 1000, ease: "linear" }} />
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => go(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-paper-mute hover:bg-white/[0.08] hover:text-paper" aria-label="Parada anterior" title="Anterior (seta para a esquerda)">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPaused((p) => !p)} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink hover:bg-white" aria-label={paused ? "Retomar" : "Pausar"} title={paused ? "Retomar (espaço)" : "Pausar (espaço)"}>
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button onClick={() => go(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-paper-mute hover:bg-white/[0.08] hover:text-paper" aria-label="Próxima parada" title="Próxima (seta para a direita)">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          <PulseToasts toasts={toasts} />
        </>
      )}
    </div>
  );
}

/**
 * Faixa de abertura de cada regional: foto da cidade desfocada ocupando toda a largura,
 * só atrás do nome, para marcar a troca de regional sem pesar sobre os gráficos.
 */
function RegionalBand({ regional, teams, onOpen, live, entry }: { regional: string; teams: string[]; onOpen: () => void; live: boolean; entry: number }) {
  const photos = REGIONAL_PLACES[regional]?.photos ?? [];
  const reduce = useReducedMotion();
  const [pi, setPi] = useState(0);
  // Modo telão: as fotos da cidade se alternam com uma aproximação lenta.
  useEffect(() => {
    if (!live || photos.length < 2 || reduce) return;
    const id = window.setInterval(() => setPi((i) => (i + 1) % photos.length), 5500);
    return () => window.clearInterval(id);
  }, [live, photos.length, reduce]);
  const photo = photos[live ? pi % Math.max(1, photos.length) : 0];
  const imgStyle = { objectPosition: photo?.position ?? "50% 50%", filter: "blur(14px) saturate(125%)" };
  const eyebrow = teams.length > 1 ? `Regional · ${teams.join(" e ")}` : `Regional · ${teams[0] ?? ""}`;
  return (
    <header id={bandId(regional)} className="relative -mx-4 overflow-hidden border-y border-white/[0.08] sm:-mx-6">
      {photo &&
        (live ? (
          <AnimatePresence initial={false}>
            <motion.img
              key={photo.src}
              src={photo.src}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-cover"
              style={imgStyle}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: reduce ? 1.1 : 1.24 }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 1.4, ease: "easeInOut" }, scale: { duration: 9, ease: "linear" } }}
            />
          </AnimatePresence>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.src} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full scale-110 select-none object-cover" style={imgStyle} />
        ))}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: photo
            ? "radial-gradient(ellipse 60% 90% at 50% 50%, rgba(231,16,61,0.18) 0%, rgba(231,16,61,0) 70%), linear-gradient(rgba(11,11,12,0.55), rgba(11,11,12,0.7))"
            : "radial-gradient(ellipse 60% 120% at 50% 50%, rgba(231,16,61,0.22) 0%, rgba(231,16,61,0) 70%), #121214",
        }}
      />
      <div className={`relative flex flex-col items-center justify-center px-4 text-center ${live ? "py-14 sm:py-20" : "py-9 sm:py-11"}`}>
        {live ? (
          <motion.div key={entry} className="flex flex-col items-center">
            <motion.p className="eyebrow text-paper-dim" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              {eyebrow}
            </motion.p>
            <motion.h2
              className="display mt-2 text-[64px] leading-none text-paper sm:text-[104px]"
              initial={{ opacity: 0, y: 30, letterSpacing: "0.14em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0em" }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {regionalName(regional)}
            </motion.h2>
            <motion.span aria-hidden className="mt-4 block h-[2px] bg-clf-red" initial={{ width: 0 }} animate={{ width: 96 }} transition={{ duration: 0.8, delay: 0.5 }} />
          </motion.div>
        ) : (
          <>
            <p className="eyebrow text-paper-dim">{eyebrow}</p>
            <h2 className="display mt-1.5 text-[52px] leading-none text-paper sm:text-[72px]">{regionalName(regional)}</h2>
            <button onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-paper-dim hover:text-paper">
              Abrir dashboard da regional <ArrowRight size={14} />
            </button>
          </>
        )}
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
  present: { on: boolean; paused: boolean; phase: "top" | "bottom" | null };
  /** Quantas vezes o percurso entrou neste bloco: muda a chave e os gráficos se montam de novo. */
  entry: number;
  /** Momento da última mudança na planilha que afetou este time. */
  flash: number;
}) {
  const { tab } = p;
  const flashing = useFlash(p.flash, p.present.on);
  const teamFilters = useMemo(() => ({ ...p.scope, regional: tab.regional, team: tab.team }), [p.scope, tab.regional, tab.team]);
  const base = useMemo(() => applyFilters(p.all, teamFilters), [p.all, teamFilters]);
  const rows = useMemo(() => filterByPeriod(base, p.filters.period, p.today), [base, p.filters.period, p.today]);
  const kpis = useMemo(() => computeKpis(rows, p.today), [rows, p.today]);
  const ctx = useMemo(() => ({ ...p.ctx, filters: teamFilters }), [p.ctx, teamFilters]);
  const logo = TEAM_LOGOS[teamKey(tab.team)];
  return (
    <PresentProvider value={p.present}>
    <div id={sectionId(tab.regional, tab.team)} className={`scroll-mt-[118px] space-y-4 rounded-[28px] border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 ${flashing ? "ci-flash" : ""}`}>
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
        <div key={p.present.on ? `entrada-${p.entry}` : "fixo"} className="space-y-4">
          <Headline k={kpis} caps={p.caps} rows={rows} trendRows={base} today={p.today} onStatus={p.onStatus(rows)} onDrill={p.ctx.drill} row />
          <LazyMount estimate={520}>
            <PeriodScope Chart={TopClients} base={base} ctx={ctx} global={p.filters.period} />
          </LazyMount>
        </div>
      )}
    </div>
    </PresentProvider>
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
