"use client";

import { useMemo, useState } from "react";
import { ChartCard, Segmented } from "../ChartCard";
import { EChart } from "../EChart";
import { C, CATEGORICAL, OTHER, axisLabel, splitLine, tooltipBase, colorMap } from "../theme";
import { countBy, fmtPct, isExternalWork, pct } from "@/lib/analytics";
import type { ChartProps } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/* 01 · Demandas por cliente */
export function ClientsChart({ rows, ctx, className }: ChartProps) {
  const data = useMemo(() => countBy(rows, (d) => d.client), [rows]);
  const total = rows.length;
  const height = Math.max(240, data.length * 24 + 20);
  const option = useMemo(
    () => ({
      grid: { left: 8, right: 70, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: (p: { name: string; value: number }) =>
          `<b>${esc(p.name)}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)} do total`,
      },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabel, color: C.dim, width: 140, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          barWidth: 12,
          data: data.map((d) => ({
            value: d.value,
            itemStyle: { color: ctx.filters.client === d.name ? C.red : C.mark, borderRadius: [0, 4, 4, 0] },
          })),
          label: {
            show: true,
            position: "right",
            color: C.mute,
            fontSize: 11,
            formatter: (p: { value: number }) => `${p.value}  ·  ${fmtPct(p.value, total)}`,
          },
          emphasis: { itemStyle: { color: C.paper } },
        },
      ],
    }),
    [data, total, ctx.filters.client],
  );
  return (
    <ChartCard
      code="01"
      title="Demandas por Clientes"
      className={className}
      definition="Quantidade de demandas (linhas da pauta) por valor da coluna CLIENTE, do maior para o menor, com a participação no total filtrado. Clientes internos (ex.: Originals, Content House) aparecem como estão na planilha."
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Cliente", "Demandas", "%"], rows: data.map((d) => [d.name, d.value, fmtPct(d.value, total)]) }}
    >
      {(ref) => (
        <div className="max-h-[352px] overflow-y-auto pr-1">
          <EChart
            ref={ref}
            option={option}
            height={height}
            ariaLabel={`Ranking de ${data.length} clientes por número de demandas`}
            onClick={(e) =>
              ctx.drill({ title: e.name, subtitle: "Demandas do cliente", rows: rows.filter((d) => d.client === e.name), apply: { client: e.name } })
            }
          />
        </div>
      )}
    </ChartCard>
  );
}

/* 02 · Demandas por Business Unit (ou por time executor) */
export function BuChart({ rows, ctx, className }: ChartProps) {
  const [mode, setMode] = useState<"bu" | "team">("bu");
  const data = useMemo(() => {
    const list = countBy(rows, (d) => (mode === "bu" ? d.bu : d.team));
    if (mode === "bu") list.sort((a, b) => b.value - a.value);
    return list;
  }, [rows, mode]);
  const total = rows.length;
  const teamColors = useMemo(() => colorMap(["Content House", "California"]), []);
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 4, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: (p: { name: string; value: number }) => `<b>${esc(p.name)}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}`,
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.name),
        axisLine: { lineStyle: { color: C.line } },
        axisTick: { show: false },
        axisLabel: { ...axisLabel, color: C.dim, interval: 0, width: 80, overflow: "break", lineHeight: 14 },
      },
      yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      series: [
        {
          type: "bar",
          barMaxWidth: 44,
          data: data.map((d) => ({
            value: d.value,
            itemStyle: {
              color: (mode === "bu" ? ctx.buColors : teamColors)[d.name] ?? OTHER,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          label: {
            show: true,
            position: "top",
            color: C.paper,
            fontFamily: "Antonio",
            fontSize: 15,
            formatter: (p: { value: number }) => `{v|${p.value}} {p|${fmtPct(p.value, total)}}`,
            rich: { v: { color: C.paper, fontFamily: "Antonio", fontSize: 15 }, p: { color: C.mute, fontSize: 10.5 } },
          },
        },
      ],
    }),
    [data, total, mode, ctx.buColors, teamColors],
  );
  return (
    <ChartCard
      code="02"
      title={mode === "bu" ? "Demandas por Business Unit" : "Demandas por Times"}
      className={className}
      definition="A Business Unit da demanda vem da coluna BUSINESS UNIT; o time é o time executor, lido do nome da guia (ex.: São Paulo · Content House). Um time pode atender demandas de várias Business Units. Na Visão Geral, a mesma Business Unit soma todas as regionais."
      actions={
        <Segmented
          label="Agrupar por"
          value={mode}
          onChange={setMode}
          options={[
            { value: "bu", label: "Business Unit" },
            { value: "team", label: "Time" },
          ]}
        />
      }
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: [mode === "bu" ? "Business Unit" : "Time", "Demandas", "%"], rows: data.map((d) => [d.name, d.value, fmtPct(d.value, total)]) }}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={300}
          ariaLabel="Demandas por unidade de negócio"
          onClick={(e) =>
            ctx.drill({
              title: e.name,
              subtitle: mode === "bu" ? "Demandas da Business Unit" : "Demandas do time",
              rows: rows.filter((d) => (mode === "bu" ? d.bu : d.team) === e.name),
              apply: mode === "bu" ? { bu: e.name } : { team: e.name },
            })
          }
        />
      )}
    </ChartCard>
  );
}

