"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Info } from "lucide-react";
import { useDataset } from "./useDataset";
import { Backdrop } from "./Backdrop";
import { NetworkMap, type NetData } from "./NetworkMap";
import { dashboardHref, HubHeader, HubLoading, Stat, ThermoRow } from "./hub-parts";
import stateNetworks from "@/lib/state-networks.json";
import { REGIONAL_PLACES } from "@/lib/regions";
import { computePressure, LEVEL_COLOR, LEVEL_LABEL, PRESSURE_DEFINITION, type Pressure } from "@/lib/pressure";
import { todayISO } from "@/lib/text";
import type { TabInfo } from "@/lib/types";

const NETS = stateNetworks as unknown as Record<string, NetData & { uf: string; pin: [number, number] }>;

/** Logos dos times. Um time sem logo cadastrado aparece com o nome por extenso. */
const TEAM_LOGOS: Record<string, { src: string; w: number; h: number; className: string }> = {
  california: { src: "/brand/logo-california-branco.png", w: 1549, h: 369, className: "h-[32px]" },
  "content house": { src: "/brand/logo-content-house-branco.png", w: 2185, h: 178, className: "h-[22px]" },
};
const teamKey = (t: string) => t.trim().toLowerCase();
/** California sempre primeiro, Content House em seguida, demais times depois. */
const teamOrder = (t: string) => {
  const i = Object.keys(TEAM_LOGOS).indexOf(teamKey(t));
  return i === -1 ? 99 : i;
};

interface TeamView {
  tab: TabInfo;
  pressure: Pressure;
  people: number;
  clients: number;
}

export default function RegionHub({ code }: { code: string }) {
  const { data, state, error } = useDataset();
  const router = useRouter();
  const [today, setToday] = useState(todayISO());
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const place = REGIONAL_PLACES[code];
  const city = place?.city ?? code;
  const net = NETS[code];

  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tabs = useMemo(() => data?.tabs.filter((t) => t.regional === code) ?? [], [data, code]);
  const rows = useMemo(() => data?.demands.filter((d) => d.regional === code) ?? [], [data, code]);
  const regional = useMemo(() => computePressure(rows, today), [rows, today]);
  const teams: TeamView[] = useMemo(
    () =>
      tabs.map((tab) => {
        const tr = rows.filter((d) => d.sourceTab === tab.title);
        return {
          tab,
          pressure: computePressure(tr, today),
          people: new Set(tr.filter((d) => d.isOpen).flatMap((d) => d.people)).size,
          clients: new Set(tr.filter((d) => d.isOpen).map((d) => d.client)).size,
        };
      }),
    [tabs, rows, today],
  );

  // Regional com um único time (ou inexistente) não precisa de escolha: segue direto para a dashboard.
  useEffect(() => {
    if (!data) return;
    if (tabs.length === 1) router.replace(dashboardHref(code, tabs[0].team));
    else if (!tabs.length) router.replace("/");
  }, [data, tabs, code, router]);

  const nodeColor = useCallback(
    (x: number, y: number) => {
      if (!net || regional.level === "sem-dados") return { fill: "#E9E4D8", o: 0.6 };
      const d = Math.hypot(net.pin[0] - x, net.pin[1] - y);
      const R = 300;
      return d < R ? { fill: LEVEL_COLOR[regional.level], o: 0.95 - (d / R) * 0.4 } : { fill: "#E9E4D8", o: 0.6 };
    },
    [net, regional.level],
  );

  if (!data || tabs.length < 2) return <HubLoading state={state} error={error} />;

  const ranking = [...teams].sort((a, b) => b.pressure.index - a.pressure.index || b.pressure.open - a.pressure.open);
  const hottest = ranking.find((t) => t.pressure.level !== "sem-dados" && t.pressure.reasons.length);
  const activeTeams = tabs.filter((t) => t.rows > 0).length;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink">
      <Backdrop />
      <HubHeader state={state} error={error} back={{ href: "/", label: "Central" }} />

      <main className="relative z-10 mx-auto max-w-[1640px] px-5 pb-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[720px] pt-4 text-center sm:pt-6"
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide2 text-paper-mute">Regional</p>
          <h1 className="display mt-1 text-[44px] leading-[1.06] tracking-[0.02em] text-paper sm:text-[64px]">{city}</h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-paper-dim">
            {city} opera com {tabs.length} times de criação. Escolha um deles para abrir a pauta ou veja os dois juntos na Visão Geral da regional.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-6 xl:mt-6 xl:grid-cols-[360px_minmax(0,1fr)_340px] xl:items-center">
          {/* Esquerda: Visão Geral da regional e termômetro por time */}
          <section className="order-3 flex flex-col gap-5 xl:order-none">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              <Link href={dashboardHref(code)} className="card-red group relative block overflow-hidden p-7 text-paper transition hover:brightness-110">
                <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-white/20" />
                <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rounded-full border border-white/15" />
                <span className="text-[11px] font-semibold uppercase tracking-wide2 text-white/80">Todos os times de {city}</span>
                <span className="display mt-2 block text-[46px] leading-none">Visão Geral</span>
                <span className="mt-6 grid grid-cols-3 gap-3 border-t border-white/25 pt-5">
                  <Stat value={regional.open} label={regional.open === 1 ? "aberta" : "abertas"} />
                  <Stat value={regional.dueSoon} label="em 7 dias" />
                  <Stat value={activeTeams} label={activeTeams === 1 ? "time ativo" : "times ativos"} />
                </span>
                <span className="mt-6 flex items-center justify-between text-[14px] font-semibold">
                  Abrir a pauta da regional
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
              aria-label="Termômetro dos times"
              className="card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-paper">Termômetro dos Times</h2>
                <span title={PRESSURE_DEFINITION} className="cursor-help text-paper-mute">
                  <Info size={15} aria-label={PRESSURE_DEFINITION} />
                </span>
              </div>
              <ul className="divide-y divide-white/[0.07]">
                {ranking.map((t) => (
                  <ThermoRow
                    key={t.tab.title}
                    item={{
                      key: t.tab.title,
                      label: t.tab.team,
                      pressure: t.pressure,
                      openHref: dashboardHref(code, t.tab.team),
                      openLabel: `Abrir ${t.tab.team}`,
                    }}
                    expanded={open === t.tab.title}
                    highlighted={hover === t.tab.title}
                    onToggle={() => setOpen((o) => (o === t.tab.title ? null : t.tab.title))}
                  />
                ))}
              </ul>
              <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11.5px] leading-relaxed text-paper-mute">
                {hottest ? (
                  <>
                    <b className="text-paper">{hottest.tab.team}</b> concentra a pressão: {hottest.pressure.reasons.join("; ")}.
                  </>
                ) : (
                  "Nenhum time com sinal de pressão agora."
                )}{" "}
                Toque em um time para ver o detalhe.
              </p>
            </motion.section>
          </section>

          {/* Centro: mapa do estado */}
          <section aria-label={`Mapa de ${place?.state ?? city}`} className="order-1 xl:order-none">
            {net ? (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
                <NetworkMap
                  net={net}
                  className={net.height < net.width * 0.8 ? "max-w-[780px]" : "max-w-[640px]"}
                  pinScale={1.45}
                  labelOverflow={0}
                  ariaLabel={`Mapa de ${place?.state ?? city} com a sede da California em ${city}`}
                  nodeColor={nodeColor}
                  pins={[
                    {
                      code,
                      label: city,
                      x: net.pin[0],
                      y: net.pin[1],
                      ariaLabel: `Abrir a Visão Geral de ${city}`,
                      onActivate: () => router.push(dashboardHref(code)),
                    },
                  ]}
                />
                <p className="mt-2 text-center text-[11px] uppercase tracking-wide2 text-paper-faint">{place?.state}</p>
              </motion.div>
            ) : null}
          </section>

          {/* Direita: escolha do time */}
          <section aria-label="Escolha do time" className="order-2 flex flex-col gap-5 xl:order-none">
            {[...teams].sort((a, b) => teamOrder(a.tab.team) - teamOrder(b.tab.team)).map((t, i) => (
              <motion.div key={t.tab.title} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 + i * 0.1 }}>
                <TeamCard team={t} href={dashboardHref(code, t.tab.team)} highlighted={hover === t.tab.title} onHover={setHover} />
              </motion.div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}

