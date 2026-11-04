"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { regionalName } from "@/lib/labels";
import type { Demand } from "@/lib/types";

interface Toast {
  id: number;
  title: string;
  text: string;
}

/** Identidade de uma demanda entre leituras (o id muda se a linha for movida na planilha). */
const demandKey = (d: Demand) => `${d.sourceTab}|${d.task}|${d.client}`;

/**
 * Pulso de atualização do modo telão: compara cada leitura nova da planilha com a anterior e devolve
 * avisos (demanda nova, mudança de status) e o momento da última mudança por guia, para o bloco piscar.
 */
export function useSheetPulse(all: Demand[], version: string, live: boolean) {
  const prevRef = useRef<Map<string, string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState<Record<string, number>>({});
  useEffect(() => {
    const now = new Map(all.map((d) => [demandKey(d), d.status]));
    const old = prevRef.current;
    prevRef.current = now;
    if (!old || !live) return;
    const added = all.filter((d) => !old.has(demandKey(d)));
    const changed = all.filter((d) => old.has(demandKey(d)) && old.get(demandKey(d)) !== d.status);
    if (!added.length && !changed.length) return;
    const stamp = Date.now();
    const next: Toast[] = [];
    if (added.length > 3) next.push({ id: stamp, title: `${added.length} demandas novas`, text: [...new Set(added.map((d) => `${regionalName(d.regional)} · ${d.team}`))].join(", ") });
    else added.forEach((d, i) => next.push({ id: stamp + i, title: `Nova demanda em ${regionalName(d.regional)} · ${d.team}`, text: `${d.task} · ${d.client}` }));
    changed.slice(0, 3).forEach((d, i) => next.push({ id: stamp + 10 + i, title: `${regionalName(d.regional)} · ${d.team}`, text: `${d.task} agora está em ${d.status}` }));
    setToasts((t) => [...t, ...next].slice(-4));
    next.forEach((t) => window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 8000));
    setFlash((f) => {
      const out = { ...f };
      [...added, ...changed].forEach((d) => (out[d.sourceTab] = stamp));
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return { toasts, flash };
}

export function PulseToasts({ toasts, className = "right-6 top-24" }: { toasts: Toast[]; className?: string }) {
  return (
    <div className={`no-print pointer-events-none fixed z-50 flex w-[360px] flex-col gap-2 ${className}`}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-3 rounded-2xl border border-clf-red/40 bg-[#1b1b1d]/95 p-3.5 shadow-2xl backdrop-blur-xl"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clf-red/15 text-clf-red">
              <Sparkles size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-paper">{t.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-paper-dim">{t.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Pisca a moldura do bloco por alguns segundos quando `stamp` muda (modo telão). */
export function useFlash(stamp: number, live: boolean) {
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (!stamp || !live) return;
    setFlashing(true);
    const t = window.setTimeout(() => setFlashing(false), 3600);
    return () => window.clearTimeout(t);
  }, [stamp, live]);
  return flashing;
}
