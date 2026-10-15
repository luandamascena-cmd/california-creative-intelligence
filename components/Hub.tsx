"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Info, Loader2, LogOut } from "lucide-react";
import { useDataset } from "./useDataset";
import network from "@/lib/brazil-network.json";
import { REGIONAL_ORDER, REGIONAL_PLACES } from "@/lib/regions";
import { computePressure, LEVEL_COLOR, LEVEL_LABEL, PRESSURE_DEFINITION, type Pressure } from "@/lib/pressure";
import { todayISO } from "@/lib/text";
import type { Demand, TabInfo } from "@/lib/types";

type Net = { width: number; height: number; outline: string; nodes: number[][]; edges: number[][]; pins: Record<string, [number, number]> };
const NET = network as unknown as Net;

interface RegionalView {
  code: string;
  city: string;
  name: string;
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

export default function Hub() {
  const { data, state, error } = useDataset();
  const [today, setToday] = useState(todayISO());
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
        name: REGIONAL_PLACES[code]?.name ?? code,
        rows,
        tabs: data.tabs.filter((t) => t.regional === code),
        pressure: computePressure(rows, today),
        pin: NET.pins[code] ?? null,
      };
    });
  }, [data, today]);

  const overall = useMemo(() => (data ? computePressure(data.demands, today) : null), [data, today]);
  const ranking = useMemo(() => [...regionals].sort((a, b) => b.pressure.index - a.pressure.index || b.pressure.open - a.pressure.open), [regionals]);

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-california-branco.png" alt="California" className="h-auto w-[260px]" />
        {state === "error" ? (
          <p className="flex max-w-md items-center gap-2 text-[13px] text-clf-coral">
            <AlertTriangle size={15} /> {error}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-paper-mute">
            <Loader2 size={15} className="animate-spin" /> Lendo a pauta das regionais
          </p>
        )}
      </main>
    );
  }

  const totalOpen = data.demands.filter((d) => d.isOpen).length;
  const activeTeams = data.tabs.filter((t) => t.rows > 0).length;
  const hottest = ranking.find((r) => r.pressure.level !== "sem-dados");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      {/* Grade de fundo discreta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,251,240,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,251,240,0.03) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <header className="relative z-10 flex h-[76px] items-center justify-between border-b border-ink-700 px-5 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-california-branco.png" alt="California" width={1549} height={369} className="h-7 w-auto sm:h-8" />
        <div className="flex items-center gap-3 text-[12px] text-paper-mute">
          <span className="hidden items-center gap-2 sm:flex" title={error ?? undefined}>
            <span className="h-2 w-2 rounded-full" style={{ background: state === "stale" ? "#c98500" : "#199e70" }} />
            {state === "stale" ? "Exibindo a última leitura" : "Pauta sincronizada"}
          </span>
          <button
            className="btn h-8 px-2.5"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.replace("/login");
            }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1880px] gap-8 px-5 py-8 sm:px-8 xl:grid-cols-[minmax(360px,440px)_1fr] xl:items-center xl:gap-6 xl:py-6">
        {/* Coluna esquerda: título, visão geral e termômetro */}
        <section className="flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="eyebrow mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-clf-red" /> Creative Intelligence · Pauta de criação
            </p>
            <h1 className="display text-[46px] leading-[1.14] tracking-[0.01em] text-paper sm:text-[60px]">
              Central de
              <br />
              Inteligência
            </h1>
            <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-paper-dim">
              Escolha por onde entrar na pauta. O mapa mostra como o trabalho está distribuído entre as regionais e acende onde a pressão sobre o time é maior.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <Link
              href={dashboardHref()}
              className="group relative block overflow-hidden rounded-[28px] bg-clf-red p-7 text-paper shadow-[0_24px_60px_-24px_rgba(231,16,61,0.55)] transition hover:brightness-110 focus-visible:outline-offset-4"
            >
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/20" />
              <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rounded-full border border-white/15" />
              <span className="text-[11px] font-semibold uppercase tracking-wide2 text-white/80">Todas as regionais e times</span>
              <span className="display mt-2 block text-[46px] leading-none">Visão Geral</span>
              <span className="mt-6 grid grid-cols-3 gap-3 border-t border-white/25 pt-5">
                <Stat value={totalOpen} label="abertas" />
                <Stat value={overall?.late ?? 0} label="vencidas" />
                <Stat value={activeTeams} label={activeTeams === 1 ? "time ativo" : "times ativos"} />
              </span>
              <span className="mt-6 flex items-center justify-between text-[14px] font-semibold">
                Abrir a pauta consolidada
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 transition group-hover:translate-x-1">
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-[18px] tracking-[0.06em]">Termômetro da pauta</h2>
              <span title={PRESSURE_DEFINITION} className="cursor-help text-paper-mute">
                <Info size={15} aria-label={PRESSURE_DEFINITION} />
              </span>
            </div>
            <ol className="space-y-3">
              {ranking.map((r) => (
                <li key={r.code}>
                  <Link href={dashboardHref(r.code)} className="group grid grid-cols-[38px_1fr_auto] items-center gap-3">
                    <span className="display text-[20px] text-paper group-hover:text-clf-red">{r.code}</span>
                    <span>
                      <span className="block h-2 overflow-hidden rounded-full bg-ink-700">
                        <motion.span
                          className="block h-full rounded-full"
                          style={{ background: LEVEL_COLOR[r.pressure.level] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(r.pressure.total ? 4 : 0, r.pressure.index * 100)}%` }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </span>
                    </span>
                    <span className="flex w-[104px] items-center justify-end gap-1.5 text-[12px]" style={{ color: r.pressure.level === "sem-dados" ? "#8F8D88" : LEVEL_COLOR[r.pressure.level] }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[r.pressure.level] }} />
                      {LEVEL_LABEL[r.pressure.level]}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-ink-700 pt-3 text-[11.5px] leading-relaxed text-paper-mute">
              {hottest && hottest.pressure.reasons.length ? (
                <>
                  <b className="text-paper">{hottest.code}</b> lidera a pressão: {hottest.pressure.reasons.join("; ")}.
                </>
              ) : (
                "Nenhuma regional com sinal de pressão agora."
              )}
            </p>
          </motion.section>
        </section>

        {/* Mapa: desktop com cartões posicionados ao lado de cada pino */}
        <section aria-label="Regionais no mapa" className="hidden xl:block">
          <MapStage regionals={regionals} />
        </section>

        {/* Mapa compacto + lista de regionais em telas menores */}
        <section aria-label="Regionais" className="xl:hidden">
          <div className="mx-auto mb-6 max-w-[520px]">
            <svg viewBox={`0 0 ${NET.width} ${NET.height}`} className="h-auto w-full" role="img" aria-label="Mapa do Brasil com as regionais da California">
              <NetworkLayer regionals={regionals} />
              <PinsLayer regionals={regionals} />
            </svg>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {regionals.map((r) => (
              <RegionalCard key={r.code} r={r} />
            ))}
          </div>
        </section>
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

/* ---------- Mapa em rede ---------- */

function nodeColor(x: number, y: number, regionals: RegionalView[]) {
  let best: { d: number; r: RegionalView } | null = null;
  for (const r of regionals) {
    if (!r.pin) continue;
    const d = Math.hypot(r.pin[0] - x, r.pin[1] - y);
    if (!best || d < best.d) best = { d, r };
  }
  if (best && best.d < 240 && best.r.pressure.level !== "sem-dados") {
    return { fill: LEVEL_COLOR[best.r.pressure.level], opacity: 0.95 - (best.d / 240) * 0.45 };
  }
  return { fill: "#D9D2C3", opacity: 0.55 };
}

function NetworkLayer({ regionals }: { regionals: RegionalView[] }) {
  const colors = useMemo(() => NET.nodes.map(([x, y]) => nodeColor(x, y, regionals)), [regionals]);
  return (
    <g>
      <path d={NET.outline} fill="rgba(255,251,240,0.015)" stroke="rgba(255,251,240,0.06)" strokeWidth={1} />
      <g stroke="rgba(255,251,240,0.13)" strokeWidth={1}>
        {NET.edges.map(([a, b], i) => (
          <line key={i} x1={NET.nodes[a][0]} y1={NET.nodes[a][1]} x2={NET.nodes[b][0]} y2={NET.nodes[b][1]} />
        ))}
      </g>
      <g>
        {NET.nodes.map(([x, y, hub], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={hub ? 6.5 : 5}
            fill={colors[i].fill}
            opacity={colors[i].opacity}
            className="ci-node"
            style={{ animationDelay: `${(i % 40) * 25}ms` }}
          />
        ))}
      </g>
    </g>
  );
}

function PinsLayer({ regionals }: { regionals: RegionalView[] }) {
  return (
    <g>
      {regionals.map((r) => {
        if (!r.pin) return null;
        const [x, y] = r.pin;
        const c = LEVEL_COLOR[r.pressure.level];
        return (
          <a key={r.code} href={dashboardHref(r.code)} aria-label={`Abrir regional ${r.code}`}>
            <g className="ci-pin" style={{ color: c }}>
              <circle cx={x} cy={y} r={PIN_R} fill="#0B0B0C" opacity={0.85} />
              {[44, 36, 29].map((rad, k) => (
                <circle key={rad} cx={x} cy={y} r={rad} fill="none" stroke="currentColor" strokeOpacity={0.18 + k * 0.1} strokeWidth={1.5} />
              ))}
              {r.pressure.level !== "sem-dados" && (
                <circle cx={x} cy={y} r={25} fill="none" stroke="currentColor" strokeWidth={2} className="ci-ping" style={{ transformOrigin: `${x}px ${y}px` }} />
              )}
              <circle cx={x} cy={y} r={22} fill="currentColor" opacity={r.pressure.level === "sem-dados" ? 0.35 : 0.9} />
              <image href="/brand/emblema-urso.png" x={x - 16} y={y - 16} width={32} height={32} />
            </g>
          </a>
        );
      })}
    </g>
  );
}

const CARD_PX = 152;
const GAP_PX = 14;
const PIN_R = 46;

function MapStage({ regionals }: { regionals: RegionalView[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Layout em pixels: o mapa ocupa a esquerda e os cartões ficam em coluna, alinhados aos pinos.
  const L = useMemo(() => {
    const cw = Math.min(470, Math.max(320, W * 0.36));
    const mw = Math.max(0, W - cw - 56);
    const s = mw / NET.width;
    const mh = NET.height * s;
    const withPin = regionals.filter((r) => r.pin).sort((a, b) => a.pin![1] - b.pin![1]);
    const list = [...withPin, ...regionals.filter((r) => !r.pin)];
    const ch = list.length * CARD_PX + Math.max(0, list.length - 1) * GAP_PX;
    const H = Math.max(mh, ch);
    const oy = (H - mh) / 2;
    const ys: number[] = [];
    list.forEach((r, i) => {
      const desired = r.pin ? oy + r.pin[1] * s - CARD_PX / 2 : (ys[i - 1] ?? -CARD_PX) + CARD_PX + GAP_PX;
      const min = i ? ys[i - 1] + CARD_PX + GAP_PX : 0;
      ys.push(Math.max(desired, min));
    });
    for (let i = ys.length - 1; i >= 0; i--) {
      const limit = i === ys.length - 1 ? H - CARD_PX : ys[i + 1] - CARD_PX - GAP_PX;
      ys[i] = Math.max(0, Math.min(ys[i], limit));
    }
    return { cw, mw, s, mh, H, oy, cx: W - cw, cards: list.map((r, i) => ({ r, y: ys[i] })) };
  }, [W, regionals]);

  return (
    <div ref={ref} className="relative w-full" style={{ height: W ? L.H : 640 }}>
      {W > 0 && (
        <>
          <svg
            viewBox={`0 0 ${NET.width} ${NET.height}`}
            className="absolute left-0"
            style={{ top: L.oy, width: L.mw, height: L.mh }}
            role="img"
            aria-label="Mapa do Brasil com as regionais da California e o nível de pressão de cada uma"
          >
            <NetworkLayer regionals={regionals} />
          </svg>
          {/* Linhas guia do pino ao cartão */}
          <svg className="pointer-events-none absolute inset-0" width={W} height={L.H} aria-hidden>
            {L.cards.map(({ r, y }) => {
              if (!r.pin) return null;
              const px = r.pin[0] * L.s + PIN_R * L.s + 2;
              const py = L.oy + r.pin[1] * L.s;
              const cy = y + CARD_PX / 2;
              const mid = (px + L.cx) / 2;
              return (
                <path
                  key={r.code}
                  d={`M ${px} ${py} C ${mid} ${py}, ${mid} ${cy}, ${L.cx} ${cy}`}
                  fill="none"
                  stroke={LEVEL_COLOR[r.pressure.level]}
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  strokeDasharray="3 5"
                />
              );
            })}
          </svg>
          <svg
            viewBox={`0 0 ${NET.width} ${NET.height}`}
            className="absolute left-0"
            style={{ top: L.oy, width: L.mw, height: L.mh }}
            aria-hidden
          >
            <PinsLayer regionals={regionals} />
          </svg>
          {L.cards.map(({ r, y }, i) => (
            <motion.div
              key={r.code}
              className="absolute"
              style={{ left: L.cx, top: y, width: L.cw, height: CARD_PX }}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 + i * 0.08 }}
            >
              <RegionalCard r={r} fill />
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}

function RegionalCard({ r, fill = false }: { r: RegionalView; fill?: boolean }) {
  const p = r.pressure;
  const c = LEVEL_COLOR[p.level];
  const empty = p.level === "sem-dados";
  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-ink-600 bg-ink-850/95 px-4 py-3 backdrop-blur transition hover:border-clf-red ${fill ? "h-full" : ""}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: c }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={dashboardHref(r.code)} className="after:absolute after:inset-0 after:content-['']">
            <span className="display text-[28px] leading-none text-paper">{r.code}</span>
            <span className="ml-2 text-[12.5px] text-paper-mute">{r.city}</span>
          </Link>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium" style={{ borderColor: `${c}66`, color: empty ? "#8F8D88" : c }}>
          <span className="h-2 w-2 rounded-full" style={{ background: c }} />
          {LEVEL_LABEL[p.level]}
        </span>
      </div>

      {empty ? (
        <p className="text-[12px] leading-snug text-paper-mute">Pauta ainda sem demandas registradas.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <Metric value={p.open} label="abertas" />
          <Metric value={p.late} label="vencidas" color={p.late ? "#E7103D" : undefined} />
          <Metric value={p.dueSoon} label="em 7 dias" />
          <Metric value={p.blocked} label="travadas" />
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {r.tabs.map((t) => (
            <Link
              key={t.title}
              href={dashboardHref(r.code, t.team)}
              className="rounded-full border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-paper-dim transition hover:border-paper-mute hover:text-paper"
            >
              {t.team} <span className="text-paper-faint">{t.rows}</span>
            </Link>
          ))}
        </div>
        {p.peak && !empty && (
          <span className="truncate text-[11px] text-paper-mute" title="Pessoa com mais demandas abertas nesta regional">
            Pico: <b className="font-medium text-paper-dim">{p.peak.name.split(" ")[0]}</b> ({p.peak.count})
          </span>
        )}
      </div>
    </div>
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
