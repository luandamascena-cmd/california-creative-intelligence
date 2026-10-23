"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, ChevronLeft, ChevronRight, Layers, Lightbulb, Shapes, Sparkles, TrendingDown, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { countBy, fmtPct } from "@/lib/analytics";
import { addDaysISO } from "@/lib/text";
import type { Demand } from "@/lib/types";

interface Item {
  k: string;
  icon: LucideIcon;
  text: React.ReactNode;
}

/**
 * Leituras automáticas do recorte: fatos calculados da planilha sobre o que está sendo produzido
 * (volume, formatos, clientes, unidades, novos negócios). Prazos e travas ficam no gráfico de status.
 */
export function Insights({ rows, today, compact, trendRows, rotate }: { rows: Demand[]; today: string; compact?: boolean; trendRows?: Demand[]; /** Uma frase por vez, com setas para passar (Panorama). */ rotate?: boolean }) {
  const titleId = useId();
  const [idx, setIdx] = useState(0);
  const items = useMemo(() => {
    const out: Item[] = [];
    if (!rows.length) return out;

    // Ritmo de entrada: últimos 30 dias contra os 30 anteriores.
    const d30 = addDaysISO(today, -30);
    const d60 = addDaysISO(today, -60);
    // Comparação feita sobre a base sem recorte de período, senão os 30 dias anteriores ficariam vazios.
    const trend = trendRows ?? rows;
    const now = trend.filter((d) => d.start && d.start > d30 && d.start <= today).length;
    const prev = trend.filter((d) => d.start && d.start > d60 && d.start <= d30).length;
    if (now && prev) {
      const delta = Math.round(((now - prev) / prev) * 100);
      out.push({
        k: "ritmo",
        icon: delta >= 0 ? TrendingUp : TrendingDown,
        text: (
          <>
            Entraram <b>{now}</b> demandas nos últimos 30 dias, {delta === 0 ? "o mesmo ritmo" : <><b>{Math.abs(delta)}% {delta > 0 ? "a mais" : "a menos"}</b> que</>} nos 30 dias anteriores.
          </>
        ),
      });
    }

    const formats = countBy(rows, (d) => d.format);
    if (formats[0] && rows.length >= 3) {
      out.push({
        k: "formato",
        icon: Shapes,
        text: (
          <>
            <b>{formats[0].name}</b> é o formato mais pedido: <b>{fmtPct(formats[0].value, rows.length)}</b> das demandas{formats[1] ? <>, seguido de {formats[1].name}</> : null}.
          </>
        ),
      });
    }

    const clients = countBy(rows, (d) => d.client);
    if (clients.length > 2) {
      const top3 = clients.slice(0, 3).reduce((a, b) => a + b.value, 0);
      out.push({
        k: "clientes",
        icon: Briefcase,
        text: (
          <>
            <b>{clients[0].name}</b> lidera a pauta com {clients[0].value} demandas. Os três maiores clientes somam <b>{fmtPct(top3, rows.length)}</b> do volume.
          </>
        ),
      });
    }

    const bus = countBy(rows, (d) => d.bu);
    if (bus.length > 1) {
      out.push({
        k: "bu",
        icon: Layers,
        text: (
          <>
            <b>{bus[0].name}</b> responde por <b>{fmtPct(bus[0].value, rows.length)}</b> das demandas do recorte.
          </>
        ),
      });
    }

    const newBiz = rows.filter((d) => /prospec|concorr/i.test(d.projectType)).length;
    if (newBiz) {
      out.push({
        k: "novos",
        icon: Sparkles,
        text: (
          <>
            Prospecção e concorrência somam <b>{fmtPct(newBiz, rows.length)}</b> do volume ({newBiz} {newBiz === 1 ? "demanda" : "demandas"} de novos negócios).
          </>
        ),
      });
    }

    const open = rows.filter((d) => d.isOpen);
    const planners = countBy(open, (d) => d.planners);
    if (planners[0] && open.length >= 3) {
      out.push({
        k: "planejamento",
        icon: Users,
        text: (
          <>
            <b>{planners[0].name}</b> está no planejamento de <b>{fmtPct(planners[0].value, open.length)}</b> das demandas em andamento.
          </>
        ),
      });
    }
    return out.slice(0, 4);
  }, [rows, today, trendRows]);
  useEffect(() => setIdx(0), [items.length]);
  const cur = items[Math.min(idx, items.length - 1)];
  const step = (n: number) => setIdx((i) => (i + n + items.length) % items.length);

  return (
    <section aria-labelledby={titleId} className="card relative flex h-full flex-col overflow-hidden p-0">
      {/* brilho suave atrás da lâmpada */}
      <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-[#F5C451]/[0.10] blur-3xl" />
      <header className="relative flex items-center gap-2.5 px-5 pb-1 pt-5">
        <span className="ci-bulb relative flex h-8 w-8 items-center justify-center rounded-full border border-[#F5C451]/40 bg-[#F5C451]/[0.12] text-[#F5C451]">
          <Lightbulb size={16} strokeWidth={2.2} />
        </span>
        <h2 id={titleId} className="text-[15px] font-semibold text-paper">
          Insights
        </h2>
        {rotate && items.length > 1 ? (
          <span className="ml-auto flex items-center gap-1">
            <span className="mr-1 text-[11px] tabular-nums text-paper-faint">
              {Math.min(idx, items.length - 1) + 1}/{items.length}
            </span>
            <button onClick={() => step(-1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.1] text-paper-mute hover:border-white/25 hover:text-paper" aria-label="Insight anterior">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => step(1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.1] text-paper-mute hover:border-white/25 hover:text-paper" aria-label="Próximo insight">
              <ChevronRight size={14} />
            </button>
          </span>
        ) : (
          <span className="ml-auto hidden text-[11px] text-paper-faint 2xl:block">Leituras automáticas do recorte</span>
        )}
      </header>
      {items.length && rotate && cur ? (
        <div className="relative flex flex-1 items-center overflow-hidden" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={cur.k} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.22 }} className="flex gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-paper-dim">
                <cur.icon size={14} />
              </span>
              <p className="text-[14px] leading-snug text-paper-dim [&_b]:font-semibold [&_b]:text-paper">{cur.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : items.length ? (
        <div className={`relative grid flex-1 content-center ${compact ? "md:grid-cols-2" : "md:grid-cols-2 2xl:grid-cols-4"}`}>
          {items.map((it) => (
            <div key={it.k} className="flex gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-paper-dim">
                <it.icon size={14} />
              </span>
              <p className="text-[13px] leading-snug text-paper-dim [&_b]:font-semibold [&_b]:text-paper">{it.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="relative px-5 pb-5 pt-2 text-[13px] text-paper-mute">Sem leituras automáticas para este recorte.</p>
      )}
    </section>
  );
}
