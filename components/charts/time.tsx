"use client";

import { useMemo, useState } from "react";
import { ChartCard, Segmented } from "../ChartCard";
import { EChart } from "../EChart";
import { C, LATE, SEQUENTIAL, STATUS_COLORS, axisLabel, splitLine, tooltipBase } from "../theme";
import { isDueSoon, isLate } from "@/lib/analytics";
import { addDaysISO, diffDays, formatDateBR, monthLabel, weekStartISO } from "@/lib/text";
import type { Demand } from "@/lib/types";
import type { ChartProps } from "./types";

type Gran = "week" | "month";
const bucketOf = (iso: string, g: Gran) => (g === "week" ? weekStartISO(iso) : iso.slice(0, 7));
const nextBucket = (b: string, g: Gran) => {
  if (g === "week") return addDaysISO(b, 7);
  const [y, m] = b.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const bucketLabel = (b: string, g: Gran) => (g === "week" ? formatDateBR(b).slice(0, 5) : monthLabel(b));

/* 08 · Evolução no tempo */
export function TimelineChart({ rows, ctx, className }: ChartProps) {
  const [gran, setGran] = useState<Gran>("week");
  const dated = useMemo(() => rows.filter((d) => d.start || d.due), [rows]);
  const { buckets, intake, due } = useMemo(() => {
    const dates = dated.flatMap((d) => [d.start, d.due].filter(Boolean) as string[]);
    if (!dates.length) return { buckets: [] as string[], intake: [] as number[], due: [] as number[] };
    const min = bucketOf(dates.reduce((a, b) => (a < b ? a : b)), gran);
    const max = bucketOf(dates.reduce((a, b) => (a > b ? a : b)), gran);
    const list: string[] = [];
    for (let b = min; b <= max && list.length < 200; b = nextBucket(b, gran)) list.push(b);
    return {
      buckets: list,
      intake: list.map((b) => dated.filter((d) => d.start && bucketOf(d.start, gran) === b).length),
      due: list.map((b) => dated.filter((d) => d.due && bucketOf(d.due, gran) === b).length),
    };
  }, [dated, gran]);
  const todayIdx = buckets.indexOf(bucketOf(ctx.today, gran));
  const option = useMemo(
    () => ({
      grid: { left: 4, right: 12, top: 34, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 3, textStyle: { color: C.dim, fontSize: 11 } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: C.faint } },
        formatter: (ps: { dataIndex: number; seriesName: string; value: number; marker: string }[]) => {
          const b = buckets[ps[0].dataIndex];
          const head = gran === "week" ? `Semana de ${formatDateBR(b)}` : monthLabel(b);
          return `<b>${head}</b><br/>` + ps.map((p) => `${p.marker}${p.seriesName}: ${p.value}`).join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: buckets.map((b) => bucketLabel(b, gran)),
        axisLine: { lineStyle: { color: C.line } },
        axisTick: { show: false },
        axisLabel,
      },
      yAxis: { type: "value", splitLine, axisLabel, minInterval: 1 },
      series: [
        {
          name: "Entradas (data de início)",
          type: "line",
          smooth: 0.25,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 2, color: C.paper },
          itemStyle: { color: C.paper, borderColor: C.card, borderWidth: 2 },
          areaStyle: {
            color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(255,251,240,0.22)" }, { offset: 1, color: "rgba(255,251,240,0)" }] },
          },
          data: intake,
          markLine:
            todayIdx >= 0
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: C.red, type: "dashed", width: 1 },
                  label: { formatter: "hoje", color: C.red, fontSize: 10, position: "insideEndTop" },
                  data: [{ xAxis: todayIdx }],
                }
              : undefined,
        },
        {
          name: "Entregas previstas (data de entrega)",
          type: "line",
          smooth: 0.25,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 2, color: STATUS_COLORS.pauta, type: "dashed" },
          itemStyle: { color: STATUS_COLORS.pauta, borderColor: C.card, borderWidth: 2 },
          data: due,
        },
      ],
    }),
    [buckets, intake, due, gran, todayIdx],
  );
  const undated = rows.length - dated.length;
  return (
    <ChartCard
      code="08"
      title="Evolução das Demandas"
      className={className}
      definition="Entradas: demandas agrupadas pela data de INÍCIO. Entregas previstas: agrupadas pela data de ENTREGA (prazo planejado, não a data em que foi entregue, que a planilha não registra). Demandas sem data ficam fora deste gráfico."
      actions={
        <Segmented
          label="Agrupamento"
          value={gran}
          onChange={setGran}
          options={[
            { value: "week", label: "Semana" },
            { value: "month", label: "Mês" },
          ]}
        />
      }
      empty={!buckets.length && "As demandas filtradas não têm datas de início ou entrega."}
      table={{ columns: [gran === "week" ? "Semana" : "Mês", "Entradas", "Entregas previstas"], rows: buckets.map((b, i) => [bucketLabel(b, gran), intake[i], due[i]]) }}
    >
      {(ref) => (
        <>
          <EChart
            ref={ref}
            option={option}
            height={280}
            ariaLabel="Evolução das entradas e entregas previstas no tempo"
            onClick={(e) => {
              const b = buckets[e.dataIndex];
              const byDue = (e.seriesName ?? "").startsWith("Entregas");
              ctx.drill({
                title: `${byDue ? "Entregas previstas" : "Entradas"} · ${gran === "week" ? "semana de " + formatDateBR(b) : monthLabel(b)}`,
                rows: rows.filter((d) => {
                  const v = byDue ? d.due : d.start;
                  return v && bucketOf(v, gran) === b;
                }),
              });
            }}
          />
          {undated > 0 && <p className="mt-2 text-[11.5px] text-paper-faint">{undated} demandas sem datas não aparecem na linha do tempo.</p>}
        </>
      )}
    </ChartCard>
  );
}

