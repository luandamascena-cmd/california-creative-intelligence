"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { CAT_LABEL, fmtPct, type Kpis } from "@/lib/analytics";
import type { Capabilities, StatusCategory } from "@/lib/types";
import { C, CATEGORICAL, LATE, OTHER, STATUS_COLORS, STATUS_ORDER, axisLabel, tooltipBase } from "./theme";
import { EChart } from "./EChart";
import { useMemo } from "react";
import { Insights } from "./Insights";
import { ClientStrip } from "./ClientStrip";
import { PeopleStrip } from "./PeopleStrip";
import type { DrillRequest } from "./charts/types";
import type { Demand } from "@/lib/types";

interface CardProps {
  label: string;
  value: number;
  hint?: React.ReactNode;
  tone?: "default" | "alert";
  badge?: string;
  onClick?: () => void;
  title?: string;
}

function KpiCard({ label, value, hint, tone = "default", badge, onClick, title }: CardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      title={title}
      className={`card group relative flex min-w-0 flex-col justify-between overflow-hidden p-4 text-left transition ${onClick ? "hover:border-white/25" : ""}`}
    >
      {tone === "alert" && value > 0 && <span className="absolute inset-x-0 top-0 h-[2px] bg-clf-red" />}
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        {badge && <span className="rounded border border-white/[0.12] px-1.5 py-px text-[9.5px] uppercase tracking-wide text-paper-mute">{badge}</span>}
      </div>
      <div className="display mt-3 text-[44px] sm:text-[52px]" style={{ color: tone === "alert" && value > 0 ? LATE : undefined }}>
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-1 min-h-[18px] truncate text-[12px] text-paper-mute">{hint}</div>
    </Comp>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span>sem entradas recentes</span>;
  if (!prev) return <span>{now} entradas em 30 dias</span>;
  const d = ((now - prev) / prev) * 100;
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={13} className={d > 0 ? "text-paper" : "text-paper-mute"} />
      <b className="font-semibold text-paper-dim">{d > 0 ? "+" : ""}{d.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</b> entradas 30d ({now} vs {prev})
    </span>
  );
}

