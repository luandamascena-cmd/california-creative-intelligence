"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { CAT_LABEL, type Kpis } from "@/lib/analytics";
import type { Capabilities, StatusCategory } from "@/lib/types";
import { LATE, STATUS_COLORS } from "./theme";
import { Insights } from "./Insights";
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

/** Abertura da página: um único número (projetos) e, ao lado, os insights do recorte. */
export function Headline({ k, caps, rows, today }: { k: Kpis; caps: Capabilities; rows: Demand[]; today: string }) {
  return (
    <section aria-label="Resumo do recorte" className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
      <div className="card relative flex flex-col justify-between overflow-hidden p-6" title="Projetos distintos. Sem coluna PROJETO, é uma estimativa por nome da tarefa e cliente.">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Projetos</span>
          {!caps.hasProjectColumn && <span className="rounded border border-white/[0.12] px-1.5 py-px text-[9.5px] uppercase tracking-wide text-paper-mute">estimativa</span>}
        </div>
        <div className="display mt-4 text-[88px] leading-none text-paper sm:text-[104px]">
          <AnimatedNumber value={k.projects} />
        </div>
        <div className="mt-3 text-[12.5px] text-paper-mute">
          {k.projects ? `${(k.demands / k.projects).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${k.demands === k.projects ? "demanda" : "demandas"} por projeto · ${k.demands} no total` : "sem dados no recorte"}
        </div>
      </div>
      <Insights rows={rows} today={today} compact />
    </section>
  );
}
