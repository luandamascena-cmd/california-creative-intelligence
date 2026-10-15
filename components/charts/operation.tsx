"use client";

import { useMemo, useState } from "react";
import { ChartCard, Segmented } from "../ChartCard";
import { EChart } from "../EChart";
import { C, LATE, STATUS_COLORS, STATUS_ORDER, axisLabel, splitLine, tooltipBase } from "../theme";
import { CAT_LABEL, fmtPct, isLate } from "@/lib/analytics";
import type { Demand, StatusCategory } from "@/lib/types";
import type { ChartProps } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function peopleStats(rows: Demand[]) {
  const m = new Map<string, { demands: number; projects: Set<string>; plan: number; art: number; open: number }>();
  rows.forEach((d) =>
    d.people.forEach((p) => {
      const s = m.get(p) ?? { demands: 0, projects: new Set<string>(), plan: 0, art: 0, open: 0 };
      s.demands++;
      s.projects.add(d.projectKey);
      if (d.planners.includes(p)) s.plan++;
      if (d.artDirectors.includes(p)) s.art++;
      if (d.isOpen) s.open++;
      m.set(p, s);
    }),
  );
  return [...m.entries()].map(([name, s]) => ({ name, ...s, projectCount: s.projects.size }));
}

/* 04 · Demandas e projetos por colaborador */
export function PeopleChart({ rows, ctx, className }: ChartProps) {
  const [sort, setSort] = useState<"demands" | "projectCount">("demands");
  const data = useMemo(
    () => peopleStats(rows).sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name)),
    [rows, sort],
  );
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 36, top: 28, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: "roundRect", textStyle: { color: C.dim, fontSize: 11 } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,251,240,0.04)" } },
        formatter: (ps: { dataIndex: number }[]) => {
          const p = data[ps[0].dataIndex];
          return `<b>${esc(p.name)}</b><br/>${p.demands} demandas · ${p.projectCount} projetos (estimados)<br/>` +
            `<span style="color:${C.mute}">Em planejamento: ${p.plan} · Em direção de arte: ${p.art}<br/>Abertas agora: ${p.open}</span>`;
        },
      },
      xAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => d.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { ...axisLabel, color: C.dim, width: 150, overflow: "truncate" },
      },
      series: [
        { name: "Demandas", type: "bar", barWidth: 8, barGap: "30%", itemStyle: { color: C.mark, borderRadius: [0, 4, 4, 0] }, data: data.map((d) => d.demands), label: { show: true, position: "right", color: C.mute, fontSize: 10.5 } },
        { name: "Projetos", type: "bar", barWidth: 8, itemStyle: { color: "#8C8579", borderRadius: [0, 4, 4, 0] }, data: data.map((d) => d.projectCount) },
      ],
    }),
    [data],
  );
  return (
    <ChartCard
      code="04"
      title="Projetos por colaborador"
      className={className}
      definition="Cada demanda conta uma vez para cada pessoa citada em PLANEJAMENTO ou DIRETOR DE ARTE (se a mesma pessoa está nas duas colunas, conta uma vez). Projetos são distintos por pessoa. Como uma demanda pode ter várias pessoas, a soma das barras é maior que o total de demandas: o total geral nunca é calculado somando colaboradores."
      actions={
        <Segmented
          label="Ordenar por"
          value={sort}
          onChange={setSort}
          options={[
            { value: "demands", label: "Demandas" },
            { value: "projectCount", label: "Projetos" },
          ]}
        />
      }
      empty={!data.length && "Nenhum responsável nas demandas filtradas."}
      table={{ columns: ["Colaborador", "Demandas", "Projetos", "Planejamento", "Direção de arte", "Abertas"], rows: data.map((d) => [d.name, d.demands, d.projectCount, d.plan, d.art, d.open]) }}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={Math.max(240, data.length * 30 + 40)}
          ariaLabel="Demandas e projetos por colaborador"
          onClick={(e) => ctx.drill({ title: e.name, subtitle: "Demandas do colaborador", rows: rows.filter((d) => d.people.includes(e.name)), apply: { person: e.name } })}
        />
      )}
    </ChartCard>
  );
}

