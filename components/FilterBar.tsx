"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { countBy, EMPTY_FILTERS, type Filters } from "@/lib/analytics";
import { PERIOD_OPTIONS, periodDescription, type PeriodKey } from "@/lib/period";
import type { Capabilities, Demand } from "@/lib/types";

interface Props {
  base: Demand[];
  filters: Filters;
  caps: Capabilities;
  today: string;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

const LABELS: Record<string, string> = {
  bu: "Business Unit",
  client: "Cliente",
  person: "Colaborador",
  format: "Formato",
  status: "Status",
  priority: "Prioridade",
  projectType: "Tipo de Projeto",
  period: "Período",
};

/** Filtros aplicados pelo drill-down ("Aplicar como filtro"), que não têm seletor próprio. */
const EXTRA: (keyof Filters)[] = ["person", "format", "status", "priority", "projectType"];

/**
 * Uma linha só: Business Unit, Cliente e Período. O valor escolhido aparece dentro do próprio seletor,
 * sem etiquetas embaixo. Filtros vindos do drill-down entram na mesma linha, como seletores com o valor.
 */
export function FilterBar({ base, filters, caps, today, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const opts = (key: (d: Demand) => string | string[]) => countBy(base, key).map((o) => ({ value: o.name, label: `${o.name} (${o.value})` }));
  const extras = EXTRA.filter((k) => filters[k]);
  const changed = (["bu", "client", ...EXTRA] as (keyof Filters)[]).some((k) => filters[k]) || filters.period !== EMPTY_FILTERS.period;

  const selectCls = (on: boolean) => `select h-8 pl-3 pr-7 text-[12px] ${on ? "border-clf-red/70 text-paper" : "text-paper-dim"}`;
  const field = (k: "bu" | "client", all: string, options: { value: string; label: string }[]) => {
    const on = !!filters[k];
    return (
      <label key={k} className="min-w-0 md:w-[240px] md:flex-none">
        <span className="sr-only">{LABELS[k]}</span>
        <select className={selectCls(on)} style={{ backgroundPosition: "right 8px center" }} value={filters[k] ?? ""} onChange={(e) => onChange({ [k]: e.target.value || null })} title={LABELS[k]}>
          <option value="">{on ? all : LABELS[k]}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <section aria-label="Filtros" className="no-print">
      <button className="btn mb-2 w-full justify-center md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SlidersHorizontal size={14} /> Filtros
      </button>
      <div className={`${open ? "flex" : "hidden"} flex-col gap-1.5 md:flex md:flex-row md:flex-wrap md:items-center`}>
        {field("bu", "Todas as Business Units", opts((d) => d.bu))}
        {field("client", "Todos os clientes", opts((d) => d.client))}
        {caps.hasDates && (
          <label className="min-w-0 md:w-[260px] md:flex-none">
            <span className="sr-only">Período</span>
            <select
              className={selectCls(filters.period !== EMPTY_FILTERS.period)}
              style={{ backgroundPosition: "right 8px center" }}
              value={filters.period ?? EMPTY_FILTERS.period ?? "tudo"}
              onChange={(e) => onChange({ period: e.target.value as PeriodKey })}
              title="Período"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value === "tudo" ? p.label : `${p.label} (${periodDescription(p.value, today)})`}
                </option>
              ))}
            </select>
          </label>
        )}
        {extras.map((k) => (
          <span key={k} className="inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-full border border-clf-red/70 bg-white/[0.06] pl-3 pr-1.5 text-[12px] text-paper">
            <span className="shrink-0 text-paper-mute">{LABELS[k]}:</span>
            <span className="truncate">{filters[k] as string}</span>
            <button onClick={() => onChange({ [k]: null })} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-paper-mute hover:bg-white/[0.1] hover:text-paper" aria-label={`Remover filtro ${LABELS[k]}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        {changed && (
          <button className="btn h-8 shrink-0 px-3 text-[12px]" onClick={onClear} title="Volta para todas as Business Units, todos os clientes e os últimos 30 dias">
            <RotateCcw size={12} /> Limpar
          </button>
        )}
      </div>
    </section>
  );
}
