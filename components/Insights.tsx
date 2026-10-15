"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { countBy, fmtPct, isLate } from "@/lib/analytics";
import { diffDays } from "@/lib/text";
import type { Demand } from "@/lib/types";

/** Leituras automáticas: frases calculadas a partir dos dados filtrados (fatos, não opiniões). */
export function Insights({ rows, today }: { rows: Demand[]; today: string }) {
  const items = useMemo(() => {
    const out: { k: string; text: React.ReactNode }[] = [];
    if (!rows.length) return out;
    const open = rows.filter((d) => d.isOpen);

    const planners = countBy(open, (d) => d.planners);
    if (planners[0] && open.length >= 3) {
      out.push({
        k: "plan",
        text: (
          <>
            <b>{planners[0].name}</b> está no planejamento de <b>{fmtPct(planners[0].value, open.length)}</b> das demandas abertas ({planners[0].value} de {open.length}).
          </>
        ),
      });
    }
    const late = open.filter((d) => isLate(d, today)).sort((a, b) => a.due!.localeCompare(b.due!));
    if (late.length) {
      out.push({
        k: "late",
        text: (
          <>
            <b>{late.length}</b> {late.length === 1 ? "demanda aberta está" : "demandas abertas estão"} com prazo vencido; a mais antiga, <b>{late[0].task}</b>, venceu há {diffDays(late[0].due!, today)} dias.
          </>
        ),
      });
    }
    const bus = countBy(rows, (d) => d.bu);
    if (bus.length > 1) {
      out.push({
        k: "bu",
        text: (
          <>
            <b>{bus[0].name}</b> responde por <b>{fmtPct(bus[0].value, rows.length)}</b> das demandas do recorte.
          </>
        ),
      });
    }
    const blocked = open.filter((d) => d.statusCategory === "travado").length;
    if (blocked && open.length) {
      out.push({
        k: "blocked",
        text: (
          <>
            <b>{fmtPct(blocked, open.length)}</b> da pauta aberta está travada ({blocked} {blocked === 1 ? "demanda" : "demandas"}).
          </>
        ),
      });
    }
    const newBiz = rows.filter((d) => /prospec|concorr/i.test(d.projectType)).length;
    if (newBiz) {
      out.push({
        k: "nb",
        text: (
          <>
            Prospecção e concorrência somam <b>{fmtPct(newBiz, rows.length)}</b> do volume ({newBiz} demandas).
          </>
        ),
      });
    }
    return out.slice(0, 4);
  }, [rows, today]);

  if (!items.length) return null;
  return (
    <section aria-label="Leituras automáticas" className="card grid gap-px overflow-hidden p-0 md:grid-cols-2 2xl:grid-cols-4">
      {items.map((it, i) => (
        <div key={it.k} className="flex gap-3 bg-ink-850 px-4 py-3.5">
          <span className="display mt-0.5 text-[13px] text-clf-red">{String(i + 1).padStart(2, "0")}</span>
          <p className="text-[13px] leading-snug text-paper-dim [&_b]:font-semibold [&_b]:text-paper">{it.text}</p>
        </div>
      ))}
      <div className="col-span-full flex items-center gap-1.5 border-t border-ink-700 bg-ink-850 px-4 py-1.5 text-[10.5px] text-paper-faint">
        <Sparkles size={11} /> Leituras calculadas automaticamente a partir dos dados do filtro. São fatos da planilha, não recomendações.
      </div>
    </section>
  );
}
