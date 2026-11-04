"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import type { ChartCtx, DrillRequest } from "./charts/types";
import { Avatar } from "./charts/operation";
import { ClientMark } from "./ClientMark";
import { useInsightItems } from "./Insights";
import { PresentTicker } from "./PresentTicker";
import { useFlash, useSheetPulse, type Toast } from "./SheetPulse";
import { CATEGORICAL, LATE, OTHER, STATUS_COLORS, STATUS_ORDER } from "./theme";
import { applyFilters, CAT_LABEL, isLate, type Filters } from "@/lib/analytics";
import { filterByPeriod } from "@/lib/period";
import { addDaysISO } from "@/lib/text";
import { computePressure } from "@/lib/pressure";
import { regionalName } from "@/lib/labels";
import { shortName } from "@/lib/people";
import { REGIONAL_PLACES } from "@/lib/regions";
import { TEAM_LOGOS, teamKey, teamOrder } from "@/lib/teams";
import type { Dataset, Demand, StatusCategory, TabInfo } from "@/lib/types";

interface Props {
  data: Dataset;
  filters: Filters;
  today: string;
  ctx: ChartCtx;
  onDrill: (r: DrillRequest) => void;
  onOpen: (regional: string | null, team: string | null) => void;
  presenting?: boolean;
}

/**
 * Panorama Horizontal: toda a pauta em uma única tela, sem rolagem, desenhada para monitores
 * super ultra-wide (32:9). Um lado por time (California e Content House), somando todas as regionais;
 * abaixo de cada time, um cartão por regional onde ele atua.
 * Tudo dentro dos cartões se dimensiona pelo próprio cartão (unidades cqh/cqw), então a tela
 * se preenche por inteiro em qualquer largura.
 */
