"use client";

import { useMemo } from "react";
import { ChartCard } from "../ChartCard";
import { EChart } from "../EChart";
import { C, OTHER, SEQUENTIAL, axisLabel, splitLine, tooltipBase } from "../theme";
import { fmtPct } from "@/lib/analytics";
import type { ChartProps } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/* 05 · Projetos por BU */
export function ProjectsByBu({ rows, ctx, className }: ChartProps) {
  const data = useMemo(() => {
    const m = new Map<string, { projects: Set<string>; demands: number }>();
    rows.forEach((d) => {
      const s = m.get(d.bu) ?? { projects: new Set<string>(), demands: 0 };
      s.projects.add(d.projectKey);
      s.demands++;
      m.set(d.bu, s);
    });
    return [...m.entries()].map(([name, s]) => ({ name, projects: s.projects.size, demands: s.demands })).sort((a, b) => b.projects - a.projects);
  }, [rows]);
  const totalProjects = new Set(rows.map((d) => d.projectKey)).size;
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 4, top: 26, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const d = data[p.dataIndex];
          return `<b>${esc(d.name)}</b><br/>${d.projects} projetos (estimados) · ${fmtPct(d.projects, totalProjects)}<br/><span style="color:${C.mute}">${d.demands} demandas · ${(d.demands / d.projects).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} demandas por projeto</span>`;
        },
      },
      xAxis: { type: "category", data: data.map((d) => d.name), axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...axisLabel, color: C.dim, interval: 0, width: 72, overflow: "break", lineHeight: 13 } },
      yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      series: [
        {
          type: "bar",
          barMaxWidth: 40,
          data: data.map((d) => ({ value: d.projects, itemStyle: { color: ctx.buColors[d.name] ?? OTHER, borderRadius: [4, 4, 0, 0] } })),
          label: { show: true, position: "top", color: C.paper, fontFamily: "Antonio", fontSize: 15 },
        },
      ],
    }),
    [data, totalProjects, ctx.buColors],
  );
  return (
    <ChartCard
      code="05"
      title="Projetos por BU"
      className={className}
      definition={
        ctx.capabilities.hasProjectColumn
          ? "Projetos distintos (coluna PROJETO) associados a cada BU."
          : "Estimativa: sem coluna PROJETO, tarefas do mesmo cliente com o mesmo nome, ignorando versões (V2, V3) e idioma (ENG, Inglês), contam como um projeto. Passe o cursor para ver demandas por projeto."
      }
      actions={!ctx.capabilities.hasProjectColumn ? <span className="mr-1 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper-mute">Estimativa</span> : null}
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["BU", "Projetos", "Demandas"], rows: data.map((d) => [d.name, d.projects, d.demands]) }}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={260}
          ariaLabel="Projetos estimados por unidade de negócio"
          onClick={(e) => ctx.drill({ title: e.name, subtitle: "Demandas da BU", rows: rows.filter((d) => d.bu === e.name), apply: { bu: e.name } })}
        />
      )}
    </ChartCard>
  );
}

