"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, X } from "lucide-react";
import { DemandItem, sortByUrgency } from "./charts/PersonDemands";
import type { DrillRequest } from "./charts/types";
import { isLate } from "@/lib/analytics";
import { ClientMark } from "./ClientMark";
import { LATE } from "./theme";
import { useFitGrid } from "./useFitGrid";
import { CountBadge, LateBadge } from "./charts/operation";
import type { Demand } from "@/lib/types";

/**
 * Faixa horizontal com os clientes que têm demandas em pauta (abertas) no recorte.
 * Clicar no logo abre, logo abaixo, a lista das demandas daquele cliente, sem sair da página.
 */
export function ClientStrip({ rows, today, onDrill }: { rows: Demand[]; today: string; onDrill?: (r: DrillRequest) => void }) {
  const clients = useMemo(() => {
    const m = new Map<string, { open: number; late: number; total: number }>();
    rows.forEach((d) => {
      const s = m.get(d.client) ?? { open: 0, late: 0, total: 0 };
      s.total++;
      if (d.isOpen) s.open++;
      if (isLate(d, today)) s.late++;
      m.set(d.client, s);
    });
    return [...m.entries()]
      .filter(([, s]) => s.open > 0)
      .sort((a, b) => b[1].open - a[1].open || b[1].total - a[1].total || a[0].localeCompare(b[0]))
      .map(([name, s]) => ({ name, ...s }));
  }, [rows, today]);
  const titleId = useId();
  const fit = useFitGrid(clients.length, { minItem: 96, gap: 8, maxCircle: 104 });
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked && clients.some((c) => c.name === picked) ? picked : null;
  const list = current ? sortByUrgency(rows.filter((d) => d.client === current && d.isOpen)) : [];
  const late = list.filter((d) => isLate(d, today)).length;

  return (
    <section aria-labelledby={titleId} data-strip="clientes" className="card overflow-hidden p-0">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <h2 id={titleId} className="text-[14px] font-semibold text-paper">
          Clientes em Pauta
        </h2>
        <span className="text-[11.5px] text-paper-faint">
          {clients.length ? `${clients.length} ${clients.length === 1 ? "cliente com demandas abertas" : "clientes com demandas abertas"} · clique para ver as demandas` : "Nenhum cliente com demanda aberta no recorte"}
        </span>
      </header>
      {clients.length > 0 && (
        <div ref={fit.ref} className="px-4 pb-4 pt-3">
        <ul className="grid gap-y-3" style={{ gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))`, columnGap: fit.gap }}>
          {clients.map((c) => {
            const sel = c.name === current;
            return (
              <li key={c.name}>
                <button
                  onClick={() => setPicked(sel ? null : c.name)}
                  aria-pressed={sel}
                  aria-expanded={sel}
                  title={`${c.name} · ${c.open} ${c.open === 1 ? "demanda aberta" : "demandas abertas"}${c.late ? ` · ${c.late} vencidas` : ""}`}
                  className={`group flex w-full flex-col items-center rounded-2xl px-1 py-2 transition ${sel ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="relative">
                    <ClientMark
                      name={c.name}
                      size={fit.circle}
                      className={`transition duration-200 ${sel ? "ring-2 ring-clf-red ring-offset-2 ring-offset-[#1b1b1d]" : "group-hover:scale-[1.04]"}`}
                    />
                    <CountBadge value={c.open} size={fit.circle} />
                    {c.late > 0 && <LateBadge value={c.late} size={fit.circle} />}
                  </span>
                  <span className={`mt-2 block w-full truncate text-center text-[11.5px] ${sel ? "font-semibold text-paper" : "text-paper-dim group-hover:text-paper"}`}>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      )}
      <AnimatePresence initial={false}>
        {current && (
          <motion.div
            key={current}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.07]"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4">
              <p className="text-[13.5px] font-semibold text-paper">
                {current}{" "}
                <span className="font-normal text-paper-mute">
                  · {list.length} {list.length === 1 ? "demanda aberta" : "demandas abertas"}
                  {late > 0 && <span style={{ color: LATE }}> · {late} {late === 1 ? "vencida" : "vencidas"}</span>}
                </span>
              </p>
              <div className="flex items-center gap-1">
                {onDrill && (
                  <button
                    onClick={() => onDrill({ title: current, subtitle: "Demandas do cliente", rows: rows.filter((d) => d.client === current), apply: { client: current } })}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-paper-mute hover:bg-white/[0.08] hover:text-paper"
                    title="Ver todas as demandas do cliente, com todos os campos"
                    aria-label="Ver todas as demandas do cliente"
                  >
                    <Maximize2 size={13} />
                  </button>
                )}
                <button onClick={() => setPicked(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-paper-mute hover:bg-white/[0.08] hover:text-paper" aria-label="Fechar">
                  <X size={14} />
                </button>
              </div>
            </div>
            <ul className="grid gap-x-6 px-5 pb-4 pt-2 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((d) => (
                <li key={d.id} className="border-b border-white/[0.06] py-2.5">
                  <DemandItem d={d} today={today} detail="people" />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
