"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Filter, Search, X } from "lucide-react";
import type { DrillRequest } from "./charts/types";
import { isLate, toCsv } from "@/lib/analytics";
import { formatDateBR, normKey } from "@/lib/text";
import { LATE, STATUS_COLORS } from "./theme";
import { tabLabel } from "@/lib/labels";

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Painel lateral com os registros que compõem um indicador. */
export function Drawer({ req, today, onClose, onApply }: { req: DrillRequest | null; today: string; onClose: () => void; onApply: (r: DrillRequest) => void }) {
  const [q, setQ] = useState("");
  useEffect(() => setQ(""), [req]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = useMemo(() => {
    if (!req) return [];
    const k = normKey(q);
    const list = k ? req.rows.filter((d) => normKey([d.task, d.client, d.bu, d.people.join(" "), d.format].join(" ")).includes(k)) : req.rows;
    return [...list].sort((a, b) => Number(b.isOpen) - Number(a.isOpen) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  }, [req, q]);
  const projects = req ? new Set(req.rows.map((d) => d.projectKey)).size : 0;

  return (
    <AnimatePresence>
      {req && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={req.title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-white/[0.08] bg-[#121214]/80 backdrop-blur-2xl shadow-2xl"
          >
            <header className="border-b border-white/[0.08] px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {req.subtitle && <p className="eyebrow mb-1">{req.subtitle}</p>}
                  <h2 className="display text-[26px] leading-tight text-paper">{req.title}</h2>
                  <p className="mt-1.5 text-[12.5px] text-paper-mute">
                    {req.rows.length} {req.rows.length === 1 ? "demanda" : "demandas"} · {projects} {projects === 1 ? "projeto" : "projetos"} · {req.rows.filter((d) => d.isOpen).length} abertas
                  </p>
                </div>
                <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-paper-mute hover:bg-white/[0.06] hover:text-paper">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {req.apply && (
                  <button className="btn border-clf-red/60 text-paper" onClick={() => onApply(req)}>
                    <Filter size={14} /> Aplicar como filtro
                  </button>
                )}
                <button className="btn" onClick={() => downloadCsv(`california-${normKey(req.title).replace(/ /g, "-")}`, toCsv(req.rows))}>
                  <Download size={14} /> CSV
                </button>
                <label className="relative ml-auto min-w-[160px] flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-paper-faint" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nesta lista" className="field pl-8" aria-label="Buscar nesta lista" />
                </label>
              </div>
            </header>
            <ul className="flex-1 divide-y divide-white/[0.08] overflow-y-auto">
              {rows.map((d) => {
                const late = isLate(d, today);
                return (
                  <li key={d.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13.5px] font-medium leading-snug text-paper">{d.task}</p>
                      <span className="chip shrink-0 py-0.5 text-[11px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[d.statusCategory] }} />
                        {d.status}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
                      <Field k="Cliente" v={d.client} />
                      <Field k="Business Unit" v={d.bu} />
                      <Field k="Formato" v={d.format} />
                      <Field k="Planejamento" v={d.planners.join(", ") || "sem responsável"} />
                      <Field k="Direção de arte" v={d.artDirectors.join(", ") || "sem responsável"} />
                      <Field k="Prioridade" v={d.priority} />
                      <Field k="Início" v={formatDateBR(d.start) || "sem data"} />
                      <Field k="Entrega" v={formatDateBR(d.due) || "sem data"} color={late ? LATE : undefined} extra={late ? " · vencida" : ""} />
                      <Field k="Tipo" v={d.projectType} />
                      <Field k="Projeto (regra)" v={d.projectLabel} wide />
                      <Field k="Origem na planilha" v={`${tabLabel(d.sourceTab)} · linha ${d.row}`} wide />
                      {d.notes && <Field k="Observações" v={d.notes} wide />}
                    </dl>
                  </li>
                );
              })}
              {!rows.length && <li className="px-5 py-10 text-center text-[13px] text-paper-mute">Nada encontrado.</li>}
            </ul>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ k, v, color, extra = "", wide }: { k: string; v: string; color?: string; extra?: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-full" : ""}`}>
      <dt className="text-[10.5px] uppercase tracking-wide text-paper-faint">{k}</dt>
      <dd className="truncate text-paper-dim" style={{ color }} title={v}>
        {v}
        {extra}
      </dd>
    </div>
  );
}