/* 06 · Projetos por regional (compara todas, independente da regional aberta) */
export function RegionalChart({ rows, ctx, className }: ChartProps) {
  const regionals = useMemo(() => [...new Set(ctx.tabs.map((t) => t.regional))], [ctx.tabs]);
  const data = useMemo(
    () =>
      regionals.map((r) => {
        const list = rows.filter((d) => d.regional === r);
        return { name: r, projects: new Set(list.map((d) => d.projectKey)).size, demands: list.length, teams: ctx.tabs.filter((t) => t.regional === r).length };
      }),
    [rows, regionals, ctx.tabs],
  );
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 4, top: 26, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const d = data[p.dataIndex];
          return `<b>${d.name}</b> · ${d.teams} ${d.teams === 1 ? "time" : "times"}<br/>${d.projects} projetos · ${d.demands} demandas<br/><span style="color:${C.mute}">Clique para abrir a regional</span>`;
        },
      },
      xAxis: { type: "category", data: data.map((d) => d.name), axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { color: C.dim, fontFamily: "Antonio", fontSize: 15 } },
      yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      series: [
        {
          type: "bar",
          barMaxWidth: 46,
          data: data.map((d) => ({
            value: d.projects,
            itemStyle: { color: ctx.filters.regional === d.name ? C.red : C.mark, borderRadius: [4, 4, 0, 0] },
          })),
          label: {
            show: true,
            position: "top",
            formatter: (p: { dataIndex: number; value: number }) => (data[p.dataIndex].demands ? `${p.value}` : "sem dados"),
            color: C.paper,
            fontFamily: "Antonio",
            fontSize: 15,
          },
          showBackground: true,
          backgroundStyle: { color: "rgba(255,251,240,0.025)", borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [data, ctx.filters.regional],
  );
  return (
    <ChartCard
      code="06"
      title="Projetos por regional"
      className={className}
      definition="Projetos (estimados) por regional, lida do nome da guia. Compara todas as regionais com os filtros de cliente, BU, colaborador etc. aplicados; a regional aberta fica em vermelho. Clique em uma barra para abrir a regional."
      table={{ columns: ["Regional", "Projetos", "Demandas", "Times"], rows: data.map((d) => [d.name, d.projects, d.demands, d.teams]) }}
    >
      {(ref) => (
        <EChart ref={ref} option={option} height={260} ariaLabel="Projetos por regional" onClick={(e) => ctx.navigate(e.name, null)} />
      )}
    </ChartCard>
  );
}

/* 07 · Matriz time (regional | time) × BU da demanda */
export function HeatmapChart({ rows, ctx, className }: ChartProps) {
  const tabs = ctx.tabs.map((t) => t.title);
  const bus = useMemo(() => {
    const present = new Set(rows.map((d) => d.bu));
    return [...ctx.buOrder.filter((b) => present.has(b)), ...[...present].filter((b) => !ctx.buOrder.includes(b))];
  }, [rows, ctx.buOrder]);
  const { cells, max } = useMemo(() => {
    const out: [number, number, number][] = [];
    let mx = 1;
    tabs.forEach((t, y) =>
      bus.forEach((b, x) => {
        const v = rows.filter((d) => d.sourceTab === t && d.bu === b).length;
        mx = Math.max(mx, v);
        out.push([x, y, v]);
      }),
    );
    return { cells: out, max: mx };
  }, [rows, tabs, bus]);
  const tabTotals = tabs.map((t) => rows.filter((d) => d.sourceTab === t).length);
  const active = (t: string) => {
    const info = ctx.tabs.find((x) => x.title === t)!;
    return (!ctx.filters.regional || ctx.filters.regional === info.regional) && (!ctx.filters.team || ctx.filters.team === info.team);
  };
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 40, top: 8, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase,
        formatter: (p: { value: [number, number, number] }) => {
          const [x, y, v] = p.value;
          return `<b>${esc(tabs[y])}</b> × <b>${esc(bus[x])}</b><br/>${v} demandas`;
        },
      },
      visualMap: { show: false, min: 0, max, inRange: { color: SEQUENTIAL } },
      xAxis: { type: "category", data: bus, position: "top", axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...axisLabel, color: C.dim, interval: 0, width: 70, overflow: "break", lineHeight: 13 } },
      yAxis: {
        type: "category",
        data: tabs,
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          formatter: (v: string, i: number) => `{${active(v) ? "a" : "d"}|${v}}  {n|${tabTotals[i]}}`,
          rich: { a: { color: C.paper, fontSize: 11.5 }, d: { color: C.faint, fontSize: 11.5 }, n: { color: C.mute, fontSize: 10.5 } },
        },
      },
      series: [
        {
          type: "heatmap",
          data: cells,
          itemStyle: { borderColor: C.card, borderWidth: 3, borderRadius: 4 },
          label: { show: true, color: C.paper, fontSize: 11, formatter: (p: { value: [number, number, number] }) => (p.value[2] ? String(p.value[2]) : "") },
          emphasis: { itemStyle: { borderColor: C.paper, borderWidth: 1 } },
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, max, tabs, bus, tabTotals.join(","), ctx.filters.regional, ctx.filters.team],
  );
  return (
    <ChartCard
      code="07"
      title="Time × Business Unit"
      className={className}
      definition="Cruza cada guia (regional | time executor) com a BU da demanda. A intensidade da cor indica o volume de demandas. Todos os times existentes na planilha aparecem, inclusive os que ainda não têm registros; os que estão fora do contexto aberto ficam esmaecidos."
      table={{ columns: ["Time", ...bus], rows: tabs.map((t) => [t, ...bus.map((b) => rows.filter((d) => d.sourceTab === t && d.bu === b).length)]) }}
      empty={!bus.length && "Nenhuma demanda no filtro atual."}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={Math.max(220, tabs.length * 40 + 60)}
          ariaLabel="Matriz de demandas por time e unidade de negócio"
          onClick={(e) => {
            const [x, y] = e.value as [number, number, number];
            const tab = ctx.tabs.find((t) => t.title === tabs[y])!;
            ctx.drill({
              title: `${tabs[y]} × ${bus[x]}`,
              rows: rows.filter((d) => d.sourceTab === tabs[y] && d.bu === bus[x]),
              apply: { regional: tab.regional, team: tab.team, bu: bus[x] },
            });
          }}
        />
      )}
    </ChartCard>
  );
}