/* 12 · Prazos e atrasos */
export function DeadlinesPanel({ rows, ctx, className }: ChartProps) {
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const late = useMemo(() => open.filter((d) => isLate(d, ctx.today)).sort((a, b) => a.due!.localeCompare(b.due!)), [open, ctx.today]);
  const soon = useMemo(() => open.filter((d) => isDueSoon(d, ctx.today)).sort((a, b) => a.due!.localeCompare(b.due!)), [open, ctx.today]);
  const later = open.filter((d) => d.due && d.due > addDaysISO(ctx.today, 7)).length;
  const noDue = open.filter((d) => !d.due).length;

  const { range, data, max } = useMemo(() => {
    const dues = open.filter((d) => d.due).map((d) => d.due!);
    const earliest = dues.length ? dues.reduce((a, b) => (a < b ? a : b)) : ctx.today;
    const latest = dues.length ? dues.reduce((a, b) => (a > b ? a : b)) : ctx.today;
    let start = earliest < addDaysISO(ctx.today, -21) ? earliest : addDaysISO(ctx.today, -21);
    if (start < addDaysISO(ctx.today, -84)) start = addDaysISO(ctx.today, -84);
    let end = latest > addDaysISO(ctx.today, 35) ? latest : addDaysISO(ctx.today, 35);
    if (diffDays(start, end) > 180) end = addDaysISO(start, 180);
    const m = new Map<string, number>();
    dues.forEach((d) => m.set(d, (m.get(d) ?? 0) + 1));
    return { range: [start, end], data: [...m.entries()], max: Math.max(1, ...m.values()) };
  }, [open, ctx.today]);

  const option = useMemo(
    () => ({
      tooltip: {
        ...tooltipBase,
        formatter: (p: { value: [string, number] }) => {
          const [day, n] = p.value;
          const items = open.filter((d) => d.due === day).slice(0, 6).map((d) => `· ${d.task.replace(/</g, "&lt;")}`).join("<br/>");
          const tag = day < ctx.today ? ` <span style="color:${LATE}">vencido</span>` : day === ctx.today ? " · hoje" : "";
          return `<b>${formatDateBR(day)}</b>${tag}<br/>${n} ${n === 1 ? "entrega prevista" : "entregas previstas"}<br/><span style="color:${C.mute}">${items}</span>`;
        },
      },
      visualMap: { show: false, min: 0, max, inRange: { color: SEQUENTIAL.slice(1) } },
      calendar: {
        top: 24,
        left: 34,
        right: 8,
        bottom: 4,
        range,
        cellSize: ["auto", 16],
        orient: "horizontal",
        splitLine: { show: false },
        itemStyle: { color: C.surface2, borderColor: C.card, borderWidth: 3 },
        dayLabel: { firstDay: 1, nameMap: ["D", "S", "T", "Q", "Q", "S", "S"], color: C.faint, fontSize: 10 },
        monthLabel: { nameMap: ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"], color: C.mute, fontSize: 10, fontFamily: "Antonio" },
        yearLabel: { show: false },
      },
      series: [
        { type: "heatmap", coordinateSystem: "calendar", data },
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          silent: true,
          data: [[ctx.today, 0]],
          itemStyle: { color: "transparent", borderColor: C.paper, borderWidth: 1.5 },
        },
      ],
    }),
    [range, data, max, open, ctx.today],
  );

  const Item = ({ d, tone }: { d: Demand; tone: "late" | "soon" }) => {
    const days = diffDays(ctx.today, d.due!);
    return (
      <li>
        <button
          onClick={() => ctx.drill({ title: d.task, subtitle: d.client, rows: [d] })}
          className="grid w-full grid-cols-[1fr_auto] gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.06]"
        >
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] text-paper">{d.task}</span>
            <span className="block truncate text-[11px] text-paper-mute">
              {d.client} · {d.people.slice(0, 2).join(", ") || "sem responsável"}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-[12px] tabular-nums text-paper-dim">{formatDateBR(d.due)}</span>
            <span className="block text-[11px] font-medium" style={{ color: tone === "late" ? LATE : C.mute }}>
              {tone === "late" ? `há ${-days} ${-days === 1 ? "dia" : "dias"}` : days === 0 ? "hoje" : `em ${days} ${days === 1 ? "dia" : "dias"}`}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <ChartCard
      code="12"
      title="Prazos e Atrasos"
      className={className}
      definition="Considera apenas demandas abertas. Vencidas: ENTREGA anterior a hoje. Próximos 7 dias: ENTREGA entre hoje e daqui a 7 dias. O calendário mostra quantas entregas abertas estão previstas por dia (contorno claro = hoje). Entregas no prazo e tempo médio de execução não são calculáveis porque a planilha não registra a data em que cada demanda foi concluída."
      empty={!open.length && "Nenhuma demanda aberta no filtro atual."}
      table={{ columns: ["Tarefa", "Cliente", "Entrega", "Situação"], rows: [...late, ...soon].map((d) => [d.task, d.client, formatDateBR(d.due), isLate(d, ctx.today) ? "Vencida" : "Próximos 7 dias"]) }}
    >
      {(ref) => (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="min-w-0">
            <div className="mb-2 grid grid-cols-4 gap-2">
              {[
                { label: "Vencidas", value: late.length, color: LATE },
                { label: "Próx. 7 dias", value: soon.length, color: C.paper },
                { label: "Depois", value: later, color: C.dim },
                { label: "Sem prazo", value: noDue, color: C.mute },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white/[0.06] px-2.5 py-2">
                  <div className="display text-[24px]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="text-[10.5px] uppercase tracking-wide text-paper-mute">{s.label}</div>
                </div>
              ))}
            </div>
            <EChart
              ref={ref}
              option={option}
              height={170}
              ariaLabel="Calendário de entregas previstas de demandas abertas"
              onClick={(e) => {
                const day = (e.value as [string, number])[0];
                ctx.drill({ title: `Entregas previstas em ${formatDateBR(day)}`, rows: open.filter((d) => d.due === day) });
              }}
            />
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <h3 className="eyebrow mb-1 flex items-center gap-1.5" style={{ color: LATE }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: LATE }} /> Vencidas e abertas
              </h3>
              {late.length ? <ul className="max-h-[150px] overflow-y-auto">{late.map((d) => <Item key={d.id} d={d} tone="late" />)}</ul> : <p className="px-2 text-[12px] text-paper-mute">Nenhuma.</p>}
            </div>
            <div>
              <h3 className="eyebrow mb-1">Próximos 7 dias</h3>
              {soon.length ? <ul className="max-h-[150px] overflow-y-auto">{soon.map((d) => <Item key={d.id} d={d} tone="soon" />)}</ul> : <p className="px-2 text-[12px] text-paper-mute">Nenhuma.</p>}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
