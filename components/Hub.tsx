"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, ChevronDown, Info, Loader2, LogOut } from "lucide-react";
import { useDataset } from "./useDataset";
import { Backdrop } from "./Backdrop";
import network from "@/lib/brazil-network.json";
import { REGIONAL_ORDER, REGIONAL_PLACES } from "@/lib/regions";
import { computePressure, LEVEL_COLOR, LEVEL_LABEL, PRESSURE_DEFINITION, type Pressure } from "@/lib/pressure";
import { todayISO } from "@/lib/text";
import type { Demand, TabInfo } from "@/lib/types";

type Net = { width: number; height: number; outline: string; nodes: number[][]; edges: number[][]; pins: Record<string, [number, number]> };
const NET = network as unknown as Net;
const RED = "#E7103D";

interface RegionalView {
  code: string;
  city: string;
  rows: Demand[];
  tabs: TabInfo[];
  pressure: Pressure;
  pin: [number, number] | null;
}

function dashboardHref(regional?: string, team?: string) {
  if (!regional) return "/dashboard?visao=geral";
  const qs = new URLSearchParams({ regional });
  if (team) qs.set("team", team);
  return `/dashboard?${qs}`;
}

/** Pseudoaleatório estável por índice, para a animação não "pular" entre renderizações. */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export default function Hub() {
  const { data, state, error } = useDataset();
  const [today, setToday] = useState(todayISO());
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  const regionals: RegionalView[] = useMemo(() => {
    if (!data) return [];
    const codes = [...new Set(data.tabs.map((t) => t.regional))];
    const ordered = [...REGIONAL_ORDER.filter((c) => codes.includes(c)), ...codes.filter((c) => !REGIONAL_ORDER.includes(c))];
    return ordered.map((code) => {
      const rows = data.demands.filter((d) => d.regional === code);
      return {
        code,
        city: REGIONAL_PLACES[code]?.city ?? code,
        rows,
        tabs: data.tabs.filter((t) => t.regional === code),
        pressure: computePressure(rows, today),
        pin: NET.pins[code] ?? null,
      };
    });
  }, [data, today]);

  const ranking = useMemo(
    () => [...regionals].sort((a, b) => b.pressure.index - a.pressure.index || b.pressure.open - a.pressure.open),
    [regionals],
  );

  if (!data) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-5 bg-ink px-6 text-center">
        <Backdrop />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/emblema-urso.png" alt="California" className="relative h-20 w-20" />
        {state === "error" ? (
          <p className="relative flex max-w-md items-center gap-2 text-[13px] text-clf-coral">
            <AlertTriangle size={15} /> {error}
          </p>
        ) : (
          <p className="relative flex items-center gap-2 text-[13px] text-paper-mute">
            <Loader2 size={15} className="animate-spin" /> Lendo a pauta das regionais
          </p>
        )}
      </main>
    );
  }

  const totalOpen = data.demands.filter((d) => d.isOpen).length;
  const activeTeams = data.tabs.filter((t) => t.rows > 0).length;
  const dueSoon = regionals.reduce((a, r) => a + r.pressure.dueSoon, 0);
  const hottest = ranking.find((r) => r.pressure.level !== "sem-dados" && r.pressure.reasons.length);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink">
      <Backdrop />

      <header className="relative z-10 flex h-[72px] items-center justify-between px-5 sm:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-california-branco.png" alt="California" width={1549} height={369} className="h-7 w-auto" />
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-paper-dim backdrop-blur-xl sm:flex" title={error ?? undefined}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: state === "stale" ? "#c98500" : "#2BB37F" }} />
            {state === "stale" ? "Exibindo a última leitura" : "Pauta sincronizada"}
          </span>
          <button
            className="btn h-8"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.replace("/login");
            }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1640px] px-5 pb-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[720px] pt-4 text-center sm:pt-6"
        >
          <h1 className="display text-[44px] leading-[1.06] tracking-[0.02em] text-paper sm:text-[64px]">Central de Inteligência</h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-paper-dim">
            Escolha por onde entrar na pauta. O mapa mostra como o trabalho está distribuído entre as regionais e acende onde a pressão sobre o time é maior.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-8 xl:mt-6 xl:grid-cols-[400px_1fr] xl:items-center xl:gap-6">
          <section className="flex flex-col gap-5">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              <Link href={dashboardHref()} className="card-red group relative block overflow-hidden p-7 text-paper transition hover:brightness-110">
                <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-white/20" />
                <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rounded-full border border-white/15" />
                <span className="text-[11px] font-semibold uppercase tracking-wide2 text-white/80">Todas as regionais e times</span>
                <span className="display mt-2 block text-[46px] leading-none">Visão Geral</span>
                <span className="mt-6 grid grid-cols-3 gap-3 border-t border-white/25 pt-5">
                  <Stat value={totalOpen} label="abertas" />
                  <Stat value={dueSoon} label="em 7 dias" />
                  <Stat value={activeTeams} label={activeTeams === 1 ? "time ativo" : "times ativos"} />
                </span>
                <span className="mt-6 flex items-center justify-between text-[14px] font-semibold">
                  Abrir a pauta consolidada
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 transition group-hover:translate-x-1">
                    <ArrowRight size={18} />
                  </span>
                </span>
              </Link>
            </motion.div>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              aria-label="Termômetro da pauta"
              className="card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-paper">Termômetro da Pauta</h2>
                <span title={PRESSURE_DEFINITION} className="cursor-help text-paper-mute">
                  <Info size={15} aria-label={PRESSURE_DEFINITION} />
                </span>
              </div>
              <ul className="divide-y divide-white/[0.07]">
                {ranking.map((r) => (
                  <ThermoRow
                    key={r.code}
                    r={r}
                    expanded={open === r.code}
                    highlighted={hover === r.code}
                    onToggle={() => setOpen((o) => (o === r.code ? null : r.code))}
                  />
                ))}
              </ul>
              <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11.5px] leading-relaxed text-paper-mute">
                {hottest ? (
                  <>
                    <b className="text-paper">{hottest.city}</b> lidera a pressão: {hottest.pressure.reasons.join("; ")}.
                  </>
                ) : (
                  "Nenhuma regional com sinal de pressão agora."
                )}{" "}
                Toque em uma regional para ver o detalhe.
              </p>
            </motion.section>
          </section>

          <section aria-label="Regionais no mapa" className="order-first xl:order-none">
            <BrazilMap regionals={regionals} onHover={setHover} />
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="display block text-[34px] leading-none">{value}</span>
      <span className="mt-1 block text-[11.5px] text-white/80">{label}</span>
    </span>
  );
}

