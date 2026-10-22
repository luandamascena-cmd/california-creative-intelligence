"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, X } from "lucide-react";
import { DemandItem, sortByUrgency } from "./charts/PersonDemands";
import type { DrillRequest } from "./charts/types";
import { CAT_LABEL, isLate } from "@/lib/analytics";
import { shortName } from "@/lib/people";
import { LATE, STATUS_COLORS, STATUS_ORDER } from "./theme";
import { useFitGrid } from "./useFitGrid";
import { Avatar, CountBadge, LateBadge } from "./charts/operation";
import type { Demand, StatusCategory } from "@/lib/types";

/**
 * Faixa de Colaboradores em Pauta, logo abaixo de Clientes em Pauta e no mesmo formato.
 * Todas as pessoas cabem em uma única fileira: o círculo cresce ou diminui conforme a quantidade.
 * As demandas de cada pessoa só aparecem ao clicar na foto, logo abaixo da faixa.
 */
export function PeopleStrip({ rows, today, onDrill }: { rows: Demand[]; today: string; onDrill?: (r: DrillRequest) => void }) {
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const cats = useMemo(() => STATUS_ORDER.filter((c) => c !== "finalizado" && open.some((d) => d.statusCategory === c)), [open]);
  const people = useMemo(() => {
    const m = new Map<string, { total: number; late: number; byCat: Record<string, number> }>();
    open.forEach((d) =>
      d.people.forEach((p) => {
        const s = m.get(p) ?? { total: 0, late: 0, byCat: {} };
        s.total++;
        s.byCat[d.statusCategory] = (s.byCat[d.statusCategory] ?? 0) + 1;
        if (isLate(d, today)) s.late++;
        m.set(p, s);
      }),
    );
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).map(([name, s]) => ({ name, ...s }));
  }, [open, today]);

  const titleId = useId();
  // minItem 1: uma coluna por pessoa, sempre em uma fileira só.
  const gap = people.length > 16 ? 4 : 8;
  const fit = useFitGrid(people.length, { minItem: 1, gap, minCircle: 24, maxCircle: 96, ratio: 0.74 });
  const colWidth = fit.circle / 0.74;
  const label = colWidth >= 78 ? "full" : colWidth >= 38 ? "first" : "none";
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked && people.some((p) => p.name === picked) ? picked : null;
  const list = current ? sortByUrgency(open.filter((d) => d.people.includes(current))) : [];
  const late = list.filter((d) => isLate(d, today)).length;

  return (
    <section aria-labelledby={titleId} data-strip="colaboradores" className="card overflow-hidden p-0">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-4">
        <h2 id={titleId} className="text-[14px] font-semibold text-paper">
          Colaboradores em Pauta
        </h2>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-paper-faint">
          {people.length ? (
            <>
              <span>{people.length} {people.length === 1 ? "pessoa com demandas abertas" : "pessoas com demandas abertas"} · clique para ver as demandas</span>
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-paper-mute">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_COLORS[c] }} />
                  {CAT_LABEL[c as StatusCategory]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-paper-mute">
                <span className="h-2 w-2 rounded-full" style={{ background: LATE }} />
                Vencidas
              </span>
            </>
          ) : (
            "Nenhuma demanda aberta com responsável no recorte"
          )}
        </span>
      </header>
      {people.length > 0 && (
        <div ref={fit.ref} className="px-4 pb-4 pt-3">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))`, columnGap: fit.gap }}>
            {people.map((p) => {
              const sel = p.name === current;
              return (
                <li key={p.name} className="min-w-0">
                  <button
                    onClick={() => setPicked(sel ? null : p.name)}
                    aria-pressed={sel}
                    aria-expanded={sel}
                    aria-label={`${p.name}: ${p.total} ${p.total === 1 ? "demanda aberta" : "demandas abertas"}${p.late ? `, ${p.late} vencidas` : ""}`}
                    title={`${p.name} · ${p.total} ${p.total === 1 ? "demanda aberta" : "demandas abertas"}${p.late ? ` · ${p.late} vencidas` : ""}`}
                    className={`group flex w-full flex-col items-center rounded-2xl py-2 transition ${sel ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                  >
                    <span className="relative">
                      <Avatar name={p.name} size={fit.circle} selected={sel} />
                      <CountBadge value={p.total} size={fit.circle} />
                      {p.late > 0 && <LateBadge value={p.late} size={fit.circle} />}
                    </span>
                    {label !== "none" && (
                      <span className={`mt-2 block w-full truncate px-0.5 text-center ${label === "full" ? "text-[11.5px]" : colWidth >= 52 ? "text-[10.5px]" : "text-[9.5px]"} ${sel ? "font-semibold text-paper" : "text-paper-dim group-hover:text-paper"}`}>
                        {label === "full" ? shortName(p.name) : p.name.split(/\s+/)[0]}
                      </span>
                    )}
                    <span className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-white/[0.08]" style={{ width: Math.min(56, fit.circle * 0.8) }} aria-hidden>
                      {cats.map((c) => (
                        <span key={c} className="h-full" style={{ width: `${((p.byCat[c] ?? 0) / p.total) * 100}%`, background: STATUS_COLORS[c] }} />
                      ))}
                    </span>
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
                    onClick={() => onDrill({ title: current, subtitle: "Demandas abertas do colaborador", rows: list, apply: { person: current } })}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-paper-mute hover:bg-white/[0.08] hover:text-paper"
                    title="Ver as demandas com todos os campos"
                    aria-label="Ver as demandas com todos os campos"
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
                  <DemandItem d={d} today={today} detail="client" />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
