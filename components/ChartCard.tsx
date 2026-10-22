"use client";

import { useId, useRef, useState } from "react";
import { Download, Info, Table2 } from "lucide-react";
import { motion } from "motion/react";
import type { EChartHandle } from "./EChart";
import { titleCase } from "@/lib/labels";
import { PERIOD_OPTIONS, PERIOD_DEFINITION, periodDescription } from "@/lib/period";
import { todayISO } from "@/lib/text";
import { usePeriodScope, type ChartPeriod } from "./PeriodScope";

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

interface Props {
  code: string;
  title: string;
  definition: string;
  className?: string;
  actions?: React.ReactNode;
  table?: TableData;
  empty?: string | false;
  children: (ref: React.RefObject<EChartHandle | null>) => React.ReactNode;
}

/** Moldura padrão dos gráficos: título, definição da métrica, exportação PNG e visão em tabela. */
export function ChartCard({ code, title, definition, className = "", actions, table, empty, children }: Props) {
  const ref = useRef<EChartHandle | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [showDef, setShowDef] = useState(false);
  const uid = useId();
  const fileSlug = `${code}-${title}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
  // id único: o mesmo gráfico aparece várias vezes no Panorama.
  const slug = fileSlug + uid.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`card flex min-w-0 flex-col p-5 sm:p-6 ${className}`}
      aria-labelledby={`${slug}-t`}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-[150px] flex-1">
          <h2 id={`${slug}-t`} className="text-[15px] font-semibold leading-snug tracking-[-0.005em] text-paper">
            {titleCase(title)}
          </h2>
          {showDef && <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-paper-mute">{definition}</p>}
        </div>
        <div className="no-print ml-auto flex shrink-0 items-center gap-1">
          <PeriodSelect />
          {actions}
          <IconBtn label="Definição da métrica" active={showDef} onClick={() => setShowDef((v) => !v)}>
            <Info size={14} />
          </IconBtn>
          {table && (
            <IconBtn label="Ver como tabela" active={showTable} onClick={() => setShowTable((v) => !v)}>
              <Table2 size={14} />
            </IconBtn>
          )}
          <IconBtn label="Exportar PNG" onClick={() => ref.current?.png(fileSlug)}>
            <Download size={14} />
          </IconBtn>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-white/[0.12] px-6 text-center text-[13px] text-paper-mute">
            {empty}
          </div>
        ) : showTable && table ? (
          <div className="max-h-[340px] overflow-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-white/[0.06] text-paper-mute">
                <tr>{table.columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/[0.08]">
                    {r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${typeof c === "number" ? "tabular-nums text-right" : ""}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children(ref)
        )}
      </div>
    </motion.section>
  );
}

export function IconBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${active ? "bg-white/[0.08] text-paper" : "text-paper-mute hover:bg-white/[0.06] hover:text-paper"}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-white/[0.12] bg-white/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${value === o.value ? "bg-ink-600 text-paper" : "text-paper-mute hover:text-paper"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Seletor de período do gráfico. Só aparece quando o gráfico está dentro de um PeriodScope. */
function PeriodSelect() {
  const scope = usePeriodScope();
  if (!scope) return null;
  const today = todayISO();
  const globalLabel = scope.global ? `Geral: ${PERIOD_OPTIONS.find((p) => p.value === scope.global)?.label}` : "Todo o período";
  const current = scope.value === "global" ? null : scope.value;
  return (
    <label className="mr-1">
      <span className="sr-only">Período do gráfico</span>
      <select
        value={scope.value}
        onChange={(e) => scope.onChange(e.target.value as ChartPeriod)}
        title={current ? `Período: ${periodDescription(current, today)}. ${PERIOD_DEFINITION}` : `Segue o filtro geral de período. ${PERIOD_DEFINITION}`}
        className={`h-7 appearance-none rounded-full border bg-white/[0.06] py-0 pl-2.5 pr-6 text-[11px] font-medium outline-none transition hover:border-white/25 ${current ? "border-clf-red/60 text-paper" : "border-white/[0.12] text-paper-mute"}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238F8D88' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        <option value="global">{globalLabel}</option>
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
