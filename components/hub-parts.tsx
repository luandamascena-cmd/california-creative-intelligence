"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronLeft, Loader2, LogOut } from "lucide-react";
import { Backdrop } from "./Backdrop";
import { LEVEL_COLOR, LEVEL_LABEL, type Pressure } from "@/lib/pressure";
import type { TabInfo } from "@/lib/types";
import type { SyncState } from "./useDataset";
import { RED } from "./NetworkMap";

/* ---------- Endereços ---------- */

export function dashboardHref(regional?: string, team?: string) {
  if (!regional) return "/dashboard?visao=geral";
  const qs = new URLSearchParams({ regional });
  if (team) qs.set("team", team);
  return `/dashboard?${qs}`;
}

/** Regionais com mais de um time passam pela página da regional, onde se escolhe o time. */
export function regionalHref(code: string, tabs: TabInfo[]) {
  const teams = tabs.filter((t) => t.regional === code);
  return teams.length > 1 ? `/regional/${code.toLowerCase()}` : dashboardHref(code, teams[0]?.team);
}

/* ---------- Estrutura ---------- */

export function HubLoading({ state, error }: { state: SyncState; error: string | null }) {
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

export function HubHeader({ state, error, back }: { state: SyncState; error: string | null; back?: { href: string; label: string } }) {
  return (
    <header className="relative z-10 flex h-[72px] items-center justify-between px-5 sm:px-10">
      <div className="flex items-center gap-4">
        <Link href="/" title="Central de Inteligência">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-california-branco.png" alt="California" width={1549} height={369} className="h-7 w-auto" />
        </Link>
        {back && (
          <Link href={back.href} className="glass-btn hidden h-8 items-center gap-1 rounded-full px-3 text-[12.5px] text-paper-dim transition hover:text-paper sm:inline-flex">
            <ChevronLeft size={14} /> {back.label}
          </Link>
        )}
      </div>
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
  );
}

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="display block text-[34px] leading-none">{value}</span>
      <span className="mt-1 block text-[11.5px] text-white/80">{label}</span>
    </span>
  );
}

export function Metric({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <span>
      <span className="display block text-[24px] leading-none" style={{ color: color ?? "#FFFBF0" }}>
        {value}
      </span>
      <span className="block truncate text-[10px] uppercase tracking-wide text-paper-mute">{label}</span>
    </span>
  );
}

/* ---------- Termômetro com detalhe expansível ---------- */

export interface ThermoItem {
  key: string;
  label: string;
  pressure: Pressure;
  chips?: { label: string; href: string; count: number }[];
  openHref: string;
  openLabel: string;
  emptyText?: string;
}

export function ThermoRow({ item, expanded, highlighted, onToggle }: { item: ThermoItem; expanded: boolean; highlighted: boolean; onToggle: () => void }) {
  const p = item.pressure;
  const c = LEVEL_COLOR[p.level];
  const empty = p.level === "sem-dados";
  return (
    <li className={`transition ${highlighted ? "bg-white/[0.04]" : ""} -mx-2 rounded-xl px-2`}>
      <button onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[112px_1fr_auto_16px] items-center gap-3 py-3 text-left">
        <span className="truncate text-[14px] font-medium text-paper">{item.label}</span>
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
                <p className="text-[12.5px] text-paper-dim">{item.emptyText ?? "Pauta ainda sem demandas registradas."}</p>
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
                {item.chips?.map((t) => (
                  <Link key={t.label} href={t.href} className="chip py-0.5 text-[11.5px] transition hover:border-white/25 hover:text-paper">
                    {t.label} <span className="text-paper-faint">{t.count}</span>
                  </Link>
                ))}
                <Link href={item.openHref} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-paper hover:text-clf-red">
                  {item.openLabel} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
