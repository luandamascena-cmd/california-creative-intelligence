"use client";

import { useMemo } from "react";
import { ChartCard } from "../ChartCard";
import { EChart } from "../EChart";
import { C, CATEGORICAL, OTHER, axisLabel, splitLine, tooltipBase } from "../theme";
import { fmtPct } from "@/lib/analytics";
import type { Variant } from "@/lib/layout";
import type { ChartProps, DrillRequest, ChartCtx } from "./types";
import type { Demand } from "@/lib/types";

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

/** Como um gráfico de distribuição pode ser redesenhado em outros formatos. */
export interface AltSpec {
  title: string;
  /** Nome da dimensão, para tabela e legenda (ex.: "Cliente"). */
  dimension: string;
  unit?: string;
  data: (rows: Demand[], ctx: ChartCtx) => Slice[];
  drill: (name: string, rows: Demand[], ctx: ChartCtx) => DrillRequest;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Agrupa a cauda em "Outros" para formatos com espaço limitado (rosca e barras verticais). */
function topWithOthers(list: Slice[], n: number): { slices: Slice[]; rest: string[] } {
  if (list.length <= n) return { slices: list, rest: [] };
  const top = list.slice(0, n - 1);
  const others = list.slice(n - 1);
  return { slices: [...top, { name: "Outros", value: others.reduce((a, b) => a + b.value, 0), color: OTHER }], rest: others.map((o) => o.name) };
}

export function AltChart({ rows, ctx, className, spec, variant }: ChartProps & { spec: AltSpec; variant: Variant }) {
  const data = useMemo(() => spec.data(rows, ctx), [rows, ctx, spec]);
  const total = data.reduce((a, b) => a + b.value, 0);
  const unit = spec.unit ?? "demandas";
  const colored = (list: Slice[]) => list.map((s, i) => ({ ...s, color: s.color ?? (s.name === "Outros" ? OTHER : CATEGORICAL[i % CATEGORICAL.length]) }));

  const drill = (name: string, rest: string[] = []) => {
    if (name === "Outros") {
      ctx.drill({ title: "Outros", subtitle: spec.title, rows: rest.flatMap((n) => spec.drill(n, rows, ctx).rows) });
      return;
    }
    ctx.drill(spec.drill(name, rows, ctx));
  };

  const view = useMemo(() => {
    if (variant === "rosca") {
      const { slices, rest } = topWithOthers(data, 7);
      return { kind: "pie" as const, slices: colored(slices), rest };
    }
    if (variant === "barras-v") {
      const { slices, rest } = topWithOthers(data, 12);
      return { kind: "bar-v" as const, slices: colored(slices), rest };
    }
    return { kind: variant, slices: data, rest: [] as string[] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, variant]);

  const option = useMemo(() => {
    const tip = { ...tooltipBase, trigger: "item", formatter: (p: { name: string; value: number }) => `<b>${esc(p.name)}</b><br/>${p.value} ${unit} · ${fmtPct(p.value, total)}` };
    if (view.kind === "pie") {
      return {
        tooltip: tip,
        series: [
          {
            type: "pie",
            radius: ["60%", "84%"],
            padAngle: 1.5,
            itemStyle: { borderRadius: 4, borderColor: C.card, borderWidth: 2 },
            label: { show: false },
            data: view.slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
          },
        ],
      };
    }
    if (view.kind === "bar-v") {
      return {
        grid: { left: 4, right: 4, top: 26, bottom: 4, containLabel: true },
        tooltip: tip,
        xAxis: { type: "category", data: view.slices.map((s) => s.name), axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...axisLabel, color: C.dim, interval: 0, width: 76, overflow: "break", lineHeight: 13 } },
        yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
        series: [
          {
            type: "bar",
            barMaxWidth: 42,
            data: view.slices.map((s) => ({ value: s.value, itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] } })),
            label: { show: true, position: "top", color: C.paper, fontFamily: "Antonio", fontSize: 14 },
          },
        ],
      };
    }
    return {
      grid: { left: 8, right: 70, top: 4, bottom: 4, containLabel: true },
      tooltip: tip,
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", inverse: true, data: view.slices.map((s) => s.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisLabel, color: C.dim, width: 140, overflow: "truncate" } },
      series: [
        {
          type: "bar",
          barWidth: 12,
          data: view.slices.map((s) => ({ value: s.value, itemStyle: { color: s.color ?? C.mark, borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: "right", color: C.mute, fontSize: 11, formatter: (p: { value: number }) => `${p.value}  ·  ${fmtPct(p.value, total)}` },
          emphasis: { itemStyle: { color: C.paper } },
        },
      ],
    };
  }, [view, total, unit]);

  const max = data[0]?.value ?? 1;
  return (
    <ChartCard
      code="alt"
      title={spec.title}
      className={className}
      definition={`Mesma informação do gráfico original, desenhada em outro formato. Cada item mostra a quantidade de ${unit} por ${spec.dimension.toLowerCase()} e a participação no total do recorte.`}
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: [spec.dimension, unit.charAt(0).toUpperCase() + unit.slice(1), "%"], rows: data.map((d) => [d.name, d.value, fmtPct(d.value, total)]) }}
    >
      {(ref) =>
        view.kind === "pie" ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative w-full max-w-[220px] shrink-0">
              <EChart ref={ref} option={option} height={210} ariaLabel={spec.title} onClick={(e) => drill(e.name, view.rest)} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="display text-[34px] text-paper">{total}</span>
                <span className="eyebrow">{unit}</span>
              </div>
            </div>
            <ul className="w-full space-y-1.5">
              {view.slices.map((s) => (
                <li key={s.name}>
                  <button onClick={() => drill(s.name, view.rest)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-white/[0.06]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-paper-dim">{s.name}</span>
                    <span className="tabular-nums text-paper">{s.value}</span>
                    <span className="w-11 text-right tabular-nums text-paper-mute">{fmtPct(s.value, total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : view.kind === "lista" ? (
          <ol className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
            {data.map((d, i) => (
              <li key={d.name}>
                <button onClick={() => drill(d.name)} className="group grid w-full grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/[0.06]">
                  <span className="display text-[15px] text-paper-faint group-hover:text-clf-red">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-paper-dim">{d.name}</span>
                    <span className="mt-1 block h-1 rounded-full bg-white/[0.08]">
                      <span className="block h-1 rounded-full transition-all duration-700" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? "#D5D3CC" }} />
                    </span>
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums text-paper">
                    {d.value} <span className="text-paper-mute">· {fmtPct(d.value, total)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : view.kind === "tabela" ? (
          <div className="max-h-[360px] overflow-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-[#1b1b1e] text-paper-mute">
                <tr>
                  <th className="px-3 py-2 font-medium">{spec.dimension}</th>
                  <th className="px-3 py-2 text-right font-medium">{unit.charAt(0).toUpperCase() + unit.slice(1)}</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.name} onClick={() => drill(d.name)} className="cursor-pointer border-t border-white/[0.08] hover:bg-white/[0.04]">
                    <td className="px-3 py-1.5 text-paper-dim">{d.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-paper">{d.value}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-paper-mute">{fmtPct(d.value, total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : view.kind === "bar-v" ? (
          <EChart ref={ref} option={option} height={300} ariaLabel={spec.title} onClick={(e) => drill(e.name, view.rest)} />
        ) : (
          <div className="max-h-[352px] overflow-y-auto pr-1">
            <EChart ref={ref} option={option} height={Math.max(220, data.length * 24 + 20)} ariaLabel={spec.title} onClick={(e) => drill(e.name)} />
          </div>
        )
      }
    </ChartCard>
  );
}
