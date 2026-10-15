"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { countBy, type Filters } from "@/lib/analytics";
import { PERIOD_OPTIONS, periodDescription } from "@/lib/period";
import type { Capabilities, Demand } from "@/lib/types";

interface Props {
  base: Demand[];
  filters: Filters;
  caps: Capabilities;
  teams: string[];
  today: string;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

const LABELS: Record<string, string> = {
  team: "Time",
  bu: "Business Unit",
  client: "Cliente",
  person: "Colaborador",
  format: "Formato",
  status: "Status",
  priority: "Prioridade",
  projectType: "Tipo de Projeto",
  period: "Período",
};

/** Filtros em uma única linha: cada seletor mostra o nome do campo até receber um valor. */
export function FilterBar({ base, filters, caps, teams, today, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const opts = (key: (d: Demand) => string | string[]) => countBy(base, key).map((o) => ({ value: o.name, label: `${o.name} (${o.value})` }));
  const fields: { k: keyof Filters; options: { value: string; label: string }[]; show: boolean; allLabel: string }[] = [
    {
      k: "team",
      options: teams.map((t) => ({ value: t, label: `${t} (${base.filter((d) => d.team === t).length})` })),
      show: !!filters.regional && teams.length > 1,
      allLabel: "Todos os times",
    },
    { k: "bu", options: opts((d) => d.bu), show: true, allLabel: "Todas as Business Units" },
    { k: "client", options: opts((d) => d.client), show: true, allLabel: "Todos os clientes" },
    { k: "person", options: opts((d) => d.people), show: caps.hasPeople, allLabel: "Todos os colaboradores" },
    { k: "format", options: opts((d) => d.format), show: caps.hasFormat, allLabel: "Todos os formatos" },
    { k: "status", options: opts((d) => d.status), show: caps.hasStatus, allLabel: "Todos os status" },
    { k: "priority", options: opts((d) => d.priority), show: caps.hasPriority, allLabel: "Todas as prioridades" },
    { k: "projectType", options: opts((d) => d.projectType), show: true, allLabel: "Todos os tipos" },
    {
      k: "period",
      options: PERIOD_OPTIONS.map((p) => ({ value: p.value, label: `${p.label} (${periodDescription(p.value, today)})` })),
      show: caps.hasDates,
      allLabel: "Todo o período",
    },
  ];
  const visible = fields.filter((f) => f.show);
  const active = (Object.keys(LABELS) as (keyof Filters)[]).filter((k) => filters[k]);
  const valueLabel = (k: keyof Filters) => {
    const v = filters[k] as string;
    if (k === "period") return PERIOD_OPTIONS.find((p) => p.value === v)?.label ?? v;
    return v;
  };

  return (
    <section aria-label="Filtros" className="no-print space-y-2">
      <button className="btn w-full justify-center md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SlidersHorizontal size={14} /> Filtros{active.length ? ` (${active.length})` : ""}
      </button>
      <div className={`${open ? "grid" : "hidden"} grid-cols-2 gap-1.5 sm:grid-cols-3 md:flex md:flex-nowrap md:items-center`}>
        {visible.map((f) => {
          const on = !!filters[f.k];
          return (
            <label key={f.k} className="min-w-0 md:flex-1">
              <span className="sr-only">{LABELS[f.k]}</span>
              <select
                className={`select h-8 pl-3 pr-7 text-[12px] ${on ? "border-clf-red/70 text-paper" : "text-paper-dim"}`}
                style={{ backgroundPosition: "right 8px center" }}
                value={(filters[f.k] as string) ?? ""}
                onChange={(e) => onChange({ [f.k]: e.target.value || null })}
                title={on ? `${LABELS[f.k]}: ${valueLabel(f.k)}` : LABELS[f.k]}
              >
                <option value="">{on ? f.allLabel : LABELS[f.k]}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {active.length > 0 && (
          <button className="btn hidden h-8 shrink-0 px-3 text-[12px] md:inline-flex" onClick={onClear} title="Limpar filtros">
            <RotateCcw size={12} /> Limpar
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((k) => (
            <button key={k} className="chip border-clf-red/50 py-0.5 text-[11.5px] text-paper hover:border-clf-red" onClick={() => onChange({ [k]: null })} aria-label={`Remover filtro ${LABELS[k]}`}>
              <span className="text-paper-mute">{LABELS[k]}:</span> {valueLabel(k)}
              {k === "period" && filters.period && <span className="text-paper-mute">({periodDescription(filters.period, today)})</span>}
              <X size={11} />
            </button>
          ))}
          <button className="chip py-0.5 text-[11.5px] hover:text-paper md:hidden" onClick={onClear}>
            <RotateCcw size={11} /> Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}