/* ---------- Termômetro com detalhe expansível ---------- */

function ThermoRow({ r, expanded, highlighted, onToggle }: { r: RegionalView; expanded: boolean; highlighted: boolean; onToggle: () => void }) {
  const p = r.pressure;
  const c = LEVEL_COLOR[p.level];
  const empty = p.level === "sem-dados";
  return (
    <li className={`transition ${highlighted ? "bg-white/[0.04]" : ""} -mx-2 rounded-xl px-2`}>
      <button onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[112px_1fr_auto_16px] items-center gap-3 py-3 text-left">
        <span className="truncate text-[14px] font-medium text-paper">{r.city}</span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span
            className="block h-full rounded-full"
            style={{ background: c }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(p.total ? 4 : 0, p.index * 100)}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        <span className="flex w-[100px] items-center justify-end gap-1.5 text-[12px]" style={{ color: empty ? "#8F8D88" : c }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
          {LEVEL_LABEL[p.level]}
        </span>
        <ChevronDown size={15} className={`text-paper-mute transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4">
              {empty ? (
                <p className="text-[12.5px] text-paper-dim">Pauta ainda sem demandas registradas.</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <Metric value={p.open} label="abertas" />
                    <Metric value={p.late} label="vencidas" color={p.late ? RED : undefined} />
                    <Metric value={p.dueSoon} label="em 7 dias" />
                    <Metric value={p.blocked} label="travadas" />
                  </div>
                  {p.peak && (
                    <p className="mt-3 text-[12px] text-paper-mute">
                      Mais demandas abertas: <b className="font-medium text-paper-dim">{p.peak.name}</b> ({p.peak.count})
                    </p>
                  )}
                </>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {r.tabs.map((t) => (
                  <Link key={t.title} href={dashboardHref(r.code, t.team)} className="chip py-0.5 text-[11.5px] transition hover:border-white/25 hover:text-paper">
                    {t.team} <span className="text-paper-faint">{t.rows}</span>
                  </Link>
                ))}
                <Link href={dashboardHref(r.code)} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-paper hover:text-clf-red">
                  Abrir {r.city} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Metric({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <span>
      <span className="display block text-[24px] leading-none" style={{ color: color ?? "#FFFBF0" }}>
        {value}
      </span>
      <span className="block truncate text-[10px] uppercase tracking-wide text-paper-mute">{label}</span>
    </span>
  );
}

/* ---------- Mapa em rede ---------- */

function nodeColor(x: number, y: number, regionals: RegionalView[]) {
  let best: { d: number; r: RegionalView } | null = null;
  for (const r of regionals) {
    if (!r.pin) continue;
    const d = Math.hypot(r.pin[0] - x, r.pin[1] - y);
    if (!best || d < best.d) best = { d, r };
  }
  if (best && best.d < 240 && best.r.pressure.level !== "sem-dados") {
    return { fill: LEVEL_COLOR[best.r.pressure.level], o: 0.95 - (best.d / 240) * 0.4 };
  }
  return { fill: "#E9E4D8", o: 0.6 };
}

function BrazilMap({ regionals, onHover }: { regionals: RegionalView[]; onHover: (c: string | null) => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const colors = useMemo(() => NET.nodes.map(([x, y]) => nodeColor(x, y, regionals)), [regionals]);
  // Pulsos que percorrem algumas conexões, como sinais circulando pela rede.
  const sparks = useMemo(() => NET.edges.filter((_, i) => i % 23 === 0).slice(0, 18), []);
  const pins = regionals.filter((r) => r.pin);

  return (
    <div className="relative mx-auto w-full max-w-[820px] pr-[14%] sm:pr-[12%]">
      <svg viewBox={`0 0 ${NET.width} ${NET.height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Mapa do Brasil com as regionais da California">
        <path d={NET.outline} fill="rgba(255,251,240,0.02)" stroke="rgba(255,251,240,0.07)" strokeWidth={1} />
        <g stroke="rgba(255,251,240,0.12)" strokeWidth={1}>
          {NET.edges.map(([a, b], i) => (
            <line key={i} x1={NET.nodes[a][0]} y1={NET.nodes[a][1]} x2={NET.nodes[b][0]} y2={NET.nodes[b][1]} />
          ))}
        </g>
        {!reduce && (
          <g>
            {sparks.map(([a, b], i) => {
              const [x1, y1] = NET.nodes[a];
              const [x2, y2] = NET.nodes[b];
              const dur = 2.6 + rnd(i, 3) * 2.4;
              const begin = rnd(i, 7) * 4;
              return (
                <circle key={i} r={3.2} fill={RED} opacity={0}>
                  <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>
        )}
        <g>
          {NET.nodes.map(([x, y, hub], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={hub ? 6.5 : 5}
              fill={colors[i].fill}
              className="ci-twinkle"
              style={
                {
                  "--o": colors[i].o,
                  "--d": `${3 + rnd(i) * 4}s`,
                  "--delay": `${-rnd(i, 2) * 6}s`,
                  opacity: colors[i].o,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {pins.map((r, k) => {
          const [x, y] = r.pin!;
          const label = r.city;
          const w = 30 + label.length * 9.4;
          const neighborRight = pins.some((o) => o !== r && o.pin![0] > x && o.pin![0] - x < 150 && Math.abs(o.pin![1] - y) < 70);
          const left = neighborRight;
          const lx = left ? x - 52 - w : x + 52;
          return (
            <g
              key={r.code}
              className="ci-pin"
              role="link"
              tabIndex={0}
              aria-label={`Abrir regional ${r.city}`}
              onClick={() => router.push(dashboardHref(r.code))}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(dashboardHref(r.code))}
              onMouseEnter={() => onHover(r.code)}
              onMouseLeave={() => onHover(null)}
              style={{ color: RED }}
            >
              <circle cx={x} cy={y} r={46} fill="#0B0B0C" opacity={0.8} />
              {[44, 36, 29].map((rad, j) => (
                <circle key={rad} cx={x} cy={y} r={rad} fill="none" stroke="currentColor" strokeOpacity={0.22 + j * 0.12} strokeWidth={1.5} />
              ))}
              {!reduce && (
                <>
                  <circle cx={x} cy={y} r={24} fill="none" stroke="currentColor" strokeWidth={2} className="ci-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${k * 0.6}s` }} />
                  <circle cx={x} cy={y} r={24} fill="none" stroke="currentColor" strokeWidth={1.5} className="ci-ping" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${k * 0.6 + 1.2}s` }} />
                </>
              )}
              <circle cx={x} cy={y} r={22} fill="currentColor" />
              <image href="/brand/emblema-urso.png" x={x - 16} y={y - 16} width={32} height={32} />
              <g transform={`translate(${lx} ${y - 17})`}>
                <rect width={w} height={34} rx={17} fill="rgba(20,20,22,0.72)" stroke="rgba(255,255,255,0.18)" />
                <text x={w / 2} y={22.5} textAnchor="middle" fill="#FFFBF0" fontSize={15} fontFamily="Archivo, system-ui, sans-serif" fontWeight={600}>
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