/* 11 · Carga aberta por colaborador, por status */
export function WorkloadChart({ rows, ctx, className }: ChartProps) {
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const cats = useMemo(() => STATUS_ORDER.filter((c) => c !== "finalizado" && open.some((d) => d.statusCategory === c)), [open]);
  const people = useMemo(() => {
    const m = new Map<string, { total: number; late: number }>();
    open.forEach((d) =>
      d.people.forEach((p) => {
        const s = m.get(p) ?? { total: 0, late: 0 };
        s.total++;
        if (isLate(d, ctx.today)) s.late++;
        m.set(p, s);
      }),
    );
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).map(([name, s]) => ({ name, ...s }));
  }, [open, ctx.today]);
  const totalOpen = open.length;
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 70, top: 28, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: "roundRect", textStyle: { color: C.dim, fontSize: 11 } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,251,240,0.04)" } },
        formatter: (ps: { dataIndex: number; seriesName: string; value: number; marker: string }[]) => {
          const p = people[ps[0].dataIndex];
          return `<b>${esc(p.name)}</b> · ${p.total} abertas (${fmtPct(p.total, totalOpen)} das abertas)<br/>` +
            ps.filter((x) => x.value).map((x) => `${x.marker}${x.seriesName}: ${x.value}`).join("<br/>") +
            (p.late ? `<br/><span style="color:${LATE}">● ${p.late} com prazo vencido</span>` : "");
        },
      },
      xAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      yAxis: {
        type: "category",
        inverse: true,
        data: people.map((p) => p.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { ...axisLabel, color: C.dim, width: 150, overflow: "truncate" },
      },
      series: cats.map((c, i) => ({
        name: CAT_LABEL[c as StatusCategory],
        type: "bar",
        stack: "s",
        barWidth: 14,
        itemStyle: { color: STATUS_COLORS[c], borderColor: C.card, borderWidth: 1.5, borderRadius: i === cats.length - 1 ? [0, 4, 4, 0] : 0 },
        data: people.map((p) => open.filter((d) => d.statusCategory === c && d.people.includes(p.name)).length),
        label:
          i === cats.length - 1
            ? {
                show: true,
                position: "right",
                formatter: (x: { dataIndex: number }) => {
                  const p = people[x.dataIndex];
                  return p.late ? `{t|${p.total}}  {l|${p.late} venc.}` : `{t|${p.total}}`;
                },
                rich: { t: { color: C.paper, fontSize: 11 }, l: { color: LATE, fontSize: 10.5, fontWeight: 600 } },
              }
            : undefined,
      })),
    }),
    [people, cats, open, totalOpen],
  );
  return (
    <ChartCard
      code="11"
      title="Carga aberta por colaborador"
      className={className}
      definition="Demandas abertas (status diferente de Finalizado) em que a pessoa aparece como planejamento ou direção de arte, empilhadas por status. Mostra concentração da pauta, não capacidade: a planilha não informa horas nem esforço. 'venc.' indica demandas com ENTREGA anterior a hoje."
      empty={!people.length && "Sem demandas abertas com responsável no filtro atual."}
      table={{ columns: ["Colaborador", ...cats.map((c) => CAT_LABEL[c as StatusCategory]), "Vencidas"], rows: people.map((p) => [p.name, ...cats.map((c) => open.filter((d) => d.statusCategory === c && d.people.includes(p.name)).length), p.late]) }}
    >
      {(ref) => (
        <EChart
          ref={ref}
          option={option}
          height={Math.max(220, people.length * 30 + 40)}
          ariaLabel="Demandas abertas por colaborador e status"
          onClick={(e) => ctx.drill({ title: e.name, subtitle: "Demandas abertas do colaborador", rows: open.filter((d) => d.people.includes(e.name)), apply: { person: e.name } })}
        />
      )}
    </ChartCard>
  );
}

/* 09 · Status */
export function StatusChart({ rows, ctx, className }: ChartProps) {
  const total = rows.length;
  const data = useMemo(() => {
    const byStatus = new Map<string, { cat: StatusCategory; n: number }>();
    rows.forEach((d) => {
      const s = byStatus.get(d.status) ?? { cat: d.statusCategory, n: 0 };
      s.n++;
      byStatus.set(d.status, s);
    });
    return [...byStatus.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => STATUS_ORDER.indexOf(a.cat) - STATUS_ORDER.indexOf(b.cat));
  }, [rows]);
  const late = rows.filter((d) => isLate(d, ctx.today)).length;
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 4, top: 30, bottom: 4, containLabel: true },
      tooltip: { ...tooltipBase, trigger: "item", formatter: (p: { name: string; value: number }) => `<b>${esc(p.name)}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}` },
      xAxis: { type: "category", data: data.map((d) => d.name), axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...axisLabel, color: C.dim, interval: 0 } },
      yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      series: [
        {
          type: "bar",
          barMaxWidth: 46,
          data: data.map((d) => ({ value: d.n, itemStyle: { color: STATUS_COLORS[d.cat], borderRadius: [4, 4, 0, 0] } })),
          label: {
            show: true,
            position: "top",
            formatter: (p: { value: number }) => `{v|${p.value}} {p|${fmtPct(p.value, total)}}`,
            rich: { v: { color: C.paper, fontFamily: "Antonio", fontSize: 15 }, p: { color: C.mute, fontSize: 10.5 } },
          },
        },
      ],
    }),
    [data, total],
  );
  return (
    <ChartCard
      code="09"
      title="Status das demandas"
      className={className}
      definition="Distribuição pelos valores da coluna STATUS, com as mesmas cores em toda a dashboard. Abertas = qualquer status diferente de Finalizado. Vencidas = abertas com ENTREGA anterior a hoje."
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Status", "Demandas", "%"], rows: data.map((d) => [d.name, d.n, fmtPct(d.n, total)]) }}
    >
      {(ref) => (
        <>
          <div className="mb-1 flex h-2 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
            {data.map((d) => (
              <div key={d.name} className="h-full transition-all duration-700" style={{ width: `${(d.n / Math.max(total, 1)) * 100}%`, background: STATUS_COLORS[d.cat] }} />
            ))}
          </div>
          <div className="mb-1 flex items-center justify-between text-[11.5px] text-paper-mute">
            <span>{rows.filter((d) => d.isOpen).length} abertas · {rows.filter((d) => !d.isOpen).length} finalizadas</span>
            {late > 0 && <span style={{ color: LATE }}>● {late} vencidas</span>}
          </div>
          <EChart
            ref={ref}
            option={option}
            height={250}
            ariaLabel="Demandas por status"
            onClick={(e) => ctx.drill({ title: e.name, subtitle: "Demandas por status", rows: rows.filter((d) => d.status === e.name), apply: { status: e.name } })}
          />
        </>
      )}
    </ChartCard>
  );
}