/* 03 · Formatos */
export function FormatsChart({ rows, ctx, className }: ChartProps) {
  const total = rows.length;
  const { slices, rest } = useMemo(() => {
    const all = countBy(rows, (d) => d.format);
    const top = all.slice(0, CATEGORICAL.length);
    const others = all.slice(CATEGORICAL.length);
    const s = top.map((d, i) => ({ ...d, color: CATEGORICAL[i] }));
    if (others.length) s.push({ name: "Outros", value: others.reduce((a, b) => a + b.value, 0), color: OTHER });
    return { slices: s, rest: others.map((o) => o.name) };
  }, [rows]);
  const option = useMemo(
    () => ({
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: (p: { name: string; value: number }) =>
          `<b>${esc(p.name)}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}` +
          (p.name === "Outros" ? `<br/><span style="color:${C.mute}">${rest.map(esc).join(", ")}</span>` : ""),
      },
      series: [
        {
          type: "pie",
          radius: ["60%", "84%"],
          center: ["50%", "50%"],
          padAngle: 1.5,
          itemStyle: { borderRadius: 4, borderColor: C.card, borderWidth: 2 },
          label: { show: false },
          data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
          animationType: "scale",
        },
      ],
    }),
    [slices, total, rest],
  );
  const drill = (name: string) =>
    ctx.drill({
      title: name,
      subtitle: "Demandas por formato",
      rows: rows.filter((d) => (name === "Outros" ? rest.includes(d.format) : d.format === name)),
      apply: name === "Outros" ? undefined : { format: name },
    });
  return (
    <ChartCard
      code="03"
      title="Formatos das Demandas"
      className={className}
      definition="Distribuição das demandas pela coluna FORMATO. Os seis formatos mais frequentes têm cor própria; os demais são agrupados em Outros (passe o cursor para ver quais)."
      empty={!slices.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Formato", "Demandas", "%"], rows: countBy(rows, (d) => d.format).map((d) => [d.name, d.value, fmtPct(d.value, total)]) }}
    >
      {(ref) => (
        <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col">
          <div className="relative w-full max-w-[220px] shrink-0">
            <EChart ref={ref} option={option} height={200} ariaLabel="Distribuição das demandas por formato" onClick={(e) => drill(e.name)} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="display text-[34px] text-paper">{total}</span>
              <span className="eyebrow">demandas</span>
            </div>
          </div>
          <ul className="w-full space-y-1.5">
            {slices.map((s) => (
              <li key={s.name}>
                <button onClick={() => drill(s.name)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-white/[0.06]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-paper-dim">{s.name}</span>
                  <span className="tabular-nums text-paper">{s.value}</span>
                  <span className="w-11 text-right tabular-nums text-paper-mute">{fmtPct(s.value, total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

/* 10 · Top 10 clientes, com concentração acumulada */
export function TopClients({ rows, ctx, className }: ChartProps) {
  const total = rows.length;
  const top = useMemo(() => countBy(rows, (d) => d.client).slice(0, 10), [rows]);
  const max = top[0]?.value ?? 1;
  let acc = 0;
  const top3 = top.slice(0, 3).reduce((a, b) => a + b.value, 0);
  return (
    <ChartCard
      code="10"
      title="Top 10 Clientes"
      className={className}
      definition="Os dez clientes com mais demandas no filtro. A coluna Acum. mostra a participação somada até aquela posição, uma leitura direta de concentração da pauta."
      empty={!top.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["#", "Cliente", "Demandas", "%"], rows: top.map((d, i) => [i + 1, d.name, d.value, fmtPct(d.value, total)]) }}
    >
      {() => (
        <div>
          <p className="mb-3 text-[12.5px] text-paper-mute">
            Os 3 primeiros concentram <span className="font-semibold text-paper">{fmtPct(top3, total)}</span> das demandas.
          </p>
          <ol className="space-y-1">
            {top.map((d, i) => {
              acc += d.value;
              return (
                <li key={d.name}>
                  <button
                    onClick={() => ctx.drill({ title: d.name, subtitle: "Demandas do cliente", rows: rows.filter((r) => r.client === d.name), apply: { client: d.name } })}
                    className="group grid w-full grid-cols-[22px_1fr_auto_44px] items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/[0.06]"
                  >
                    <span className="display text-[15px] text-paper-faint group-hover:text-clf-red">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] text-paper-dim">{d.name}</span>
                      <span className="mt-1 block h-1 rounded-full bg-white/[0.08]">
                        <span className="block h-1 rounded-full bg-paper-dim transition-all duration-700" style={{ width: `${(d.value / max) * 100}%` }} />
                      </span>
                    </span>
                    <span className="text-right text-[12.5px] tabular-nums text-paper">
                      {d.value} <span className="text-paper-mute">· {fmtPct(d.value, total)}</span>
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-paper-faint" title="Participação acumulada">
                      {Math.round(pct(acc, total))}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-2 flex justify-end text-[10.5px] uppercase tracking-wide2 text-paper-faint">Acum.</div>
        </div>
      )}
    </ChartCard>
  );
}

/* 13 · Natureza do trabalho por BU (tipo de projeto) */
export function NatureChart({ rows, ctx, className }: ChartProps) {
  const types = useMemo(() => countBy(rows, (d) => d.projectType).map((t) => t.name), [rows]);
  const typeOrder = ["Cliente", "Prospecção", "Concorrência", "Proprietário", "Institucional"];
  const ordered = [...typeOrder.filter((t) => types.includes(t)), ...types.filter((t) => !typeOrder.includes(t))];
  const typeColors = colorMap(ordered);
  const bus = useMemo(() => countBy(rows, (d) => d.bu).map((b) => b.name), [rows]);
  const external = rows.filter(isExternalWork).length;
  const newBiz = rows.filter((d) => /prospec|concorr/i.test(d.projectType)).length;
  const option = useMemo(() => {
    const totals = Object.fromEntries(bus.map((b) => [b, rows.filter((d) => d.bu === b).length]));
    return {
      grid: { left: 4, right: 12, top: 30, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: "roundRect", textStyle: { color: C.dim, fontSize: 11 } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,251,240,0.04)" } },
        formatter: (ps: { seriesName: string; value: number; axisValue: string; marker: string }[]) => {
          const b = ps[0]?.axisValue;
          const raw = (s: string) => rows.filter((d) => d.bu === b && d.projectType === s).length;
          return `<b>${esc(b)}</b> · ${totals[b]} demandas<br/>` + ps.filter((p) => p.value > 0).map((p) => `${p.marker}${esc(p.seriesName)}: ${raw(p.seriesName)} (${p.value.toFixed(0)}%)`).join("<br/>");
        },
      },
      xAxis: { type: "value", max: 100, axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
      yAxis: { type: "category", inverse: true, data: bus, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...axisLabel, color: C.dim } },
      series: ordered.map((t) => ({
        name: t,
        type: "bar",
        stack: "t",
        barWidth: 14,
        itemStyle: { color: typeColors[t], borderColor: C.card, borderWidth: 1 },
        data: bus.map((b) => pct(rows.filter((d) => d.bu === b && d.projectType === t).length, totals[b] || 1)),
      })),
    };
  }, [rows, bus, ordered, typeColors]);
  return (
    <ChartCard
      code="13"
      title="Natureza do Trabalho por Business Unit"
      className={className}
      definition="Composição de cada Business Unit pela coluna TIPO DE PROJETO, em % das demandas da Business Unit. Cliente, Prospecção e Concorrência são trabalho voltado ao mercado; Proprietário e Institucional são projetos da casa."
      empty={!rows.length && "Nenhuma demanda no filtro atual."}
      table={{
        columns: ["Business Unit", ...ordered],
        rows: bus.map((b) => [b, ...ordered.map((t) => rows.filter((d) => d.bu === b && d.projectType === t).length)]),
      }}
    >
      {(ref) => (
        <>
          <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-paper-mute">
            <span>
              Mercado (cliente, prospecção, concorrência): <b className="text-paper">{fmtPct(external, rows.length)}</b>
            </span>
            <span>
              Novos negócios (prospecção + concorrência): <b className="text-paper">{fmtPct(newBiz, rows.length)}</b>
            </span>
          </div>
          <EChart
            ref={ref}
            option={option}
            height={Math.max(200, bus.length * 34 + 50)}
            ariaLabel="Composição de cada Business Unit por tipo de projeto"
            onClick={(e) =>
              ctx.drill({
                title: `${e.name} · ${e.seriesName}`,
                subtitle: "Demandas por natureza",
                rows: rows.filter((d) => d.bu === e.name && d.projectType === e.seriesName),
                apply: { bu: e.name, projectType: e.seriesName },
              })
            }
          />
        </>
      )}
    </ChartCard>
  );
}

/* 14 · Formatos mais frequentes por BU */
export function FormatsByBu({ rows, ctx, className }: ChartProps) {
  const groups = useMemo(() => {
    const bus = countBy(rows, (d) => d.bu);
    return bus.map((b) => ({ bu: b.name, total: b.value, formats: countBy(rows.filter((d) => d.bu === b.name), (d) => d.format).slice(0, 3) }));
  }, [rows]);
  return (
    <ChartCard
      code="14"
      title="Formatos por Business Unit"
      className={className}
      definition="Os três formatos mais pedidos em cada Business Unit, com a quantidade de demandas. Ajuda a dimensionar especialidades por unidade de negócio."
      empty={!groups.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Business Unit", "Formato", "Demandas"], rows: groups.flatMap((g) => g.formats.map((f) => [g.bu, f.name, f.value])) }}
    >
      {() => (
        <ul className="divide-y divide-white/[0.08]">
          {groups.map((g) => (
            <li key={g.bu} className="py-2 first:pt-0">
              <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                <span className="h-2 w-2 rounded-sm" style={{ background: ctx.buColors[g.bu] ?? OTHER }} />
                <span className="font-medium text-paper">{g.bu}</span>
                <span className="text-paper-faint">{g.total}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.formats.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => ctx.drill({ title: `${g.bu} · ${f.name}`, rows: rows.filter((d) => d.bu === g.bu && d.format === f.name), apply: { bu: g.bu, format: f.name } })}
                    className="chip hover:border-white/25 hover:text-paper"
                  >
                    {f.name} <b className="tabular-nums text-paper">{f.value}</b>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

/* 15 · Prioridade */
export function PriorityChart({ rows, ctx, className }: ChartProps) {
  const order = ["Alta", "Média", "Baixa"];
  const names = useMemo(() => {
    const present = countBy(rows, (d) => d.priority).map((p) => p.name);
    return [...order.filter((o) => present.includes(o)), ...present.filter((p) => !order.includes(p))];
  }, [rows]);
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 30, top: 28, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: "roundRect", textStyle: { color: C.dim, fontSize: 11 } },
      tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,251,240,0.04)" } } },
      xAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      yAxis: { type: "category", inverse: true, data: names, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...axisLabel, color: C.dim } },
      series: [
        { name: "Abertas", type: "bar", stack: "p", barWidth: 14, itemStyle: { color: C.mark, borderColor: C.card, borderWidth: 1 }, data: names.map((n) => rows.filter((d) => d.priority === n && d.isOpen).length) },
        { name: "Finalizadas", type: "bar", stack: "p", barWidth: 14, itemStyle: { color: C.markSoft, borderColor: C.card, borderWidth: 1, borderRadius: [0, 4, 4, 0] }, data: names.map((n) => rows.filter((d) => d.priority === n && !d.isOpen).length) },
      ],
    }),
    [rows, names],
  );
  return (
    <ChartCard
      code="15"
      title="Demandas por Prioridade"
      className={className}
      definition="Demandas por PRIORIDADE, separando abertas (qualquer status diferente de Finalizado) e finalizadas."
      empty={!rows.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Prioridade", "Abertas", "Finalizadas"], rows: names.map((n) => [n, rows.filter((d) => d.priority === n && d.isOpen).length, rows.filter((d) => d.priority === n && !d.isOpen).length]) }}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={Math.max(170, names.length * 36 + 50)}
          ariaLabel="Demandas por prioridade, abertas e finalizadas"
          onClick={(e) =>
            ctx.drill({
              title: `Prioridade ${e.name} · ${e.seriesName}`,
              rows: rows.filter((d) => d.priority === e.name && (e.seriesName === "Abertas" ? d.isOpen : !d.isOpen)),
              apply: { priority: e.name },
            })
          }
        />
      )}
    </ChartCard>
  );
}
