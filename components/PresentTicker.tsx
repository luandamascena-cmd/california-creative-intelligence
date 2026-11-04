"use client";

import { useEffect, useMemo, useState } from "react";
import { isLate } from "@/lib/analytics";
import { regionalName } from "@/lib/labels";
import { addDaysISO } from "@/lib/text";
import type { Demand } from "@/lib/types";

interface Item {
  tag: string;
  text: string;
  tone?: "alert" | "warn";
}

const who = (d: Demand) => `${regionalName(d.regional)} · ${d.team}`;

/**
 * Letreiro do modo telão: corre no rodapé com os fatos do dia (entregas de hoje e de amanhã,
 * entradas da semana, travadas e vencidas por regional). À direita, relógio e selo "ao vivo".
 */
export function PresentTicker({ demands, today, syncedAt, paused }: { demands: Demand[]; today: string; syncedAt: string; paused: boolean }) {
  const items = useMemo(() => {
    const open = demands.filter((d) => d.isOpen);
    const tomorrow = addDaysISO(today, 1);
    const week = addDaysISO(today, -7);
    const out: Item[] = [];
    open.filter((d) => d.due === today).slice(0, 8).forEach((d) => out.push({ tag: "Entrega hoje", text: `${d.task} · ${d.client} · ${who(d)}`, tone: "warn" }));
    open.filter((d) => d.due === tomorrow).slice(0, 8).forEach((d) => out.push({ tag: "Amanhã", text: `${d.task} · ${d.client} · ${who(d)}` }));
    const entered = demands.filter((d) => d.start && d.start > week && d.start <= today).length;
    if (entered) out.push({ tag: "Semana", text: `${entered} ${entered === 1 ? "demanda entrou" : "demandas entraram"} na pauta nos últimos 7 dias` });
    open.filter((d) => d.statusCategory === "travado").slice(0, 6).forEach((d) => out.push({ tag: "Travada", text: `${d.task} · ${d.client} · ${who(d)}`, tone: "alert" }));
    const lateBy = new Map<string, number>();
    open.filter((d) => isLate(d, today)).forEach((d) => lateBy.set(d.regional, (lateBy.get(d.regional) ?? 0) + 1));
    [...lateBy.entries()].forEach(([r, n]) => out.push({ tag: "Vencidas", text: `${regionalName(r)}: ${n} ${n === 1 ? "demanda com entrega vencida" : "demandas com entrega vencida"}`, tone: "alert" }));
    const people = new Set(open.flatMap((d) => d.people)).size;
    out.push({ tag: "Pauta", text: `${open.length} demandas em andamento com ${people} pessoas da criação` });
    return out;
  }, [demands, today]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const ago = Math.max(0, Math.round((now.getTime() - new Date(syncedAt).getTime()) / 60_000));
  const clock = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const chars = items.reduce((a, b) => a + b.tag.length + b.text.length + 6, 0);
  const duration = Math.max(40, chars * 0.16);

  const strip = (dup: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={dup}>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2.5 pr-8 text-[13px]">
          <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${it.tone === "alert" ? "bg-clf-red/90 text-white" : it.tone === "warn" ? "bg-[#F5C451]/90 text-ink" : "bg-white/[0.12] text-paper"}`}>{it.tag}</span>
          <span className="whitespace-nowrap text-paper-dim">{it.text}</span>
          <span className="ml-5 h-1 w-1 rounded-full bg-clf-red/70" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 flex h-11 items-center border-t border-white/[0.08] bg-ink/90 backdrop-blur-xl">
      <div className="relative min-w-0 flex-1 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)" }}>
        <div className={`ci-marquee flex w-max ${paused ? "is-paused" : ""}`} style={{ animationDuration: `${duration}s` }}>
          {strip(false)}
          {strip(true)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 border-l border-white/[0.08] px-4 text-[12px]">
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-clf-red">
          <span className="relative flex h-2 w-2">
            <span className="ci-ping absolute inset-0 rounded-full bg-clf-red" />
            <span className="relative h-2 w-2 rounded-full bg-clf-red" />
          </span>
          Ao vivo
        </span>
        <span className="text-paper-faint">{ago < 1 ? "atualizado agora" : `atualizado há ${ago} min`}</span>
        <span className="display text-[20px] leading-none text-paper">{clock}</span>
      </div>
    </div>
  );
}