export function KpiGrid({ k, caps, onStatus, onLate }: { k: Kpis; caps: Capabilities; onStatus: (cat: StatusCategory) => void; onLate: () => void }) {
  const cats: StatusCategory[] = ["briefing", "pauta", "aprovacao", "travado", "finalizado"];
  return (
    <section aria-label="Indicadores principais" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Demandas" value={k.demands} hint={caps.hasDates ? <Delta now={k.intake30} prev={k.intakePrev30} /> : "registros da pauta"} title="Total de linhas de pauta no filtro" />
        <KpiCard
          label="Projetos"
          value={k.projects}
          badge={caps.hasProjectColumn ? undefined : "estimativa"}
          hint={k.projects ? `${(k.demands / k.projects).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${k.demands === k.projects ? "demanda" : "demandas"} por projeto` : "sem dados"}
          title="Projetos distintos. Sem coluna PROJETO, é uma estimativa por nome da tarefa e cliente."
        />
        <KpiCard label="Clientes" value={k.clients} hint={`${k.externalClients} com trabalho de mercado`} title="Valores distintos da coluna CLIENTE" />
        <KpiCard label="Colaboradores" value={k.people} hint="em planejamento ou direção de arte" />
        <KpiCard
          label="Abertas"
          value={k.open}
          hint={`${k.byCat.pauta} em pauta · ${k.byCat.travado} travadas`}
          onClick={() => onStatus("pauta")}
          title="Status diferente de Finalizado"
        />
        {caps.hasDue && caps.hasStatus ? (
          <KpiCard
            label="Atrasadas"
            value={k.late}
            tone="alert"
            hint={<span className="inline-flex items-center gap-1">{k.late > 0 && <AlertTriangle size={12} style={{ color: LATE }} />}{k.dueSoon} entregam em 7 dias</span>}
            onClick={onLate}
            title="Abertas com ENTREGA anterior a hoje"
          />
        ) : (
          <KpiCard label="Finalizadas" value={k.byCat.finalizado} />
        )}
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        {caps.hasStatus &&
          cats.map((c) => (
            <button key={c} onClick={() => onStatus(c)} className="group flex items-center gap-2" title={`Ver demandas: ${CAT_LABEL[c]}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[c] }} />
              <span className="text-[12px] text-paper-mute group-hover:text-paper">{CAT_LABEL[c]}</span>
              <span className="display text-[20px] text-paper"><AnimatedNumber value={k.byCat[c]} /></span>
            </button>
          ))}
        <span className="hidden h-6 w-px bg-white/[0.12] lg:block" />
        <Stat label="Regionais ativas" value={k.regionals} />
        <Stat label="Times ativos" value={k.teams} />
        <Stat label="Business Units ativas" value={k.bus} />
        {k.medianPlannedDays !== null && <Stat label="Prazo planejado mediano" value={k.medianPlannedDays} suffix={k.medianPlannedDays === 1 ? " dia" : " dias"} title="Mediana de dias entre INÍCIO e ENTREGA" />}
      </div>
    </section>
  );
}

function Stat({ label, value, suffix = "", title }: { label: string; value: number; suffix?: string; title?: string }) {
  return (
    <span className="flex items-baseline gap-2" title={title}>
      <span className="text-[12px] text-paper-mute">{label}</span>
      <span className="display text-[20px] text-paper">
        <AnimatedNumber value={value} />
        {suffix && <span className="ml-0.5 font-sans text-[11px] normal-case text-paper-mute">{suffix}</span>}
      </span>
    </span>
  );
}

/** Status das demandas em formato compacto, para a abertura da página. */
function StatusSummary({ rows, onStatus }: { rows: Demand[]; onStatus: (status: string) => void }) {
  const data = useMemo(() => {
    const m = new Map<string, { n: number; cat: StatusCategory }>();
    rows.forEach((d) => {
      const s = m.get(d.status) ?? { n: 0, cat: d.statusCategory };
      s.n++;
      m.set(d.status, s);
    });
    return [...m.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => STATUS_ORDER.indexOf(a.cat) - STATUS_ORDER.indexOf(b.cat));
  }, [rows]);
  const total = rows.length;
  const option = useMemo(
    () => ({
      tooltip: { ...tooltipBase, trigger: "item", formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}` },
      series: [
        {
          type: "pie",
          radius: ["66%", "90%"],
          padAngle: 2,
          itemStyle: { borderRadius: 4, borderColor: C.card, borderWidth: 2 },
          label: { show: false },
          data: data.map((d) => ({ name: d.name, value: d.n, itemStyle: { color: STATUS_COLORS[d.cat] } })),
        },
      ],
    }),
    [data, total],
  );
  return (
    <div className="card flex flex-col p-5">
      <h2 className="text-[14px] font-semibold text-paper">Status das Demandas</h2>
      <div className="mt-3 flex flex-1 items-center gap-4">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <EChart option={option} height={132} ariaLabel="Distribuição das demandas por status" onClick={(e) => onStatus(e.name)} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="display text-[28px] leading-none text-paper">{total}</span>
            <span className="text-[10px] text-paper-mute">demandas</span>
          </div>
        </div>
        <ul className="min-w-0 max-w-[340px] flex-1 space-y-1">
          {data.map((d) => (
            <li key={d.name}>
              <button onClick={() => onStatus(d.name)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12.5px] hover:bg-white/[0.06]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATUS_COLORS[d.cat] }} />
                <span className="min-w-0 flex-1 truncate text-paper-dim">{d.name}</span>
                <span className="tabular-nums text-paper">{d.n}</span>
                <span className="w-10 text-right tabular-nums text-paper-mute">{fmtPct(d.n, total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function useStatusData(rows: Demand[]) {
  return useMemo(() => {
    const m = new Map<string, { n: number; cat: StatusCategory }>();
    rows.forEach((d) => {
      const s = m.get(d.status) ?? { n: 0, cat: d.statusCategory };
      s.n++;
      m.set(d.status, s);
    });
    return [...m.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => STATUS_ORDER.indexOf(a.cat) - STATUS_ORDER.indexOf(b.cat));
  }, [rows]);
}

/** Status em colunas verticais (Panorama): uma torre por status, com o número em cima. */
function StatusBars({ rows, onStatus }: { rows: Demand[]; onStatus: (status: string) => void }) {
  const data = useStatusData(rows);
  const total = rows.length;
  const option = useMemo(
    () => ({
      grid: { left: 2, right: 2, top: 22, bottom: 2, containLabel: true },
      tooltip: { ...tooltipBase, trigger: "item", formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}` },
      xAxis: {
        type: "category",
        data: data.map((d) => d.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: C.line } },
        axisLabel: { ...axisLabel, color: C.dim, interval: 0, fontSize: 10.5, width: 64, overflow: "break", lineHeight: 12 },
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "bar",
          barMaxWidth: 44,
          data: data.map((d) => ({ value: d.n, itemStyle: { color: STATUS_COLORS[d.cat], borderRadius: [4, 4, 0, 0] } })),
          label: { show: true, position: "top", color: C.paper, fontFamily: "Antonio", fontSize: 15 },
        },
      ],
    }),
    [data, total],
  );
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-paper">Status das Demandas</h2>
        <span className="text-[11px] tabular-nums text-paper-faint">{total} no total</span>
      </div>
      <div className="mt-2 flex-1">
        <EChart option={option} height={150} ariaLabel="Demandas por status, em colunas" onClick={(e) => onStatus(e.name)} />
      </div>
    </div>
  );
}

/** Tipos de demanda (coluna Tipo de projeto) em rosca, no mesmo formato do status. */
function TypeDonut({ rows, onDrill }: { rows: Demand[]; onDrill?: (r: DrillRequest) => void }) {
  const data = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((d) => {
      const t = d.projectType?.trim() || "Sem tipo";
      m.set(t, (m.get(t) ?? 0) + 1);
    });
    return [...m.entries()]
      .sort((a, b) => (a[0] === "Sem tipo" ? 1 : b[0] === "Sem tipo" ? -1 : b[1] - a[1]))
      .map(([name, n], i) => ({ name, n, color: name === "Sem tipo" ? OTHER : CATEGORICAL[i % CATEGORICAL.length] }));
  }, [rows]);
  const total = rows.length;
  const drill = (name: string) =>
    onDrill?.({ title: name, subtitle: "Demandas por tipo", rows: rows.filter((d) => (d.projectType?.trim() || "Sem tipo") === name), apply: name === "Sem tipo" ? undefined : { projectType: name } });
  const option = useMemo(
    () => ({
      tooltip: { ...tooltipBase, trigger: "item", formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} demandas · ${fmtPct(p.value, total)}` },
      series: [
        {
          type: "pie",
          radius: ["66%", "90%"],
          padAngle: 2,
          itemStyle: { borderRadius: 4, borderColor: C.card, borderWidth: 2 },
          label: { show: false },
          data: data.map((d) => ({ name: d.name, value: d.n, itemStyle: { color: d.color } })),
        },
      ],
    }),
    [data, total],
  );
  return (
    <div className="card flex flex-col p-5">
      <h2 className="text-[14px] font-semibold text-paper">Tipos de Demanda</h2>
      <div className="mt-3 flex flex-1 items-center gap-3">
        <div className="relative h-[128px] w-[128px] shrink-0">
          <EChart option={option} height={128} ariaLabel="Distribuição das demandas por tipo" onClick={(e) => drill(e.name)} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="display text-[24px] leading-none text-paper">{total}</span>
            <span className="text-[9.5px] text-paper-mute">demandas</span>
          </div>
        </div>
        <ul className="min-w-0 max-w-[300px] flex-1 space-y-0.5">
          {data.map((d) => (
            <li key={d.name}>
              <button onClick={() => drill(d.name)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12px] hover:bg-white/[0.06]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                <span className="min-w-0 flex-1 truncate text-paper-dim">{d.name}</span>
                <span className="tabular-nums text-paper">{d.n}</span>
                <span className="w-10 text-right tabular-nums text-paper-mute">{fmtPct(d.n, total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Abertura da página: projetos, status e, ao lado, os insights do recorte. */
export function Headline({ k, caps, rows, today, onStatus, trendRows, onDrill, row }: { k: Kpis; caps: Capabilities; rows: Demand[]; today: string; onStatus?: (status: string) => void; trendRows?: Demand[]; onDrill?: (r: DrillRequest) => void; /** Panorama: Tipos de Demanda, Status em colunas e Insights rotativos, em três colunas iguais, sem o número de projetos. */ row?: boolean }) {
  const withStatus = !!onStatus && caps.hasStatus;
  const cols = !withStatus
    ? "lg:grid-cols-[minmax(240px,300px)_1fr]"
    : row
      ? "md:grid-cols-2 lg:grid-cols-3"
      : "md:grid-cols-[minmax(220px,260px)_1fr] 2xl:grid-cols-[260px_400px_minmax(0,1fr)]";
  return (
    <div className="space-y-4">
    <section
      aria-label="Resumo do recorte"
      className={`grid gap-4 ${cols}`}
    >
      {/* No Panorama (row) o número de projetos sai: ficam Tipos, Status e Insights em três colunas iguais. */}
      {!row && (
      <div className="card relative flex flex-col justify-between overflow-hidden p-6" title="Projetos distintos. Sem coluna PROJETO, é uma estimativa por nome da tarefa e cliente.">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Projetos</span>
          {!caps.hasProjectColumn && <span className="rounded border border-white/[0.12] px-1.5 py-px text-[9.5px] uppercase tracking-wide text-paper-mute">estimativa</span>}
        </div>
        <div className="display mt-4 text-[88px] leading-none text-paper sm:text-[96px]">
          <AnimatedNumber value={k.projects} />
        </div>
        <div className="mt-3 text-[12.5px] text-paper-mute">
          {k.projects ? `${(k.demands / k.projects).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${k.demands === k.projects ? "demanda" : "demandas"} por projeto · ${k.demands} no total` : "sem dados no recorte"}
        </div>
      </div>
      )}
      {withStatus && row && <TypeDonut rows={rows} onDrill={onDrill} />}
      {withStatus && (row ? <StatusBars rows={rows} onStatus={onStatus!} /> : <StatusSummary rows={rows} onStatus={onStatus!} />)}
      <div className={!withStatus ? "h-full" : row ? "h-full md:col-span-2 lg:col-span-1" : "md:col-span-2 2xl:col-span-1"}>
        <Insights rows={rows} today={today} compact trendRows={trendRows} rotate={row} />
      </div>
    </section>
    <ClientStrip rows={rows} today={today} onDrill={onDrill} />
    <PeopleStrip rows={rows} today={today} onDrill={onDrill} />
    </div>
  );
}
