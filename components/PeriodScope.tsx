"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { filterByPeriod, type PeriodKey } from "@/lib/period";
import type { Demand } from "@/lib/types";
import type { ChartCtx, ChartProps } from "./charts/types";

export type ChartPeriod = PeriodKey | "global";

interface PeriodCtxValue {
  value: ChartPeriod;
  onChange: (v: ChartPeriod) => void;
  global: PeriodKey | null;
}

/** Disponível dentro de cada gráfico com período próprio; o ChartCard mostra o seletor. */
export const PeriodContext = createContext<PeriodCtxValue | null>(null);
export const usePeriodScope = () => useContext(PeriodContext);

interface Props {
  Chart: (p: ChartProps) => React.ReactNode;
  /** Base já filtrada por tudo, menos o período. */
  base: Demand[];
  ctx: ChartCtx;
  global: PeriodKey | null;
  className?: string;
}

/** Envolve um gráfico com seu próprio seletor de período (padrão: segue o filtro geral). */
export function PeriodScope({ Chart, base, ctx, global, className }: Props) {
  const [value, setValue] = useState<ChartPeriod>("global");
  const effective = value === "global" ? global : value;
  const rows = useMemo(() => filterByPeriod(base, effective, ctx.today), [base, effective, ctx.today]);
  return (
    <PeriodContext.Provider value={{ value, onChange: setValue, global }}>
      <Chart rows={rows} ctx={ctx} className={className} />
    </PeriodContext.Provider>
  );
}
