"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import type { ChartCtx, DrillRequest } from "./charts/types";
import { Avatar } from "./charts/operation";
import { ClientMark } from "./ClientMark";
import { useInsightItems } from "./Insights";
import { PresentTicker } from "./PresentTicker";
import { PulseToasts, useFlash, useSheetPulse } from "./SheetPulse";
import { CATEGORICAL, LATE, OTHER, STATUS_COLORS, STATUS_ORDER } from "./theme";
import { applyFilters, CAT_LABEL, isLate, type Filters } from "@/lib/analytics";
import { filterByPeriod } from "@/lib/period";
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
  onOpen: (regional: string, team: string | null) => void;
  presenting?: boolean;
}

/**
 * Panorama Horizontal: todas as regionais e times em uma única tela, sem rolagem,
 * desenhado para monitores super ultra-wide (32:9). Colunas são as regionais; linhas, os times.
 * Tudo dentro dos cartões se dimensiona pelo próprio cartão (unidades cqh/cqw), então a tela
 * se preenche por inteiro em qualquer largura.
 */
export function PanoramaHorizontal({ data, filters, today, ctx, onDrill, onOpen, presenting }: Props) {
  const live = !!presenting;
  const scope = useMemo(() => ({ ...filters, regional: null, team: null }), [filters]);
  const all = data.demands;
  const scoped = useMemo(() => applyFilters(all, scope), [all, scope]);
  const periodRows = useMemo(() => filterByPeriod(scoped, filters.period, today), [scoped, filters.period, today]);
  const units = useMemo(() => {
    const codes = [...new Set(data.tabs.map((t) => t.regional))];
    return codes.map((regional) => ({ regional, tabs: data.tabs.filter((t) => t.regional === regional).sort((a, b) => teamOrder(a.team) - teamOrder(b.team)) }));
  }, [data.tabs]);
  const maxTeams = Math.max(1, ...units.map((u) => u.tabs.length));

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

  // Modo telão: um destaque percorre os cartões, um de cada vez.
  const teamIds = useMemo(() => units.flatMap((u) => u.tabs.filter((t) => t.rows > 0).map((t) => t.title)), [units]);
  const [spot, setSpot] = useState(0);
  useEffect(() => {
    if (!live || teamIds.length < 2) return;
    const id = window.setInterval(() => setSpot((i) => (i + 1) % teamIds.length), 8000);
    return () => window.clearInterval(id);
  }, [live, teamIds.length]);
  const { toasts, flash } = useSheetPulse(all, data.version, live);

  return (
    <>
      <div
        ref={box}
        data-ph-grid
        className="grid gap-3"
        style={{ height: height || undefined, gridTemplateColumns: `repeat(${units.length}, minmax(0, 1fr))` }}
      >
        {units.map((u, ui) => (
          <section key={u.regional} aria-label={regionalName(u.regional)} className="flex min-h-0 flex-col gap-3">
            <ColumnHeader regional={u.regional} teams={u.tabs.map((t) => t.team)} index={ui} live={live} onOpen={() => onOpen(u.regional, null)} />
            <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateRows: `repeat(${u.tabs.length === 1 ? 1 : maxTeams}, minmax(0, 1fr))` }}>
              {u.tabs.map((t, ti) => (
                <TeamTile
                  key={t.title}
                  tab={t}
                  rows={periodRows.filter((d) => d.sourceTab === t.title)}
                  base={scoped.filter((d) => d.sourceTab === t.title)}
                  today={today}
                  delay={ui * 0.12 + ti * 0.08}
                  spotlight={live && teamIds[spot] === t.title}
                  flash={flash[t.title] ?? 0}
                  live={live}
                  ctx={ctx}
                  onDrill={onDrill}
                  onOpen={() => onOpen(t.regional, t.team)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {live && (
        <>
          <PresentTicker demands={all} today={today} syncedAt={data.syncedAt} paused={false} />
          <PulseToasts toasts={toasts} className="right-6 top-20" />
        </>
      )}
    </>
  );
}

/* ---------- Cabeçalho da coluna (regional) ---------- */

function ColumnHeader({ regional, teams, index, live, onOpen }: { regional: string; teams: string[]; index: number; live: boolean; onOpen: () => void }) {
  const photos = REGIONAL_PLACES[regional]?.photos ?? [];
  const reduce = useReducedMotion();
  const [pi, setPi] = useState(0);
  useEffect(() => {
    if (!live || photos.length < 2 || reduce) return;
    const id = window.setInterval(() => setPi((i) => (i + 1) % photos.length), 7000 + index * 900);
    return () => window.clearInterval(id);
  }, [live, photos.length, reduce, index]);
  const photo = photos[pi % Math.max(1, photos.length)];
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
            style={{ objectPosition: photo.position ?? "50% 50%", filter: "blur(12px) saturate(125%)" }}
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
          background: photo
            ? "radial-gradient(ellipse 70% 120% at 50% 50%, rgba(231,16,61,0.16) 0%, rgba(231,16,61,0) 70%), linear-gradient(rgba(11,11,12,0.5), rgba(11,11,12,0.72))"
            : "radial-gradient(ellipse 70% 140% at 50% 50%, rgba(231,16,61,0.22) 0%, rgba(231,16,61,0) 70%), #121214",
        }}
      />
      <button onClick={onOpen} className="group relative flex h-full w-full flex-col items-center justify-center text-center" title={`Abrir dashboard de ${regionalName(regional)}`}>
        <motion.span
          className="display leading-none text-paper"
          style={{ fontSize: "clamp(28px, 5vh, 76px)" }}
          initial={{ opacity: 0, y: 14, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0em" }}
          transition={{ duration: 0.9, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {regionalName(regional)}
        </motion.span>
        <span className="mt-1 text-[clamp(10px,1.2vh,14px)] uppercase tracking-wide2 text-paper-dim">{teams.join(" · ")}</span>
      </button>
    </header>
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
  flash: number;
  live: boolean;
  ctx: ChartCtx;
  onDrill: (r: DrillRequest) => void;
  onOpen: () => void;
}) {
  const { tab, rows, today } = p;
  const pr = useMemo(() => computePressure(rows, today), [rows, today]);
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const flashing = useFlash(p.flash, p.live);
  const logo = TEAM_LOGOS[teamKey(tab.team)];
  const label = `${regionalName(tab.regional)} · ${tab.team}`;

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

  const drillClient = (name: string) => p.onDrill({ title: name, subtitle: `Demandas abertas · ${label}`, rows: open.filter((d) => d.client === name), apply: { client: name } });
  const drillPerson = (name: string) => p.onDrill({ title: name, subtitle: `Demandas abertas · ${label}`, rows: open.filter((d) => d.people.includes(name)), apply: { person: name } });
  const drillStatus = (cat: StatusCategory) => p.onDrill({ title: CAT_LABEL[cat], subtitle: label, rows: rows.filter((d) => d.statusCategory === cat) });
  const drillType = (name: string) =>
    p.onDrill({ title: name, subtitle: `Tipo de demanda · ${label}`, rows: rows.filter((d) => (d.projectType?.trim() || "Sem tipo") === name), apply: name === "Sem tipo" ? undefined : { projectType: name } });

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, scale: p.spotlight ? 1.012 : 1 }}
      transition={{ duration: 0.6, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[22px] border bg-white/[0.025] transition-colors duration-700 ${
        p.spotlight ? "border-clf-red/70 shadow-[0_0_40px_rgba(231,16,61,0.18)]" : "border-white/[0.07]"
      } ${flashing ? "ci-flash" : ""}`}
      style={{ containerType: "size" }}
      aria-label={label}
    >
      <div className="ph-body min-h-0 flex-1" style={{ padding: "calc(var(--u) * 3.4)", rowGap: "calc(var(--u) * 2.6)" }}>
        {/* Logo do time e atalho para a dashboard */}
        <div className="ph-head flex shrink-0 items-center justify-between">
          {logo ? (
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
              <Metric label="Abertas" value={pr.open} />
              <Metric label="Vencidas" value={pr.late} alert={pr.late > 0} />
              <Metric label="Em 7 dias" value={pr.dueSoon} />
              <Metric label="Travadas" value={pr.blocked} warn={pr.blocked > 0} />
            </div>

            {/* Tipos de Demanda e Status */}
            <div className="ph-mix grid shrink-0" style={{ gap: "calc(var(--u) * 3)" }}>
              <div className="flex min-w-0 items-center" style={{ gap: "calc(var(--u) * 2.2)" }}>
                <Donut items={types} total={rows.length} delay={p.delay} onPick={drillType} />
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
                      className="h-full"
                      style={{ background: STATUS_COLORS[s.cat] }}
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
            <CircleRow title="Clientes em Pauta" empty="Nenhum cliente com demanda aberta" count={clients.length} max={8} delay={p.delay}>
              {(size, n) =>
                clients.slice(0, n).map((c) => (
                  <button key={c.name} onClick={() => drillClient(c.name)} className="group flex min-w-0 flex-col items-center" title={`${c.name} · ${c.open} abertas${c.late ? ` · ${c.late} vencidas` : ""}`}>
                    <span className="relative">
                      <ClientMark name={c.name} size={size} className="transition group-hover:scale-105" />
                      <Badge value={c.open} size={size} />
                      {c.late > 0 && <Badge value={c.late} size={size} late />}
                    </span>
                    <span className="mt-[0.4em] w-full truncate text-center text-paper-dim" style={{ fontSize: Math.max(9, size * 0.18) }}>
                      {c.name}
                    </span>
                  </button>
                ))
              }
            </CircleRow>
            <CircleRow title="Colaboradores em Pauta" empty="Nenhuma demanda aberta com responsável" count={people.length} max={10} delay={p.delay + 0.15}>
              {(size, n) =>
                people.slice(0, n).map((x) => (
                  <button key={x.name} onClick={() => drillPerson(x.name)} className="group flex min-w-0 flex-col items-center" title={`${x.name} · ${x.n} abertas`}>
                    <span className="relative">
                      <Avatar name={x.name} size={size} />
                      <Badge value={x.n} size={size} />
                    </span>
                    <span className="mt-[0.4em] w-full truncate text-center text-paper-dim" style={{ fontSize: Math.max(9, size * 0.18) }}>
                      {shortName(x.name).split(" ")[0]}
                    </span>
                  </button>
                ))
              }
            </CircleRow>

            <InsightLine rows={rows} base={p.base} today={today} />
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}

function Metric({ label, value, alert, warn }: { label: string; value: number; alert?: boolean; warn?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <span className="display block leading-none" style={{ fontSize: "calc(var(--u) * 8)", color: alert ? LATE : warn ? "#d95926" : "#FFFBF0" }}>
        {value}
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
function Donut({ items, total, delay, onPick }: { items: { name: string; n: number; color: string }[]; total: number; delay: number; onPick: (name: string) => void }) {
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
        <span className="display leading-none text-paper" style={{ fontSize: "calc(var(--u) * 5.4)" }}>
          {total}
        </span>
        <span className="text-paper-mute" style={{ fontSize: "max(10px, calc(var(--u) * 1.5))" }}>
          demandas
        </span>
      </div>
    </div>
  );
}

/** Uma fileira de círculos que ocupa toda a largura; o tamanho acompanha a largura e a altura do cartão. */
function CircleRow({ title, empty, count, max, delay, children }: { title: string; empty: string; count: number; max: number; delay: number; children: (size: number, n: number) => React.ReactNode }) {
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
  const n = Math.min(count, max);
  const colW = n ? dims.w / n : 0;
  const size = Math.max(22, Math.min(colW * 0.72, dims.h * 0.13, 120));
  return (
    <div className="flex min-h-0 shrink-0 flex-col" style={{ gap: "calc(var(--u) * 1.4)" }}>
      <span className="flex items-baseline justify-between">
        <span className="eyebrow" style={{ fontSize: "max(10px, calc(var(--u) * 1.8))" }}>
          {title}
        </span>
        {count > max && (
          <span className="text-paper-faint" style={{ fontSize: "max(10px, calc(var(--u) * 1.7))" }}>
            +{count - max}
          </span>
        )}
      </span>
      <div ref={ref}>
        {n ? (
          <motion.div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: delay + 0.4 } } }}
          >
            {dims.w > 0 &&
              (Array.isArray(children(size, n)) ? (children(size, n) as React.ReactNode[]) : [children(size, n)]).map((child, i) => (
                <motion.div key={i} className="flex min-w-0 justify-center" variants={{ hidden: { opacity: 0, scale: 0.6, y: 10 }, show: { opacity: 1, scale: 1, y: 0 } }}>
                  {child}
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
