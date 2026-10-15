"use client";

import { BookOpen, ChevronsLeft, ChevronsRight, LayoutGrid, LogOut, MapPin, ShieldCheck } from "lucide-react";
import type { TabInfo } from "@/lib/types";
import { Wordmark } from "./Wordmark";

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
      active ? "bg-ink-800 text-paper" : "text-paper-mute hover:bg-ink-850 hover:text-paper"
    }`;

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-ink-700 bg-ink-900 transition-[width] duration-300 md:flex ${collapsed ? "w-[68px]" : "w-[248px]"}`}
      aria-label="Navegação"
    >
      <div className={`flex h-[68px] items-center border-b border-ink-700 ${collapsed ? "justify-center" : "px-5"}`}>
        {collapsed ? (
          <span className="font-mark text-[20px] font-bold">C<span className="text-clf-red">.</span></span>
        ) : (
          <div>
            <Wordmark className="text-[15px]" />
            <p className="mt-1 font-display text-[11px] uppercase tracking-[0.3em] text-paper-mute">Creative Intelligence</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
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
                  <button className={item(active && !team)} onClick={() => onNavigate(r, null)} aria-current={active ? "page" : undefined} title={`Regional ${r}`}>
                    {active && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-[2px] rounded bg-clf-red" />}
                    {collapsed ? <span className="w-full text-center font-display text-[15px]">{r}</span> : <MapPin size={16} className="shrink-0" />}
                    {!collapsed && (
                      <>
                        <span className="flex-1 font-display text-[15px] tracking-[0.08em]">{r}</span>
                        <span className={`text-[11px] tabular-nums ${count(r) ? "text-paper-faint" : "text-ink-500"}`}>{count(r)}</span>
                      </>
                    )}
                  </button>
                  {active && !collapsed && (
                    <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-ink-700 pl-3">
                      <li>
                        <button className={`w-full rounded-md px-2 py-1.5 text-left text-[12.5px] ${!team ? "text-paper" : "text-paper-mute hover:text-paper"}`} onClick={() => onNavigate(r, null)}>
                          Todos os times
                        </button>
                      </li>
                      {teams.map((t) => (
                        <li key={t.title}>
                          <button
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12.5px] ${team === t.team ? "bg-ink-800 text-paper" : "text-paper-mute hover:text-paper"}`}
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
          <button className={item(false)} onClick={onQuality} title="Qualidade dos dados">
            <ShieldCheck size={16} className="shrink-0" />
            {!collapsed && <span className="flex-1">Qualidade dos dados</span>}
            {alerts > 0 && (
              <span className={`rounded-full bg-[#c98500]/20 px-1.5 text-[10.5px] font-semibold text-[#e0a73a] ${collapsed ? "absolute right-1 top-1" : ""}`}>{alerts}</span>
            )}
          </button>
          <button className={item(false)} onClick={onGlossary} title="Definições das métricas">
            <BookOpen size={16} className="shrink-0" />
            {!collapsed && <span>Definições das métricas</span>}
          </button>
        </div>
      </nav>

      <div className="space-y-1 border-t border-ink-700 p-3">
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
