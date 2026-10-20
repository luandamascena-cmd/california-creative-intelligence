"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2 } from "lucide-react";
import { STATUS_COLORS, LATE } from "../theme";
import { isLate } from "@/lib/analytics";
import { diffDays } from "@/lib/text";
import { linkHost, linkIcon } from "../Drawer";
import type { Demand } from "@/lib/types";

const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Ordem de leitura: vencidas primeiro (da mais antiga), depois pelo prazo, sem prazo por último. */
export function sortByUrgency(rows: Demand[]) {
  return [...rows].sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    if (!a.due && !b.due) return a.task.localeCompare(b.task);
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });
}

/** Mede a largura do cartão para decidir se a lista fica ao lado do gráfico ou abaixo dele. */
export function useWide(min = 880) {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= min));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [min]);
  return { ref, wide };
}

interface Props {
  name: string;
  rows: Demand[];
  today: string;
  caption: string;
  onExpand: () => void;
}

/** Demandas de um colaborador, dentro do próprio gráfico: sem abrir painel nem janela. */
export function PersonDemands({ name, rows, today, caption, onExpand }: Props) {
  const list = sortByUrgency(rows);
  const late = rows.filter((d) => isLate(d, today)).length;
  return (
    <aside aria-label={`Demandas de ${name}`} className="flex min-h-0 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-paper">{name}</p>
          <p className="text-[11.5px] text-paper-mute">
            {rows.length} {caption}
            {late > 0 && (
              <span style={{ color: LATE }}>
                {" "}
                · {late} {late === 1 ? "vencida" : "vencidas"}
              </span>
            )}
          </p>
        </div>
        <button onClick={onExpand} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-paper-mute hover:bg-white/[0.08] hover:text-paper" title="Ver todos os campos das demandas" aria-label="Ver todos os campos das demandas">
          <Maximize2 size={13} />
        </button>
      </header>
      <ul className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto">
        {list.map((d) => (
          <li key={d.id} className="px-4 py-2.5">
            <DemandItem d={d} today={today} detail="client" />
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Uma demanda em linha: tarefa, cliente ou responsáveis, status, prazo e links. */
export function DemandItem({ d, today, detail }: { d: Demand; today: string; detail: "client" | "people" }) {
  const overdue = isLate(d, today);
  return (
    <>
      <p className="text-[12.5px] font-medium leading-snug text-paper">{d.task}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-paper-mute">
        <span className="truncate">{detail === "client" ? d.client : d.people.join(", ") || "sem responsável"}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[d.statusCategory] }} />
          {d.status}
        </span>
        {d.due ? (
          overdue ? (
            <span style={{ color: LATE }}>
              venceu há {diffDays(d.due, today)} {diffDays(d.due, today) === 1 ? "dia" : "dias"}
            </span>
          ) : (
            <span>
              {d.isOpen ? "entrega" : "entregue em"} {fmt(d.due)}
            </span>
          )
        ) : (
          <span className="text-paper-faint">sem prazo</span>
        )}
      </div>
      {d.links.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {d.links.slice(0, 4).map((l) => {
            const Icon = linkIcon(l.url);
            return (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${l.label} · ${linkHost(l.url)}`}
                className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.05] px-2 py-0.5 text-[11px] text-paper-dim hover:border-white/25 hover:text-paper"
              >
                <Icon size={11} className="shrink-0" aria-hidden />
                <span className="truncate">{l.label}</span>
                <ExternalLink size={10} className="shrink-0 opacity-60" aria-hidden />
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