function TeamCard({ team, href, highlighted, onHover }: { team: TeamView; href: string; highlighted: boolean; onHover: (k: string | null) => void }) {
  const p = team.pressure;
  const logo = TEAM_LOGOS[teamKey(team.tab.team)];
  const empty = p.level === "sem-dados";
  const c = LEVEL_COLOR[p.level];
  return (
    <Link
      href={href}
      onMouseEnter={() => onHover(team.tab.title)}
      onMouseLeave={() => onHover(null)}
      className={`card group relative block overflow-hidden p-6 transition hover:border-white/25 hover:bg-white/[0.06] ${highlighted ? "border-white/25" : ""}`}
      aria-label={`Abrir a pauta de ${team.tab.team}`}
    >
      <div className="flex h-[34px] items-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt={team.tab.team} width={logo.w} height={logo.h} className={`${logo.className} w-auto max-w-full`} />
        ) : (
          <span className="display text-[28px] leading-none text-paper">{team.tab.team}</span>
        )}
      </div>

      {empty ? (
        <p className="mt-6 border-t border-white/[0.08] pt-5 text-[12.5px] leading-relaxed text-paper-dim">Pauta ainda sem demandas registradas. Os números aparecem assim que a primeira linha for preenchida.</p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-5">
          <TeamStat value={p.open} label={p.open === 1 ? "aberta" : "abertas"} />
          <TeamStat value={p.dueSoon} label="em 7 dias" />
          <TeamStat value={team.people} label={team.people === 1 ? "pessoa" : "pessoas"} />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: empty ? "#8F8D88" : c }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
          {LEVEL_LABEL[p.level]}
        </span>
        <span className="glass-btn flex h-10 w-10 items-center justify-center rounded-full text-paper transition group-hover:translate-x-1">
          <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

function TeamStat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="display block text-[30px] leading-none text-paper">{value}</span>
      <span className="mt-1 block text-[11px] text-paper-mute">{label}</span>
    </span>
  );
}
