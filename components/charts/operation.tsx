"use client";

import { useMemo, useState } from "react";
import { ChartCard, Segmented } from "../ChartCard";
import { EChart } from "../EChart";
import { C, LATE, STATUS_COLORS, STATUS_ORDER, axisLabel, splitLine, tooltipBase } from "../theme";
import { CAT_LABEL, fmtPct, isLate } from "@/lib/analytics";
import type { Demand, StatusCategory } from "@/lib/types";
import type { ChartProps } from "./types";
import { PersonDemands, useWide } from "./PersonDemands";
import { useFitGrid } from "../useFitGrid";
import { initials, personPhoto, shortName } from "@/lib/people";

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
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked && data.some((p) => p.name === picked) ? picked : data[0]?.name ?? null;
  const { ref: box, wide } = useWide();
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
        triggerEvent: true,
      },
      series: [
        { name: "Demandas", type: "bar", barWidth: 8, barGap: "30%", itemStyle: { color: C.mark, borderRadius: [0, 4, 4, 0] }, data: data.map((d) => ({ value: d.demands, itemStyle: { opacity: d.name === current ? 1 : 0.38 } })), label: { show: true, position: "right", color: C.mute, fontSize: 10.5 } },
        { name: "Projetos", type: "bar", barWidth: 8, itemStyle: { color: "#8C8579", borderRadius: [0, 4, 4, 0] }, data: data.map((d) => ({ value: d.projectCount, itemStyle: { opacity: d.name === current ? 1 : 0.38 } })) },
      ],
    }),
    [data, current],
  );
  return (
    <ChartCard
      code="04"
      title="Projetos por Colaboradores"
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
        <div ref={box} className={wide ? "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5" : "space-y-4"}>
          <div className="min-w-0">
            <p className="mb-1 text-[11.5px] text-paper-faint">Clique em um nome para ver as demandas {wide ? "ao lado" : "abaixo"}.</p>
            <EChart ref={ref} option={option} height={Math.max(240, data.length * 30 + 40)} ariaLabel="Demandas e projetos por colaborador" onClick={(e) => setPicked(e.componentType === "yAxis" ? String((e as unknown as { value: string }).value) : e.name)} />
          </div>
          {current && (
            <PersonDemands
              name={current}
              rows={rows.filter((d) => d.people.includes(current))}
              today={ctx.today}
              caption={rows.filter((d) => d.people.includes(current)).length === 1 ? "demanda no recorte" : "demandas no recorte"}
              onExpand={() => ctx.drill({ title: current, subtitle: "Demandas do colaborador", rows: rows.filter((d) => d.people.includes(current)), apply: { person: current } })}
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}

/* 11 · Demandas por colaborador: foto, quantidade de abertas e, ao clicar, a lista ao lado */
export function WorkloadChart({ rows, ctx, className }: ChartProps) {
  const open = useMemo(() => rows.filter((d) => d.isOpen), [rows]);
  const cats = useMemo(() => STATUS_ORDER.filter((c) => c !== "finalizado" && open.some((d) => d.statusCategory === c)), [open]);
  const people = useMemo(() => {
    const m = new Map<string, { total: number; late: number; byCat: Record<string, number> }>();
    open.forEach((d) =>
      d.people.forEach((p) => {
        const s = m.get(p) ?? { total: 0, late: 0, byCat: {} };
        s.total++;
        s.byCat[d.statusCategory] = (s.byCat[d.statusCategory] ?? 0) + 1;
        if (isLate(d, ctx.today)) s.late++;
        m.set(p, s);
      }),
    );
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).map(([name, s]) => ({ name, ...s }));
  }, [open, ctx.today]);
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked && people.some((p) => p.name === picked) ? picked : people[0]?.name ?? null;
  const { ref: box, wide } = useWide();
  const fit = useFitGrid(people.length, { minItem: 104, gap: 12, maxCircle: 120 });
  const mine = current ? open.filter((d) => d.people.includes(current)) : [];

  return (
    <ChartCard
      code="11"
      title="Demandas por Colaboradores"
      className={className}
      definition="Demandas abertas (status diferente de Finalizado) em que a pessoa aparece como planejamento ou direção de arte. O número no círculo é a quantidade de demandas abertas; o ponto vermelho, quantas estão com ENTREGA vencida. A barra embaixo do nome mostra a divisão por status. Mostra concentração da pauta, não capacidade: a planilha não informa horas nem esforço."
      empty={!people.length && "Sem demandas abertas com responsável no filtro atual."}
      table={{ columns: ["Colaborador", "Abertas", ...cats.map((c) => CAT_LABEL[c as StatusCategory]), "Vencidas"], rows: people.map((p) => [p.name, p.total, ...cats.map((c) => p.byCat[c] ?? 0), p.late]) }}
    >
      {() => (
        <div ref={box} className={wide ? "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-6" : "space-y-5"}>
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-paper-faint">
              <span>Clique em uma foto para ver as demandas {wide ? "ao lado" : "abaixo"}.</span>
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-paper-mute">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_COLORS[c] }} />
                  {CAT_LABEL[c as StatusCategory]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-paper-mute">
                <span className="h-2 w-2 rounded-full" style={{ background: LATE }} />
                Vencidas
              </span>
            </div>
            <div ref={fit.ref}>
            <ul className="grid gap-y-5" style={{ gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))`, columnGap: fit.gap }}>
              {people.map((p) => {
                const sel = p.name === current;
                return (
                  <li key={p.name}>
                    <button
                      onClick={() => setPicked(p.name)}
                      aria-pressed={sel}
                      title={`${p.name} · ${p.total} ${p.total === 1 ? "demanda aberta" : "demandas abertas"}${p.late ? ` · ${p.late} vencidas` : ""}`}
                      className="group flex w-full flex-col items-center rounded-2xl px-1 py-2 text-center transition hover:bg-white/[0.04]"
                    >
                      <span className="relative">
                        <Avatar name={p.name} size={fit.circle} selected={sel} />
                        <CountBadge value={p.total} size={fit.circle} />
                        {p.late > 0 && <LateBadge value={p.late} size={fit.circle} />}
                      </span>
                      <span className={`mt-2.5 block w-full truncate text-[12.5px] ${sel ? "font-semibold text-paper" : "text-paper-dim group-hover:text-paper"}`}>{shortName(p.name)}</span>
                      <span className="mt-1.5 flex h-1 w-14 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                        {cats.map((c) => (
                          <span key={c} className="h-full" style={{ width: `${((p.byCat[c] ?? 0) / p.total) * 100}%`, background: STATUS_COLORS[c] }} />
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            </div>
          </div>
          {current && (
            <PersonDemands
              name={current}
              rows={mine}
              today={ctx.today}
              caption={mine.length === 1 ? "demanda aberta" : "demandas abertas"}
              onExpand={() => ctx.drill({ title: current, subtitle: "Demandas abertas do colaborador", rows: mine, apply: { person: current } })}
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}

/** Quantidade no canto inferior do círculo, proporcional ao tamanho dele. */
export function CountBadge({ value, size }: { value: number; size: number }) {
  const h = Math.round(Math.max(22, size * 0.34));
  return (
    <span
      className="display absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-[#1b1b1d] bg-paper leading-none text-ink"
      style={{ height: h, minWidth: h, paddingInline: h * 0.22, fontSize: h * 0.6 }}
    >
      {value}
    </span>
  );
}

/** Vencidas no canto superior do círculo. */
export function LateBadge({ value, size }: { value: number; size: number }) {
  const h = Math.round(Math.max(17, size * 0.24));
  return (
    <span
      className="absolute -right-1 -top-1 flex items-center justify-center rounded-full border-2 border-[#1b1b1d] font-bold leading-none text-white"
      style={{ height: h, minWidth: h, paddingInline: h * 0.2, fontSize: h * 0.52, background: LATE }}
    >
      {value}
    </span>
  );
}

/** Foto do colaborador em círculo; sem foto cadastrada, as iniciais. */
export function Avatar({ name, size, selected }: { name: string; size: number; selected?: boolean }) {
  const src = personPhoto(name);
  const [broken, setBroken] = useState(false);
  const hue = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={`flex items-center justify-center overflow-hidden rounded-full transition ${selected ? "ring-2 ring-clf-red ring-offset-2 ring-offset-[#1b1b1d]" : "ring-1 ring-white/15 group-hover:ring-white/35"}`}
      style={{ width: size, height: size, background: `linear-gradient(145deg, hsl(${hue} 22% 30%), hsl(${(hue + 40) % 360} 18% 18%))` }}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="display text-paper" style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </span>
      )}
    </span>
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
      title="Status das Demandas"
      className={className}
      definition="Distribuição pelos valores da coluna STATUS, com as mesmas cores em toda a dashboard. Abertas = qualquer status diferente de Finalizado. Vencidas = abertas com ENTREGA anterior a hoje."
      empty={!data.length && "Nenhuma demanda no filtro atual."}
      table={{ columns: ["Status", "Demandas", "%"], rows: data.map((d) => [d.name, d.n, fmtPct(d.n, total)]) }}
    >
      {(ref) => (
        <>
          <div className="mb-1 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
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
