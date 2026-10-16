"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Info } from "lucide-react";
import { useDataset } from "./useDataset";
import { Backdrop } from "./Backdrop";
import { NetworkMap, type NetData } from "./NetworkMap";
import { dashboardHref, HubHeader, HubLoading, regionalHref, Stat, ThermoRow } from "./hub-parts";
import network from "@/lib/brazil-network.json";
import { REGIONAL_ORDER, REGIONAL_PLACES } from "@/lib/regions";
import { computePressure, LEVEL_COLOR, PRESSURE_DEFINITION, type Pressure } from "@/lib/pressure";
import { todayISO } from "@/lib/text";
import type { Demand, TabInfo } from "@/lib/types";

const NET = network as unknown as NetData & { pins: Record<string, [number, number]> };

interface RegionalView {
  code: string;
  city: string;
  rows: Demand[];
  tabs: TabInfo[];
  pressure: Pressure;
  pin: [number, number] | null;
}

export default function Hub() {
  const { data, state, error } = useDataset();
  const [today, setToday] = useState(todayISO());
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const router = useRouter();

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

  // Pontos próximos de cada sede assumem a cor do nível de pressão da regional.
  const nodeColor = useCallback(
    (x: number, y: number) => {
      let best: { d: number; r: RegionalView } | null = null;
      for (const r of regionals) {
        if (!r.pin) continue;
        const d = Math.hypot(r.pin[0] - x, r.pin[1] - y);
        if (!best || d < best.d) best = { d, r };
      }
      if (best && best.d < 240 && best.r.pressure.level !== "sem-dados") return { fill: LEVEL_COLOR[best.r.pressure.level], o: 0.95 - (best.d / 240) * 0.4 };
      return { fill: "#E9E4D8", o: 0.6 };
    },
    [regionals],
  );

  if (!data) return <HubLoading state={state} error={error} />;

  const totalOpen = data.demands.filter((d) => d.isOpen).length;
  const activeTeams = data.tabs.filter((t) => t.rows > 0).length;
  const dueSoon = regionals.reduce((a, r) => a + r.pressure.dueSoon, 0);
  const hottest = ranking.find((r) => r.pressure.level !== "sem-dados" && r.pressure.reasons.length);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink">
      <Backdrop />

      <HubHeader state={state} error={error} />

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
                    item={{
                      key: r.code,
                      label: r.city,
                      pressure: r.pressure,
                      chips: r.tabs.map((t) => ({ label: t.team, href: dashboardHref(r.code, t.team), count: t.rows })),
                      openHref: regionalHref(r.code, data.tabs),
                      openLabel: `Abrir ${r.city}`,
                    }}
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
            <NetworkMap
              net={NET}
              className="max-w-[820px] pr-[14%] sm:pr-[12%]"
              ariaLabel="Mapa do Brasil com as regionais da California"
              nodeColor={nodeColor}
              onHover={setHover}
              pins={regionals
                .filter((r) => r.pin)
                .map((r) => ({
                  code: r.code,
                  label: r.city,
                  x: r.pin![0],
                  y: r.pin![1],
                  ariaLabel: `Abrir ${r.city}`,
                  onActivate: () => router.push(regionalHref(r.code, data.tabs)),
                }))}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
