"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { countBy, type Filters } from "@/lib/analytics";
import type { Capabilities, Demand } from "@/lib/types";

interface Props {
  base: Demand[];
  filters: Filters;
  caps: Capabilities;
  teams: string[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

const LABELS: Record<string, string> = {
  team: "Time",
  bu: "BU",
  client: "Cliente",
  person: "Colaborador",
  format: "Formato",
  status: "Status",
  priority: "Prioridade",
  projectType: "Tipo",
};

export function FilterBar({ base, filters, caps, teams, onChange, onClear }: Props) {
  const opts = (key: (d: Demand) => string | string[]) => countBy(base, key);
  const fields: { k: keyof Filters; label: string; options: { name: string; value: number }[]; show: boolean }[] = [
    { k: "team", label: "Time", options: teams.map((t) => ({ name: t, value: base.filter((d) => d.team === t).length })), show: !!filters.regional && teams.length > 1 },
    { k: "bu", label: "Business Unit", options: opts((d) => d.bu), show: true },
    { k: "client", label: "Cliente", options: opts((d) => d.client), show: true },
    { k: "person", label: "Colaborador", options: opts((d) => d.people), show: caps.hasPeople },
    { k: "format", label: "Formato", options: opts((d) => d.format), show: caps.hasFormat },
    { k: "status", label: "Status", options: opts((d) => d.status), show: caps.hasStatus },
    { k: "priority", label: "Prioridade", options: opts((d) => d.priority), show: caps.hasPriority },
    { k: "projectType", label: "Tipo de projeto", options: opts((d) => d.projectType), show: true },
  ];
  const active = (Object.keys(LABELS) as (keyof Filters)[]).filter((k) => filters[k]);
  const hasAny = active.length > 0 || filters.from || filters.to;

  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Filtros" className="no-print space-y-2">
      <button className="btn w-full justify-center md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SlidersHorizontal size={14} /> Filtros{active.length ? ` (${active.length})` : ""}
      </button>
      <div className={`${open ? "grid" : "hidden"} grid-cols-2 md:grid gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]`}>
        {fields
          .filter((f) => f.show)
          .map((f) => (
            <label key={f.k} className="min-w-0">
              <span className="sr-only">{f.label}</span>
              <select
                className={`select ${filters[f.k] ? "border-clf-red/70" : ""}`}
                value={(filters[f.k] as string) ?? ""}
                onChange={(e) => onChange({ [f.k]: e.target.value || null })}
              >
                <option value="">{f.label}: todos</option>
                {f.options.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name} ({o.value})
                  </option>
                ))}
              </select>
            </label>
          ))}
        {caps.hasDates && (
          <div className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-3 lg:col-span-2 2xl:col-span-1">
            <select className="select w-[104px] shrink-0" value={filters.dateField} onChange={(e) => onChange({ dateField: e.target.value as Filters["dateField"] })} aria-label="Campo de data">
              <option value="start">Início</option>
              <option value="due">Entrega</option>
            </select>
            <input type="date" className="field min-w-0 flex-1 px-2" value={filters.from ?? ""} onChange={(e) => onChange({ from: e.target.value || null })} aria-label="De" />
            <input type="date" className="field min-w-0 flex-1 px-2" value={filters.to ?? ""} onChange={(e) => onChange({ to: e.target.value || null })} aria-label="Até" />
          </div>
        )}
      </div>
      {hasAny && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((k) => (
            <button key={k} className="chip border-clf-red/50 text-paper hover:border-clf-red" onClick={() => onChange({ [k]: null })} aria-label={`Remover filtro ${LABELS[k]}`}>
              <span className="text-paper-mute">{LABELS[k]}:</span> {filters[k] as string} <X size={12} />
            </button>
          ))}
          {(filters.from || filters.to) && (
            <button className="chip border-clf-red/50 text-paper" onClick={() => onChange({ from: null, to: null })}>
              <span className="text-paper-mute">{filters.dateField === "start" ? "Início" : "Entrega"}:</span> {filters.from ?? "…"} a {filters.to ?? "…"} <X size={12} />
            </button>
          )}
          <button className="chip hover:text-paper" onClick={onClear}>
            <RotateCcw size={12} /> Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}
