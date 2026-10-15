"use client";

import Link from "next/link";
import { BookOpen, ChevronsLeft, ChevronsRight, LayoutGrid, LogOut, Map as MapIcon, MapPin, ShieldCheck } from "lucide-react";
import type { TabInfo } from "@/lib/types";
import { regionalName } from "@/lib/labels";

interface Props {
  tabs: TabInfo[];
  regional: string | null;
  team: string | null;
  collapsed: boolean;
  alerts: number;
  onToggle: () => void;
  onNavigate: (regional: string | null, team: string | null) => void;
  onQuality: () => void;
  onGlossary: () => void;
}

export function Sidebar({ tabs, regional, team, collapsed, alerts, onToggle, onNavigate, onQuality, onGlossary }: Props) {
  const regionals = [...new Set(tabs.map((t) => t.regional))];
  const count = (r: string, tm?: string) => tabs.filter((t) => t.regional === r && (!tm || t.team === tm)).reduce((a, t) => a + t.rows, 0);
  const total = tabs.reduce((a, t) => a + t.rows, 0);

  const item = (active: boolean) =>
    `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition ${
      active ? "bg-white/[0.08] text-paper" : "text-paper-mute hover:bg-white/[0.04] hover:text-paper"
    }`;

  return (
    <aside
      className={`sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-white/[0.08] bg-[#121214]/80 backdrop-blur-2xl transition-[width] duration-300 md:flex ${collapsed ? "w-[68px]" : "w-[248px]"}`}
      aria-label="Navegação"
    >
      <Link href="/" title="Voltar à central" className={`flex h-[68px] items-center border-b border-white/[0.08] ${collapsed ? "justify-center" : "px-5"}`}>
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/emblema-urso.png" alt="California" className="h-8 w-8" />
        ) : (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-california-branco.png" alt="California" width={1549} height={369} className="h-[22px] w-auto" />
            <p className="mt-1.5 font-display text-[11px] uppercase tracking-[0.3em] text-paper-mute">Creative Intelligence</p>
          </div>
        )}
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div className="space-y-0.5">
          <Link href="/" className={item(false)} title="Central">
            <MapIcon size={16} className="shrink-0" />
            {!collapsed && <span className="flex-1">Central</span>}
          </Link>
          <button className={item(!regional)} onClick={() => onNavigate(null, null)} aria-current={!regional ? "page" : undefined} title="Visão Geral">
            {!regional && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-[2px] rounded bg-clf-red" />}
            <LayoutGrid size={16} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Visão Geral</span>
                <span className="text-[11px] tabular-nums text-paper-faint">{total}</span>
              </>
            )}
          </button>
        </div>

        <div>
          {!collapsed && <p className="eyebrow mb-2 px-3">Regionais</p>}
          <ul className="space-y-0.5">
            {regionals.map((r) => {
              const active = regional === r;
              const teams = tabs.filter((t) => t.regional === r);
              return (
                <li key={r}>
                  <button className={item(active && !team)} onClick={() => onNavigate(r, null)} aria-current={active ? "page" : undefined} title={regionalName(r)}>
                    {active && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-[2px] rounded bg-clf-red" />}
                    {collapsed ? <span className="w-full text-center text-[11px] font-semibold">{regionalName(r).split(" ").map((w) => w[0]).join("")}</span> : <MapPin size={16} className="shrink-0" />}
                    {!collapsed && (
                      <>
                        <span className="flex-1">{regionalName(r)}</span>
                        <span className={`text-[11px] tabular-nums ${count(r) ? "text-paper-faint" : "text-ink-500"}`}>{count(r)}</span>
                      </>
                    )}
                  </button>
                  {active && !collapsed && (
                    <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-3">
                      <li>
                        <button className={`w-full rounded-md px-2 py-1.5 text-left text-[12.5px] ${!team ? "text-paper" : "text-paper-mute hover:text-paper"}`} onClick={() => onNavigate(r, null)}>
                          Todos os times
                        </button>
                      </li>
                      {teams.map((t) => (
                        <li key={t.title}>
                          <button
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12.5px] ${team === t.team ? "bg-white/[0.06] text-paper" : "text-paper-mute hover:text-paper"}`}
                            onClick={() => onNavigate(r, t.team)}
                          >
                            <span>{t.team}</span>
                            <span className="text-[11px] tabular-nums text-paper-faint">{t.rows}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {!collapsed && <p className="eyebrow mb-2 px-3">Confiabilidade</p>}
          <button className={item(false)} onClick={onQuality} title="Qualidade dos Dados">
            <ShieldCheck size={16} className="shrink-0" />
            {!collapsed && <span className="flex-1">Qualidade dos Dados</span>}
            {alerts > 0 && (
              <span className={`rounded-full bg-[#c98500]/20 px-1.5 text-[10.5px] font-semibold text-[#e0a73a] ${collapsed ? "absolute right-1 top-1" : ""}`}>{alerts}</span>
            )}
          </button>
          <button className={item(false)} onClick={onGlossary} title="Definições das Métricas">
            <BookOpen size={16} className="shrink-0" />
            {!collapsed && <span>Definições das Métricas</span>}
          </button>
        </div>
      </nav>

      <div className="space-y-1 border-t border-white/[0.08] p-3">
        <button
          className={item(false)}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.replace("/login");
          }}
          title="Sair"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button className={item(false)} onClick={onToggle} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronsRight size={16} className="shrink-0" /> : <ChevronsLeft size={16} className="shrink-0" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