export function PanoramaHorizontal({ data, filters, today, ctx, onDrill, onOpen, presenting }: Props) {
  const live = !!presenting;
  const reduce = useReducedMotion();
  const motionOn = live && !reduce;
  const scope = useMemo(() => ({ ...filters, regional: null, team: null }), [filters]);
  const all = data.demands;
  const scoped = useMemo(() => applyFilters(all, scope), [all, scope]);
  const periodRows = useMemo(() => filterByPeriod(scoped, filters.period, today), [scoped, filters.period, today]);
  // Um lado por time (California, Content House), cada um somando todas as regionais onde atua.
  const teams = useMemo(() => {
    const names = [...new Set(data.tabs.map((t) => t.team))].sort((a, b) => teamOrder(a) - teamOrder(b));
    return names.map((team) => ({ team, tabs: data.tabs.filter((t) => t.team === team) }));
  }, [data.tabs]);
  const teamOfTab = useMemo(() => new Map(data.tabs.map((t) => [t.title, t.team])), [data.tabs]);

  // Altura exata da área visível, para nada precisar de rolagem.
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current) return;
      const top = box.current.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(420, window.innerHeight - top - (live ? 44 : 0) - 24));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    const prev = box.current?.previousElementSibling;
    if (prev) ro.observe(prev);
    const t = window.setTimeout(measure, 300);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [live]);

  /* ---------- Modo telão ---------- */

  // Holofote: alterna entre os times, do mais pressionado ao mais tranquilo, pulando os vazios.
  const stats = useMemo(() => {
    const m = new Map<string, { rows: number; clients: number; index: number; open: number }>();
    teams.forEach(({ team }) => {
      const rows = periodRows.filter((d) => d.team === team);
      const pr = computePressure(rows, today);
      m.set(team, { rows: rows.length, clients: new Set(rows.filter((d) => d.isOpen).map((d) => d.client)).size, index: pr.index, open: pr.open });
    });
    return m;
  }, [teams, periodRows, today]);
  const tour = useMemo(
    () =>
      teams
        .map((t) => t.team)
        .filter((t) => (stats.get(t)?.rows ?? 0) > 0)
        .sort((a, b) => stats.get(b)!.index - stats.get(a)!.index || stats.get(b)!.open - stats.get(a)!.open),
    [teams, stats],
  );
  const tourKey = tour.join("|");
  const [spot, setSpot] = useState<string | null>(null);
  const [headline, setHeadline] = useState<Headline | null>(null);
  useEffect(() => {
    if (!live || !tour.length) {
      setSpot(null);
      return;
    }
    if (!spot || !tour.includes(spot)) {
      setSpot(tour[0]);
      return;
    }
    if (headline) return;
    // Com clientes há o que abrir no cartão: o holofote fica mais tempo.
    const dur = (stats.get(spot)?.clients ?? 0) > 0 ? 11000 : 7000;
    const t = window.setTimeout(() => setSpot(tour[(tour.indexOf(spot) + 1) % tour.length]), dur);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, spot, tourKey, headline]);

  // Ciclo de leitura: a cada minuto uma faixa de luz varre a parede e os números recontam.
  const SWEEP = 2.6;
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!motionOn) return;
    setCycle((c) => c + 1);
    const id = window.setInterval(() => setCycle((c) => c + 1), 60_000);
    return () => window.clearInterval(id);
  }, [motionOn]);

  // Manchete: de tempos em tempos, uma frase ocupa a parede inteira por alguns segundos.
  const headlines = useMemo(() => buildHeadlines(scoped, today), [scoped, today]);
  const hIdx = useRef(0);
  // As frases ficam numa ref: cada leitura nova da planilha atualiza o texto sem reiniciar o cronômetro.
  const hList = useRef(headlines);
  hList.current = headlines;
  useEffect(() => {
    if (!motionOn) {
      setHeadline(null);
      return;
    }
    let hide = 0;
    const show = () => {
      const list = hList.current;
      if (!list.length) return;
      setHeadline(list[hIdx.current % list.length]);
      hIdx.current++;
      hide = window.setTimeout(() => setHeadline(null), 6500);
    };
    const id = window.setInterval(show, 150_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide);
    };
  }, [motionOn]);

  const { toasts, flash } = useSheetPulse(all, data.version, live);

  return (
    <>
      <div
        ref={box}
        data-ph-grid
        className="relative grid gap-3"
        style={{ height: height || undefined, gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}
      >
        {teams.map(({ team, tabs }, ti) => {
          const rows = periodRows.filter((d) => d.team === team);
          const base = scoped.filter((d) => d.team === team);
          const regionals = tabs.map((t) => t.regional);
          const sweepDelay = ((ti + 0.5) / teams.length) * SWEEP;
          const counting = { cycle, delay: sweepDelay, on: motionOn };
          const tab: TabInfo = { title: team, regional: "", team, rows: tabs.reduce((a, t) => a + t.rows, 0), headerRow: null, missingColumns: [] };
          return (
            <section key={team} aria-label={team} className="flex min-h-0 flex-col gap-3">
              <TeamHeader team={team} regionals={regionals} index={ti} live={live} onOpen={() => onOpen(null, team)} />
              <div className="grid min-h-0 flex-1">
              <TeamTile
                tab={tab}
                rows={rows}
                base={base}
                today={today}
                delay={ti * 0.15}
                spotlight={live && spot === team}
                dimmed={live && !!spot && spot !== team && tour.length > 1}
                flash={Math.max(0, ...tabs.map((t) => flash[t.title] ?? 0))}
                toasts={live ? toasts.filter((x) => teamOfTab.get(x.tab) === team) : []}
                cycle={cycle}
                sweepDelay={sweepDelay}
                live={live}
                motionOn={motionOn}
                maxClients={12}
                maxPeople={14}
                ctx={ctx}
                onDrill={onDrill}
                onOpen={() => onOpen(null, team)}
              />
              </div>
              <div className="grid shrink-0 gap-3" style={{ height: "clamp(120px, 17vh, 250px)", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
                {tabs.map((t, ri) => (
                  <RegionCard
                    key={t.title}
                    tab={t}
                    rows={rows.filter((d) => d.sourceTab === t.title)}
                    today={today}
                    delay={ti * 0.15 + 0.3 + ri * 0.06}
                    flash={flash[t.title] ?? 0}
                    live={live}
                    counting={counting}
                    onOpen={() => onOpen(t.regional, t.team)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Faixa de luz do ciclo de leitura */}
        {motionOn && cycle > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[22px]">
            <motion.div
              key={cycle}
              className="absolute inset-y-0 w-[16%]"
              style={{
                background:
                  "linear-gradient(90deg, rgba(231,16,61,0) 0%, rgba(231,16,61,0.07) 35%, rgba(255,251,240,0.10) 50%, rgba(231,16,61,0.07) 65%, rgba(231,16,61,0) 100%)",
                mixBlendMode: "screen",
              }}
              initial={{ left: "-18%" }}
              animate={{ left: "102%" }}
              transition={{ duration: SWEEP, ease: [0.45, 0, 0.55, 1] }}
            >
              <span className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-paper/40 to-transparent" />
            </motion.div>
          </div>
        )}

        <AnimatePresence>{headline && <HeadlineOverlay key={headline.text} h={headline} />}</AnimatePresence>
      </div>
      {live && <PresentTicker demands={all} today={today} syncedAt={data.syncedAt} paused={!!headline} />}
    </>
  );
}

/* ---------- Manchete ---------- */

interface Headline {
  tag: string;
  text: string;
  tone: "alert" | "warn" | "neutral";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Frases curtas, tiradas da pauta aberta, para a manchete do telão. */
function buildHeadlines(rows: Demand[], today: string): Headline[] {
  const open = rows.filter((d) => d.isOpen);
  const out: Headline[] = [];
  const tomorrow = addDaysISO(today, 1);
  const byRegional = (list: Demand[]) => {
    const m = new Map<string, number>();
    list.forEach((d) => m.set(d.regional, (m.get(d.regional) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  byRegional(open.filter((d) => d.due === today)).forEach(([r, n]) => out.push({ tag: "Entregas de hoje", text: `${regionalName(r)} tem ${plural(n, "entrega", "entregas")} hoje`, tone: "warn" }));
  byRegional(open.filter((d) => d.due === tomorrow)).forEach(([r, n]) => out.push({ tag: "Amanhã", text: `${regionalName(r)} tem ${plural(n, "entrega", "entregas")} amanhã`, tone: "neutral" }));
  const lateTeams = new Map<string, { r: string; t: string; n: number }>();
  open
    .filter((d) => isLate(d, today))
    .forEach((d) => {
      const k = d.sourceTab;
      const cur = lateTeams.get(k) ?? { r: d.regional, t: d.team, n: 0 };
      cur.n++;
      lateTeams.set(k, cur);
    });
  [...lateTeams.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .forEach((x) => out.push({ tag: "Atenção", text: `${regionalName(x.r)} · ${x.t} tem ${plural(x.n, "demanda vencida", "demandas vencidas")}`, tone: "alert" }));
  const week = addDaysISO(today, -7);
  const entered = rows.filter((d) => d.start && d.start > week && d.start <= today).length;
  if (entered) out.push({ tag: "Semana", text: `${plural(entered, "demanda entrou", "demandas entraram")} na pauta nos últimos 7 dias`, tone: "neutral" });
  const clients = new Map<string, number>();
  open.forEach((d) => clients.set(d.client, (clients.get(d.client) ?? 0) + 1));
  const top = [...clients.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) out.push({ tag: "Destaque", text: `${top[0]} lidera a pauta aberta com ${plural(top[1], "demanda", "demandas")}`, tone: "neutral" });
  const blocked = open.filter((d) => d.statusCategory === "travado").length;
  if (blocked) out.push({ tag: "Travadas", text: `${plural(blocked, "demanda travada", "demandas travadas")} na pauta`, tone: "alert" });
  const people = new Set(open.flatMap((d) => d.people)).size;
  if (people) out.push({ tag: "Criação", text: `${plural(people, "pessoa da criação", "pessoas da criação")} com demandas em andamento`, tone: "neutral" });
  return out;
}

function HeadlineOverlay({ h }: { h: Headline }) {
  const words = h.text.split(" ");
  const color = h.tone === "alert" ? LATE : h.tone === "warn" ? "#F5C451" : "#FFFBF0";
  return (
    <motion.div
      role="status"
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[22px] text-center"
      style={{ background: "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(11,11,12,0.94) 0%, rgba(11,11,12,0.86) 60%, rgba(11,11,12,0.7) 100%)", backdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        className="rounded-full border px-4 py-1 text-[clamp(12px,1.5vh,20px)] font-semibold uppercase tracking-wide2"
        style={{ color, borderColor: `${color}55` }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {h.tag}
      </motion.span>
      <p className="display mt-[2.4vh] max-w-[78%] leading-[1.02] text-paper" style={{ fontSize: "clamp(44px, 9vh, 150px)" }}>
        {words.map((w, i) => (
          <motion.span
            key={i}
            className="inline-block"
            style={{ marginRight: "0.24em" }}
            initial={{ opacity: 0, y: "0.4em", filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.35 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
          </motion.span>
        ))}
      </p>
      <motion.span
        className="mt-[3vh] h-[3px] rounded-full bg-clf-red"
        initial={{ width: 0 }}
        animate={{ width: "18%" }}
        transition={{ delay: 0.6, duration: 5.4, ease: "linear" }}
      />
    </motion.div>
  );
}

/* ---------- Cabeçalho do time ---------- */

function TeamHeader({ team, regionals, index, live, onOpen }: { team: string; regionals: string[]; index: number; live: boolean; onOpen: () => void }) {
  // As fotos das cidades onde o time atua se alternam atrás da marca.
  const photos = useMemo(() => regionals.flatMap((r) => (REGIONAL_PLACES[r]?.photos ?? []).slice(0, 2)), [regionals]);
  const reduce = useReducedMotion();
  const [pi, setPi] = useState(index * 2);
  useEffect(() => {
    if (!live || photos.length < 2 || reduce) return;
    const id = window.setInterval(() => setPi((i) => i + 1), 7000 + index * 1300);
    return () => window.clearInterval(id);
  }, [live, photos.length, reduce, index]);
  const photo = photos.length ? photos[pi % photos.length] : null;
  const logo = TEAM_LOGOS[teamKey(team)];
  const isCalifornia = teamKey(team) === "california";
  return (
    <header className="relative h-[clamp(64px,9vh,132px)] shrink-0 overflow-hidden rounded-[22px] border border-white/[0.08]">
      <AnimatePresence initial={false}>
        {photo && (
          <motion.img
            key={photo.src}
            src={photo.src}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{ objectPosition: photo.position ?? "50% 50%", filter: "blur(14px) saturate(120%)" }}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: live && !reduce ? 1.22 : 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.4 }, scale: { duration: 10, ease: "linear" } }}
          />
        )}
      </AnimatePresence>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 130% at 50% 50%, rgba(231,16,61,0.18) 0%, rgba(231,16,61,0) 70%), linear-gradient(rgba(11,11,12,0.55), rgba(11,11,12,0.78))",
        }}
      />
      <button onClick={onOpen} className="group relative flex h-full w-full flex-col items-center justify-center text-center" title={`Abrir a pauta de ${team} em todas as regionais`}>
        <motion.span initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.src} alt={team} width={logo.w} height={logo.h} className="w-auto" style={{ height: isCalifornia ? "clamp(26px, 4.6vh, 66px)" : "clamp(18px, 3.2vh, 46px)" }} />
          ) : (
            <span className="display leading-none text-paper" style={{ fontSize: "clamp(28px, 5vh, 76px)" }}>
              {team}
            </span>
          )}
        </motion.span>
        <span className="mt-[1vh] text-[clamp(10px,1.2vh,14px)] uppercase tracking-wide2 text-paper-dim">{regionals.map(regionalName).join(" · ")}</span>
      </button>
    </header>
  );
}

/* ---------- Cartão da regional (dentro do lado de um time) ---------- */

function RegionCard({
  tab,
  rows,
  today,
  delay,
  flash,
  live,
  counting,
  onOpen,
}: {
  tab: TabInfo;
  rows: Demand[];
  today: string;
  delay: number;
  flash: number;
  live: boolean;
  counting: Counting;
  onOpen: () => void;
}) {
  const pr = useMemo(() => computePressure(rows, today), [rows, today]);
  const flashing = useFlash(flash, live);
  const status = useMemo(() => {
    const m = new Map<StatusCategory, number>();
    rows.forEach((d) => m.set(d.statusCategory, (m.get(d.statusCategory) ?? 0) + 1));
    return STATUS_ORDER.filter((c) => m.get(c)).map((c) => ({ cat: c, n: m.get(c)! }));
  }, [rows]);
  const photo = REGIONAL_PLACES[tab.regional]?.photos?.[0];
  return (
    <motion.button
      onClick={onOpen}
      title={`Abrir dashboard de ${regionalName(tab.regional)} · ${tab.team}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/[0.07] bg-white/[0.025] text-left transition hover:border-white/20 ${flashing ? "ci-flash" : ""}`}
      style={{ containerType: "size" }}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} alt="" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[38%] w-full object-cover opacity-40" style={{ filter: "blur(10px) saturate(120%)", maskImage: "linear-gradient(#000, transparent)" }} />
      )}
      <div className="relative flex min-h-0 flex-1 flex-col justify-between" style={{ padding: "min(8cqh, 5cqw)", ["--r" as string]: "min(1cqh, 0.62cqw)" }}>
        <div className="flex items-center justify-between">
          <span className="display truncate leading-none text-paper" style={{ fontSize: "max(16px, calc(var(--r) * 14))" }}>
            {regionalName(tab.regional)}
          </span>
          <ArrowUpRight className="shrink-0 text-paper-mute transition group-hover:text-paper" style={{ width: "max(14px, calc(var(--r) * 9))", height: "max(14px, calc(var(--r) * 9))" }} />
        </div>
        {rows.length ? (
          <>
            <div className="grid grid-cols-4">
              <MiniMetric label="Abertas" value={pr.open} counting={counting} />
              <MiniMetric label="Vencidas" value={pr.late} color={pr.late ? LATE : undefined} counting={counting} />
              <MiniMetric label="Em 7 dias" value={pr.dueSoon} counting={counting} />
              <MiniMetric label="Travadas" value={pr.blocked} color={pr.blocked ? "#d95926" : undefined} counting={counting} />
            </div>
            <div className="flex w-full overflow-hidden rounded-full bg-white/[0.06]" style={{ height: "max(4px, calc(var(--r) * 3.4))" }}>
              {status.map((st) => (
                <span key={st.cat} className={`h-full ${counting.on && FLOWING.has(st.cat) ? "ph-flow" : ""}`} style={{ width: `${(st.n / rows.length) * 100}%`, background: STATUS_COLORS[st.cat] }} title={`${CAT_LABEL[st.cat]}: ${st.n}`} />
              ))}
            </div>
          </>
        ) : (
          <span className="text-paper-mute" style={{ fontSize: "max(11px, calc(var(--r) * 5))" }}>
            {tab.rows === 0 ? "Pauta ainda sem registros" : "Nenhuma demanda no filtro atual"}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function MiniMetric({ label, value, color, counting }: { label: string; value: number; color?: string; counting: Counting }) {
  const shown = useCountUp(value, counting);
  return (
    <span className="min-w-0">
      <span className="display block tabular-nums leading-none" style={{ fontSize: "max(18px, calc(var(--r) * 19))", color: color ?? "#FFFBF0" }}>
        {shown}
      </span>
      <span className="mt-[0.3em] block truncate text-paper-mute" style={{ fontSize: "max(10px, calc(var(--r) * 5.6))" }}>
        {label}
      </span>
    </span>
  );
}

/* ---------- Cartão do time ---------- */

function TeamTile(p: {
  tab: TabInfo;
  rows: Demand[];
  base: Demand[];
  today: string;
  delay: number;
  spotlight: boolean;
  dimmed: boolean;
  flash: number;
  toasts: Toast[];
  cycle: number;
  sweepDelay: number;
  live: boolean;
  motionOn: boolean;
  maxClients?: number;
  maxPeople?: number;
  ctx: ChartCtx;
  onDrill: (r: DrillRequest) => void;
  onOpen: () => void;
}) {
  const { tab, rows, today } = p;
  const pr = useMemo(() => computePressure(rows, today), [rows, today]);
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const flashing = useFlash(p.flash, p.live);
  const logo = TEAM_LOGOS[teamKey(tab.team)];
  const label = tab.regional ? `${regionalName(tab.regional)} · ${tab.team}` : `${tab.team} · todas as regionais`;

  const types = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((d) => {
      const t = d.projectType?.trim() || "Sem tipo";
      m.set(t, (m.get(t) ?? 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => (a[0] === "Sem tipo" ? 1 : b[0] === "Sem tipo" ? -1 : b[1] - a[1]))
      .map(([name, n], i) => ({ name, n, color: name === "Sem tipo" ? OTHER : CATEGORICAL[i % CATEGORICAL.length] }));
  }, [rows]);
  const status = useMemo(() => {
    const m = new Map<StatusCategory, number>();
    rows.forEach((d) => m.set(d.statusCategory, (m.get(d.statusCategory) ?? 0) + 1));
    return STATUS_ORDER.filter((c) => m.get(c)).map((c) => ({ cat: c, n: m.get(c)! }));
  }, [rows]);
  const clients = useMemo(() => {
    const m = new Map<string, { open: number; late: number }>();
    open.forEach((d) => {
      const s = m.get(d.client) ?? { open: 0, late: 0 };
      s.open++;
      if (isLate(d, today)) s.late++;
      m.set(d.client, s);
    });
    return [...m.entries()].sort((a, b) => b[1].open - a[1].open || a[0].localeCompare(b[0])).map(([name, s]) => ({ name, ...s }));
  }, [open, today]);
  const people = useMemo(() => {
    const m = new Map<string, number>();
    open.forEach((d) => d.people.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, n }));
  }, [open]);

  // No holofote, o cartão abre sozinho os clientes mais carregados (até dois, alternando).
  const [spotIdx, setSpotIdx] = useState(0);
  const spotCount = Math.min(2, clients.length);
  useEffect(() => {
    setSpotIdx(0);
    if (!p.spotlight || spotCount < 2) return;
    const id = window.setInterval(() => setSpotIdx((i) => (i + 1) % spotCount), 5500);
    return () => window.clearInterval(id);
  }, [p.spotlight, spotCount]);
  const spotClient = p.spotlight && spotCount ? clients[spotIdx % spotCount] : null;
  const counting = { cycle: p.cycle, delay: p.sweepDelay, on: p.motionOn };

  const drillClient = (name: string) => p.onDrill({ title: name, subtitle: `Demandas abertas · ${label}`, rows: open.filter((d) => d.client === name), apply: { client: name } });
  const drillPerson = (name: string) => p.onDrill({ title: name, subtitle: `Demandas abertas · ${label}`, rows: open.filter((d) => d.people.includes(name)), apply: { person: name } });
  const drillStatus = (cat: StatusCategory) => p.onDrill({ title: CAT_LABEL[cat], subtitle: label, rows: rows.filter((d) => d.statusCategory === cat) });
  const drillType = (name: string) =>
    p.onDrill({ title: name, subtitle: `Tipo de demanda · ${label}`, rows: rows.filter((d) => (d.projectType?.trim() || "Sem tipo") === name), apply: name === "Sem tipo" ? undefined : { projectType: name } });

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, scale: p.spotlight ? 1.012 : 1 }}
      transition={{ opacity: { duration: 0.6, delay: p.delay }, y: { duration: 0.6, delay: p.delay, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[22px] border bg-white/[0.025] transition-[filter,border-color,box-shadow] duration-700 ${
        p.spotlight ? "border-clf-red/70 shadow-[0_0_40px_rgba(231,16,61,0.18)]" : "border-white/[0.07]"
      } ${p.dimmed && !p.toasts.length ? "brightness-[0.5] saturate-[0.6]" : ""} ${flashing ? "ci-flash" : ""}`}
      style={{ containerType: "size" }}
      aria-label={label}
    >
      <div className="ph-body min-h-0 flex-1" style={{ padding: "calc(var(--u) * 3.4)", rowGap: "calc(var(--u) * 2.6)" }}>
        {/* Logo do time e atalho para a dashboard */}
        <div className="ph-head flex shrink-0 items-center justify-between">
          {!tab.regional ? (
            // Lado do time: a marca já está no cabeçalho acima, aqui fica só o recorte.
            <span className="eyebrow" style={{ fontSize: "max(10px, calc(var(--u) * 2))" }}>
              Todas as regionais
            </span>
          ) : logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.src} alt={tab.team} width={logo.w} height={logo.h} className="w-auto" style={{ height: teamKey(tab.team) === "california" ? "calc(var(--u) * 6)" : "calc(var(--u) * 4)" }} />
          ) : (
            <span className="display text-paper" style={{ fontSize: "calc(var(--u) * 6)" }}>
              {tab.team}
            </span>
          )}
          <button onClick={p.onOpen} className="flex items-center gap-1 text-paper-mute hover:text-paper" style={{ fontSize: "max(10px, calc(var(--u) * 2.2))" }} title={`Abrir dashboard de ${label}`}>
            Abrir <ArrowUpRight style={{ width: "1.2em", height: "1.2em" }} />
          </button>
        </div>

        {tab.rows === 0 || !rows.length ? (
          <div className="ph-head row-span-2 flex items-center justify-center text-center text-paper-mute" style={{ fontSize: "calc(var(--u) * 2.8)" }}>
            {tab.rows === 0 ? "Pauta ainda sem registros" : "Nenhuma demanda no filtro atual"}
          </div>
        ) : (
          <>
            <div className="ph-left flex min-h-0 flex-col" style={{ gap: "calc(var(--u) * 2.6)" }}>
            {/* Régua de números */}
            <div className="grid shrink-0 grid-cols-4 border-y border-white/[0.07]" style={{ paddingBlock: "calc(var(--u) * 1.8)" }}>
              <Metric label="Abertas" value={pr.open} {...counting} />
              <Metric label="Vencidas" value={pr.late} alert={pr.late > 0} {...counting} />
              <Metric label="Em 7 dias" value={pr.dueSoon} {...counting} />
              <Metric label="Travadas" value={pr.blocked} warn={pr.blocked > 0} {...counting} />
            </div>

            {/* Tipos de Demanda e Status */}
            <div className="ph-mix grid shrink-0" style={{ gap: "calc(var(--u) * 3)" }}>
              <div className="flex min-w-0 items-center" style={{ gap: "calc(var(--u) * 2.2)" }}>
                <Donut items={types} total={rows.length} delay={p.delay} onPick={drillType} counting={counting} />
                <ul className="min-w-0 flex-1" style={{ fontSize: "max(10px, calc(var(--u) * 2.1))" }}>
                  {types.slice(0, 5).map((t) => (
                    <li key={t.name}>
                      <button onClick={() => drillType(t.name)} className="flex w-full items-center gap-[0.5em] rounded px-1 py-[0.15em] text-left hover:bg-white/[0.06]">
                        <span className="h-[0.7em] w-[0.7em] shrink-0 rounded-sm" style={{ background: t.color }} />
                        <span className="min-w-0 flex-1 truncate text-paper-dim">{t.name}</span>
                        <span className="tabular-nums text-paper">{t.n}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex min-w-0 flex-col justify-center" style={{ gap: "calc(var(--u) * 1.6)" }}>
                <span className="eyebrow" style={{ fontSize: "max(10px, calc(var(--u) * 1.8))" }}>
                  Status
                </span>
                <div className="flex w-full overflow-hidden rounded-full bg-white/[0.06]" style={{ height: "calc(var(--u) * 2.6)" }}>
                  {status.map((s, i) => (
                    <motion.button
                      key={s.cat}
                      onClick={() => drillStatus(s.cat)}
                      title={`${CAT_LABEL[s.cat]}: ${s.n}`}
                      className={`h-full ${p.motionOn && FLOWING.has(s.cat) ? "ph-flow" : ""}`}
                      style={{ background: STATUS_COLORS[s.cat], ["--ph-d" as string]: `${((p.delay * 7) % 2.8).toFixed(2)}s` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.n / rows.length) * 100}%` }}
                      transition={{ duration: 0.9, delay: p.delay + 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-[1em]" style={{ fontSize: "max(10px, calc(var(--u) * 2))" }}>
                  {status.map((s) => (
                    <li key={s.cat}>
                      <button onClick={() => drillStatus(s.cat)} className="flex w-full items-center gap-[0.45em] rounded px-1 py-[0.1em] text-left hover:bg-white/[0.06]">
                        <span className="h-[0.65em] w-[0.65em] shrink-0 rounded-sm" style={{ background: STATUS_COLORS[s.cat] }} />
                        <span className="min-w-0 flex-1 truncate text-paper-dim">{CAT_LABEL[s.cat]}</span>
                        <span className="tabular-nums text-paper">{s.n}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            </div>

            <div className="ph-right flex min-h-0 flex-col" style={{ gap: "calc(var(--u) * 2.6)" }}>
            {/* Clientes e colaboradores em pauta */}
            <CircleRow
              title="Clientes em Pauta"
              empty="Nenhum cliente com demanda aberta"
              items={clients}
              max={p.maxClients ?? 8}
              delay={p.delay}
              live={p.motionOn}
              hold={p.spotlight}
              render={(c, size) => (
                <button onClick={() => drillClient(c.name)} className="group flex w-full min-w-0 flex-col items-center" title={`${c.name} · ${c.open} abertas${c.late ? ` · ${c.late} vencidas` : ""}`}>
                  <span className={`relative rounded-full transition-shadow duration-500 ${spotClient?.name === c.name ? "shadow-[0_0_0_3px_#151517,0_0_0_5px_#E7103D]" : ""}`}>
                    <ClientMark name={c.name} size={size} className="transition group-hover:scale-105" />
                    <Badge value={c.open} size={size} />
                    {c.late > 0 && <Badge value={c.late} size={size} late />}
                  </span>
                  <span className="mt-[0.4em] w-full truncate text-center text-paper-dim" style={{ fontSize: Math.max(9, size * 0.18) }}>
                    {c.name}
                  </span>
                </button>
              )}
            />
            <CircleRow
              title="Colaboradores em Pauta"
              empty="Nenhuma demanda aberta com responsável"
              items={people}
              max={p.maxPeople ?? 10}
              delay={p.delay + 0.15}
              live={p.motionOn}
              hold={false}
              render={(x, size) => (
                <button onClick={() => drillPerson(x.name)} className="group flex w-full min-w-0 flex-col items-center" title={`${x.name} · ${x.n} abertas`}>
                  <span className="relative">
                    <Avatar name={x.name} size={size} />
                    <Badge value={x.n} size={size} />
                  </span>
                  <span className="mt-[0.4em] w-full truncate text-center text-paper-dim" style={{ fontSize: Math.max(9, size * 0.18) }}>
                    {shortName(x.name).split(" ")[0]}
                  </span>
                </button>
              )}
            />

            {spotClient ? (
              <SpotPanel key={spotClient.name} client={spotClient} rows={open.filter((d) => d.client === spotClient.name)} today={today} />
            ) : (
              <InsightLine rows={rows} base={p.base} today={today} />
            )}
            </div>
          </>
        )}
        <TileToasts toasts={p.toasts} />
      </div>
    </motion.article>
  );
}

interface Counting {
  cycle: number;
  delay: number;
  on: boolean;
}

/** Status em que há trabalho acontecendo: o trecho da barra ganha um brilho correndo. */
const FLOWING = new Set<StatusCategory>(["pauta", "briefing", "aprovacao"]);

/** Reconta de zero até o valor quando o ciclo de leitura passa pela coluna (só no modo telão). */
function useCountUp(value: number, { cycle, delay, on }: Counting) {
  const [v, setV] = useState(value);
  const val = useRef(value);
  val.current = value;
  const busy = useRef(false);
  useEffect(() => {
    if (!busy.current) setV(value);
  }, [value]);
  useEffect(() => {
    if (!on || !cycle) {
      setV(val.current);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const dur = 1100;
    busy.current = true;
    const step = (now: number) => {
      if (now < t0) {
        raf = requestAnimationFrame(step);
        return;
      }
      const k = Math.min(1, (now - t0) / dur);
      setV(Math.round(val.current * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else busy.current = false;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      busy.current = false;
    };
  }, [cycle, on, delay]);
  return v;
}

function Metric({ label, value, alert, warn, ...counting }: { label: string; value: number; alert?: boolean; warn?: boolean } & Counting) {
  const shown = useCountUp(value, counting);
  return (
    <div className="min-w-0 text-center">
      <span className="display block tabular-nums leading-none" style={{ fontSize: "calc(var(--u) * 8)", color: alert ? LATE : warn ? "#d95926" : "#FFFBF0" }}>
        {shown}
      </span>
      <span className="mt-[0.35em] block truncate text-paper-mute" style={{ fontSize: "max(10px, calc(var(--u) * 1.9))" }}>
        {label}
      </span>
    </div>
  );
}

function Badge({ value, size, late }: { value: number; size: number; late?: boolean }) {
  const h = Math.round(Math.max(14, size * (late ? 0.26 : 0.32)));
  return (
    <span
      className={`absolute flex items-center justify-center rounded-full border-2 border-[#19191b] font-semibold leading-none ${late ? "-right-1 -top-1 text-white" : "-bottom-1 -right-1 bg-paper text-ink"}`}
      style={{ height: h, minWidth: h, paddingInline: h * 0.2, fontSize: h * 0.56, background: late ? LATE : undefined }}
    >
      {value}
    </span>
  );
}

/** Rosca em SVG que se desenha ao entrar. */
function Donut({ items, total, delay, onPick, counting }: { items: { name: string; n: number; color: string }[]; total: number; delay: number; onPick: (name: string) => void; counting: Counting }) {
  const shown = useCountUp(total, counting);
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: "calc(var(--u) * 20)", height: "calc(var(--u) * 20)" }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {items.map((it, i) => {
          const len = (it.n / Math.max(1, total)) * c;
          const gap = items.length > 1 ? Math.min(2, len * 0.3) : 0;
          const off = acc;
          acc += len;
          return (
            <motion.circle
              key={it.name}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={it.color}
              strokeWidth="12"
              strokeDashoffset={-off}
              initial={{ strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${Math.max(0, len - gap)} ${c}` }}
              transition={{ duration: 0.9, delay: delay + 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="cursor-pointer"
              onClick={() => onPick(it.name)}
            >
              <title>{`${it.name}: ${it.n}`}</title>
            </motion.circle>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="display tabular-nums leading-none text-paper" style={{ fontSize: "calc(var(--u) * 5.4)" }}>
          {shown}
        </span>
        <span className="text-paper-mute" style={{ fontSize: "max(10px, calc(var(--u) * 1.5))" }}>
          demandas
        </span>
      </div>
    </div>
  );
}

/**
 * Uma fileira de círculos que ocupa toda a largura; o tamanho acompanha a largura e a altura do cartão.
 * No modo telão, quando não cabem todos, a fileira troca de página sozinha em vez de esconder o resto.
 */
function CircleRow<T extends { name: string }>({
  title,
  empty,
  items,
  max,
  delay,
  live,
  hold,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  max: number;
  delay: number;
  live: boolean;
  /** Fica na primeira página (holofote aberto num cliente dela). */
  hold: boolean;
  render: (item: T, size: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const art = el.closest("article");
      const h = art?.clientHeight ?? 400;
      const wide = art ? art.clientWidth / h >= 1.5 : false;
      // Cartão largo: duas colunas, sobra altura. Cartão quase quadrado: tudo empilhado, círculos menores.
      setDims({ w: e.contentRect.width, h: h * (wide ? 1 : 0.62) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pages = Math.ceil(items.length / max);
  const [page, setPage] = useState(0);
  const rotating = live && !hold && pages > 1;
  useEffect(() => {
    if (!rotating) {
      setPage(0);
      return;
    }
    const id = window.setInterval(() => setPage((p) => (p + 1) % pages), 6000);
    return () => window.clearInterval(id);
  }, [rotating, pages]);
  const pg = rotating ? page % pages : 0;
  const slice = items.slice(pg * max, pg * max + max);
  const n = Math.min(items.length, max);
  const colW = n ? dims.w / n : 0;
  const size = Math.max(22, Math.min(colW * 0.72, dims.h * 0.13, 120));
  return (
    <div className="flex min-h-0 shrink-0 flex-col" style={{ gap: "calc(var(--u) * 1.4)" }}>
      <span className="flex items-center justify-between">
        <span className="eyebrow" style={{ fontSize: "max(10px, calc(var(--u) * 1.8))" }}>
          {title}
        </span>
        {rotating ? (
          <span className="flex items-center" style={{ gap: "calc(var(--u) * 0.6)" }} aria-label={`Página ${pg + 1} de ${pages}`}>
            {Array.from({ length: pages }, (_, i) => (
              <span key={i} className={`rounded-full transition-all duration-500 ${i === pg ? "bg-paper" : "bg-white/20"}`} style={{ height: "calc(var(--u) * 0.8)", width: i === pg ? "calc(var(--u) * 2.4)" : "calc(var(--u) * 0.8)" }} />
            ))}
          </span>
        ) : (
          items.length > max && (
            <span className="text-paper-faint" style={{ fontSize: "max(10px, calc(var(--u) * 1.7))" }}>
              +{items.length - max}
            </span>
          )
        )}
      </span>
      <div ref={ref}>
        {n ? (
          <motion.div
            key={pg}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: pg ? 0.05 : delay + 0.4 } } }}
          >
            {dims.w > 0 &&
              slice.map((item) => (
                <motion.div key={item.name} className="flex min-w-0 justify-center" variants={{ hidden: { opacity: 0, scale: 0.6, y: 10 }, show: { opacity: 1, scale: 1, y: 0 } }}>
                  {render(item, size)}
                </motion.div>
              ))}
          </motion.div>
        ) : (
          <p className="text-paper-faint" style={{ fontSize: "max(10px, calc(var(--u) * 2))" }}>
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

/** Holofote: as demandas abertas do cliente em destaque, vencidas primeiro. */
function SpotPanel({ client, rows, today }: { client: { name: string; open: number; late: number }; rows: Demand[]; today: string }) {
  const list = [...rows]
    .sort((a, b) => Number(isLate(b, today)) - Number(isLate(a, today)) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 4);
  const fmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "sem prazo");
  return (
    <motion.div
      className="mt-auto flex min-h-0 flex-1 flex-col justify-end overflow-hidden"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-clf-red/30 bg-clf-red/[0.07]" style={{ padding: "calc(var(--u) * 1.8)", gap: "calc(var(--u) * 1)" }}>
        <div className="flex shrink-0 items-baseline justify-between" style={{ gap: "calc(var(--u) * 1.4)", fontSize: "max(11px, calc(var(--u) * 2.2))" }}>
          <span className="min-w-0 truncate font-semibold text-paper">{client.name}</span>
          <span className="shrink-0 text-paper-dim">
            {client.open} {client.open === 1 ? "aberta" : "abertas"}
            {client.late ? <b className="ml-[0.6em] font-semibold text-clf-red">{client.late} {client.late === 1 ? "vencida" : "vencidas"}</b> : null}
          </span>
        </div>
        <ul className="min-h-0 overflow-hidden" style={{ fontSize: "max(10px, calc(var(--u) * 1.9))" }}>
          {list.map((d, i) => {
            const late = isLate(d, today);
            return (
              <motion.li
                key={d.id}
                className="flex items-center border-t border-white/[0.06] first:border-t-0"
                style={{ gap: "calc(var(--u) * 1.2)", paddingBlock: "calc(var(--u) * 0.6)" }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <span className="h-[0.6em] w-[0.6em] shrink-0 rounded-sm" style={{ background: STATUS_COLORS[d.statusCategory] }} />
                <span className="min-w-0 flex-1 truncate text-paper">{d.task}</span>
                <span className="shrink-0 text-paper-mute">{d.status}</span>
                <span className={`shrink-0 tabular-nums ${late ? "font-semibold text-clf-red" : "text-paper-dim"}`}>{fmt(d.due)}</span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}

/** Avisos de mudança na planilha, dentro do cartão do time que mudou. */
function TileToasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-stretch" style={{ padding: "calc(var(--u) * 2)", gap: "calc(var(--u) * 1)" }}>
      <AnimatePresence>
        {toasts.slice(-2).map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-center rounded-2xl border bg-[#1b1b1d]/95 shadow-2xl backdrop-blur-xl ${t.kind === "new" ? "border-clf-red/50" : "border-[#F5C451]/40"}`}
            style={{ gap: "calc(var(--u) * 1.6)", padding: "calc(var(--u) * 1.6)" }}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-full ${t.kind === "new" ? "bg-clf-red/15 text-clf-red" : "bg-[#F5C451]/15 text-[#F5C451]"}`}
              style={{ width: "calc(var(--u) * 4.4)", height: "calc(var(--u) * 4.4)" }}
            >
              {t.kind === "new" ? <Sparkles style={{ width: "50%", height: "50%" }} /> : <RefreshCw style={{ width: "50%", height: "50%" }} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-paper" style={{ fontSize: "max(11px, calc(var(--u) * 2.2))" }}>
                {t.kind === "new" ? t.title.replace(/ em .*$/, "") : "Status atualizado"}
              </span>
              <span className="block truncate text-paper-dim" style={{ fontSize: "max(10px, calc(var(--u) * 2))" }}>
                {t.text}
              </span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Uma frase dos Insights por vez, trocando sozinha. */
function InsightLine({ rows, base, today }: { rows: Demand[]; base: Demand[]; today: string }) {
  const items = useInsightItems(rows, today, base);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % items.length), 9000);
    return () => window.clearInterval(id);
  }, [items.length]);
  const cur = items[i % Math.max(1, items.length)];
  if (!cur) return <div className="flex-1" />;
  return (
    <div className="ph-insight mt-auto min-h-0 w-full flex-1 overflow-hidden">
      <div className="ph-insight-box absolute bottom-0 left-0 right-0 flex items-center rounded-2xl border border-[#F5C451]/20 bg-[#F5C451]/[0.05]" style={{ gap: "calc(var(--u) * 1.6)", padding: "calc(var(--u) * 1.8)" }}>
        <Lightbulb className="shrink-0 text-[#F5C451]" style={{ width: "calc(var(--u) * 3)", height: "calc(var(--u) * 3)" }} />
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ fontSize: "max(10px, calc(var(--u) * 2.2))" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={cur.k} className="line-clamp-2 leading-snug text-paper-dim [&_b]:font-semibold [&_b]:text-paper" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              {cur.text}
            </motion.p>
          </AnimatePresence>
        </div>
        {items.length > 1 && (
          <span className="flex shrink-0 items-center">
            <button onClick={() => setI((x) => (x - 1 + items.length) % items.length)} className="rounded-full p-1 text-paper-mute hover:text-paper" aria-label="Insight anterior">
              <ChevronLeft style={{ width: "calc(var(--u) * 2.4)", height: "calc(var(--u) * 2.4)" }} />
            </button>
            <button onClick={() => setI((x) => (x + 1) % items.length)} className="rounded-full p-1 text-paper-mute hover:text-paper" aria-label="Próximo insight">
              <ChevronRight style={{ width: "calc(var(--u) * 2.4)", height: "calc(var(--u) * 2.4)" }} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
