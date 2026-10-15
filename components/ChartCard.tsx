"use client";

import { useRef, useState } from "react";
import { Download, Info, Table2 } from "lucide-react";
import { motion } from "motion/react";
import type { EChartHandle } from "./EChart";

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
  const slug = `${code}-${title}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`card flex min-w-0 flex-col p-4 sm:p-5 ${className}`}
      aria-labelledby={`${slug}-t`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[12px] tracking-[0.2em] text-clf-red">{code}</span>
            <h2 id={`${slug}-t`} className="display truncate text-[17px] tracking-[0.06em] text-paper">
              {title}
            </h2>
          </div>
          {showDef && <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-paper-mute">{definition}</p>}
        </div>
        <div className="no-print flex shrink-0 items-center gap-1">
          {actions}
          <IconBtn label="Definição da métrica" active={showDef} onClick={() => setShowDef((v) => !v)}>
            <Info size={14} />
          </IconBtn>
          {table && (
            <IconBtn label="Ver como tabela" active={showTable} onClick={() => setShowTable((v) => !v)}>
              <Table2 size={14} />
            </IconBtn>
          )}
          <IconBtn label="Exportar PNG" onClick={() => ref.current?.png(slug)}>
            <Download size={14} />
          </IconBtn>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-ink-600 px-6 text-center text-[13px] text-paper-mute">
            {empty}
          </div>
        ) : showTable && table ? (
          <div className="max-h-[340px] overflow-auto rounded-lg border border-ink-700">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-ink-800 text-paper-mute">
                <tr>{table.columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-ink-700">
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
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${active ? "bg-ink-700 text-paper" : "text-paper-mute hover:bg-ink-800 hover:text-paper"}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-ink-600 bg-ink-800 p-0.5">
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
