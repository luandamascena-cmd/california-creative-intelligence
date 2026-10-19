"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Headline } from "./Kpis";
import { EditBar, WidgetGrid, type useLayoutEditor } from "./LayoutGrid";
import type { ChartCtx, DrillRequest } from "./charts/types";
import { applyFilters, CAT_LABEL, computeKpis, isLate, type Filters } from "@/lib/analytics";
import { filterByPeriod } from "@/lib/period";
import { computePressure, LEVEL_COLOR, LEVEL_LABEL, type Pressure } from "@/lib/pressure";
import { regionalName } from "@/lib/labels";
import { TEAM_LOGOS, teamKey, teamOrder } from "@/lib/teams";
import type { Dataset, Demand, TabInfo } from "@/lib/types";

interface Props {
  data: Dataset;
  filters: Filters;
  today: string;
  ctx: ChartCtx;
  editor: ReturnType<typeof useLayoutEditor>;
  canEdit: boolean;
  onDrill: (r: DrillRequest) => void;
  onOpen: (regional: string, team: string | null) => void;
}

/** Rola até a seção e corrige a posição depois que os gráficos acima terminam de montar. */
function jumpTo(id: string) {
  const go = (behavior: ScrollBehavior) => document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
  go("smooth");
  [700, 1400, 2200].forEach((t) => setTimeout(() => go("auto"), t));
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sectionId = (regional: string, team?: string) => (team ? `time-${slug(regional)}-${slug(team)}` : `regional-${slug(regional)}`);

interface Unit {
  regional: string;
  tabs: TabInfo[];
}

/** Página longa: consolidado, matriz comparativa e cada regional com seus times, sempre com o mesmo modelo de gráficos. */
export function Panorama({ data, filters, today, ctx, editor, canEdit, onDrill, onOpen }: Props) {
  const scope = useMemo(() => ({ ...filters, regional: null, team: null }), [filters]);
  const all = data.demands;
  const consolidatedBase = useMemo(() => applyFilters(all, scope), [all, scope]);
  const consolidated = useMemo(() => filterByPeriod(consolidatedBase, filters.period, today), [consolidatedBase, filters.period, today]);
  const kpis = useMemo(() => computeKpis(consolidated, today), [consolidated, today]);

  // Regionais na ordem das guias da planilha, como no menu lateral.
  const units: Unit[] = useMemo(() => {
    const codes = [...new Set(data.tabs.map((t) => t.regional))];
    return codes.map((regional) => ({ regional, tabs: data.tabs.filter((t) => t.regional === regional).sort((a, b) => teamOrder(a.team) - teamOrder(b.team)) }));
  }, [data.tabs]);

  const sections = [{ id: "consolidado", label: "Consolidado" }, { id: "matriz", label: "Comparativo" }, ...units.map((u) => ({ id: sectionId(u.regional), label: regionalName(u.regional) }))];
  const active = useScrollSpy(sections.map((s) => s.id));

  const consolidatedCtx = { ...ctx, filters: scope };
  const widgets = editor.current;

  return (
    <div className="space-y-10">
      <nav aria-label="Seções do Panorama" className="no-print sticky top-[68px] z-20 -mx-4 border-b border-white/[0.06] bg-ink/80 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <ul className="flex gap-1.5 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(s.id);
                }}
                className={`block rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                  active === s.id ? "border-white/30 bg-white/[0.12] text-paper" : "border-white/[0.08] bg-white/[0.03] text-paper-mute hover:border-white/20 hover:text-paper"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Consolidado */}
      <section id="consolidado" className="scroll-mt-[130px] space-y-4">
        <SectionTitle eyebrow="Todas as regionais e times" title="Consolidado" />
        <Headline k={kpis} caps={data.capabilities} rows={consolidated} today={today} />
      </section>

      {/* Matriz comparativa */}
      <section id="matriz" className="scroll-mt-[130px] space-y-4">
        <SectionTitle eyebrow="Quem está mais pressionado" title="Comparativo entre Regionais e Times" />
        <Matrix units={units} base={consolidated} today={today} onJump={jumpTo} />
      </section>

      {/* Modelo de gráficos, editável aqui e replicado nas seções abaixo */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle eyebrow="Todas as regionais e times" title="Gráficos do Consolidado" />
        </div>
        <EditBar
          stickyTop="top-[128px]"
          canEdit={canEdit}
          editing={editor.editing}
          dirty={editor.dirty}
          scopeLabel="o Panorama"
          hint="Edite aqui. Regionais e times abaixo seguem o mesmo modelo, para a comparação continuar direta."
          current={widgets}
          onStart={editor.start}
          onCancel={editor.cancel}
          onReset={editor.reset}
          onAdd={editor.add}
          onSave={editor.save}
        />
        {widgets.length > 0 ? (
          <WidgetGrid widgets={widgets} editing={editor.editing} onChange={editor.setDraft} bases={{ base: consolidatedBase, cross: consolidatedBase, ctx: consolidatedCtx, global: filters.period }} />
        ) : (
          <p className="card px-6 py-8 text-center text-[13px] text-paper-mute">O modelo do Panorama está sem gráficos. {canEdit ? "Use Adicionar gráfico." : ""}</p>
        )}
      </section>

      {/* Regionais */}
      {units.map((u) => {
        const rRows = consolidated.filter((d) => d.regional === u.regional);
        const multi = u.tabs.length > 1;
        return (
          <section key={u.regional} id={sectionId(u.regional)} className="scroll-mt-[130px] space-y-5 border-t border-white/[0.08] pt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionTitle eyebrow={multi ? `Regional · ${u.tabs.length} times` : `Regional · ${u.tabs[0]?.team ?? ""}`} title={regionalName(u.regional)} big />
              <button onClick={() => onOpen(u.regional, null)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-paper-dim hover:text-paper">
                Abrir dashboard da regional <ArrowRight size={14} />
              </button>
            </div>
            <MiniKpis rows={rRows} today={today} />
            {u.tabs.map((t) => (
              <TeamBlock
                key={t.title}
                tab={t}
                showHeader={multi}
                widgets={widgets}
                all={all}
                scope={scope}
                filters={filters}
                today={today}
                ctx={ctx}
                cross={consolidatedBase}
                onOpen={() => onOpen(u.regional, t.team)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function SectionTitle({ eyebrow, title, big }: { eyebrow: string; title: string; big?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className={`display mt-1 leading-none text-paper ${big ? "text-[40px] sm:text-[48px]" : "text-[28px]"}`}>{title}</h2>
    </div>
  );
}

function TeamBlock(p: {
  tab: TabInfo;
  showHeader: boolean;
  widgets: ReturnType<typeof useLayoutEditor>["current"];
  all: Demand[];
  scope: Filters;
  filters: Filters;
  today: string;
  ctx: ChartCtx;
  cross: Demand[];
  onOpen: () => void;
}) {
  const { tab } = p;
  const teamFilters = useMemo(() => ({ ...p.scope, regional: tab.regional, team: tab.team }), [p.scope, tab.regional, tab.team]);
  const base = useMemo(() => applyFilters(p.all, teamFilters), [p.all, teamFilters]);
  const rows = useMemo(() => filterByPeriod(base, p.filters.period, p.today), [base, p.filters.period, p.today]);
  const logo = TEAM_LOGOS[teamKey(tab.team)];
  return (
    <div id={sectionId(tab.regional, tab.team)} className="scroll-mt-[130px] space-y-4">
      {p.showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex h-[34px] items-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.src} alt={tab.team} width={logo.w} height={logo.h} className={`${logo.className} w-auto`} />
            ) : (
              <span className="display text-[26px] text-paper">{tab.team}</span>
            )}
          </div>
          <button onClick={p.onOpen} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-paper-dim hover:text-paper">
            Abrir dashboard de {tab.team} <ArrowRight size={14} />
          </button>
        </div>
      )}
      {p.showHeader && <MiniKpis rows={rows} today={p.today} compact />}
      {tab.rows === 0 ? (
        <p className="card px-6 py-8 text-center text-[13px] text-paper-mute">
          Pauta ainda sem registros. Os gráficos de {tab.team} aparecem assim que a primeira linha da guia for preenchida.
        </p>
      ) : !rows.length ? (
        <p className="card px-6 py-8 text-center text-[13px] text-paper-mute">Nenhuma demanda de {tab.team} no filtro atual.</p>
      ) : (
        <LazyMount estimate={estimateHeight(p.widgets)}>
          <WidgetGrid widgets={p.widgets} editing={false} onChange={() => {}} bases={{ base, cross: p.cross, ctx: { ...p.ctx, filters: teamFilters }, global: p.filters.period }} />
        </LazyMount>
      )}
    </div>
  );
}

/* ---------- Indicadores compactos ---------- */

function MiniKpis({ rows, today, compact }: { rows: Demand[]; today: string; compact?: boolean }) {
  const pr = computePressure(rows, today);
  const people = new Set(rows.filter((d) => d.isOpen).flatMap((d) => d.people)).size;
  const items: [string, number, boolean?][] = [
    ["Demandas", rows.length],
    ["Abertas", pr.open],
    ["Atrasadas", pr.late, pr.late > 0],
    ["Em 7 dias", pr.dueSoon],
    ["Travadas", pr.blocked],
    ["Pessoas", people],
  ];
  return (
    <div className={`card flex flex-wrap items-center gap-x-8 gap-y-3 ${compact ? "px-5 py-3" : "px-6 py-4"}`}>
      {items.map(([label, value, alert]) => (
        <div key={label} className="min-w-[72px]">
          <span className={`display block leading-none ${compact ? "text-[26px]" : "text-[32px]"}`} style={{ color: alert ? "#E7103D" : "#FFFBF0" }}>
            {value}
          </span>
          <span className="mt-1 block text-[11px] text-paper-mute">{label}</span>
        </div>
      ))}
      <span className="ml-auto flex items-center gap-1.5 text-[12.5px]" style={{ color: pr.level === "sem-dados" ? "#8F8D88" : LEVEL_COLOR[pr.level] }} title={pr.reasons.join("; ") || undefined}>
        <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[pr.level] }} />
        {LEVEL_LABEL[pr.level]}
      </span>
    </div>
  );
}

/* ---------- Matriz comparativa ---------- */

interface MatrixRow {
  id: string;
  label: string;
  sub?: boolean;
  total: boolean;
  rows: Demand[];
  pressure: Pressure;
}

function Matrix({ units, base, today, onJump }: { units: Unit[]; base: Demand[]; today: string; onJump: (id: string) => void }) {
  const list: MatrixRow[] = [];
  units.forEach((u) => {
    const rRows = base.filter((d) => d.regional === u.regional);
    const multi = u.tabs.length > 1;
    list.push({ id: sectionId(u.regional), label: multi ? regionalName(u.regional) : `${regionalName(u.regional)} · ${u.tabs[0].team}`, total: multi, rows: rRows, pressure: computePressure(rRows, today) });
    if (multi)
      u.tabs.forEach((t) => {
        const tRows = rRows.filter((d) => d.sourceTab === t.title);
        list.push({ id: sectionId(u.regional, t.team), label: t.team, sub: true, total: false, rows: tRows, pressure: computePressure(tRows, today) });
      });
  });
  const cols = ["Demandas", "Abertas", "Atrasadas", "Em 7 dias", "Travadas", "Pessoas", "Clientes"];
  const values = (r: MatrixRow) => [
    r.rows.length,
    r.pressure.open,
    r.pressure.late,
    r.pressure.dueSoon,
    r.pressure.blocked,
    new Set(r.rows.filter((d) => d.isOpen).flatMap((d) => d.people)).size,
    new Set(r.rows.map((d) => d.client)).size,
  ];
  return (
    <div className="card overflow-x-auto p-2 sm:p-3">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-paper-mute">
            <th className="px-3 py-2.5 font-medium">Regional e time</th>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2.5 text-right font-medium">
                {c}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">Pressão</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const v = values(r);
            const c = LEVEL_COLOR[r.pressure.level];
            return (
              <tr key={r.id} onClick={() => onJump(r.id)} className={`cursor-pointer border-t border-white/[0.07] transition hover:bg-white/[0.05] ${r.total ? "bg-white/[0.025]" : ""}`}>
                <td className={`px-3 py-2.5 ${r.sub ? "pl-8 text-paper-dim" : "font-semibold text-paper"}`}>{r.label}</td>
                {v.map((n, i) => (
                  <td key={i} className={`px-3 py-2.5 text-right tabular-nums ${i === 2 && n > 0 ? "text-clf-red" : r.sub ? "text-paper-dim" : "text-paper"}`}>
                    {n}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(r.pressure.total ? 4 : 0, r.pressure.index * 100)}%`, background: c }} />
                    </span>
                    <span className="text-[12px]" style={{ color: r.pressure.level === "sem-dados" ? "#8F8D88" : c }}>
                      {LEVEL_LABEL[r.pressure.level]}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Utilitários ---------- */

/** Só monta os gráficos quando a seção se aproxima da tela: a página fica leve mesmo com dezenas de gráficos. */
/** Altura aproximada da grade, para a página não "pular" quando os gráficos montam. */
function estimateHeight(widgets: { span: number }[]) {
  let rows = 0;
  let used = 12;
  widgets.forEach((w) => {
    if (used + w.span > 12) {
      rows++;
      used = 0;
    }
    used += w.span;
  });
  return rows * 440 + Math.max(0, rows - 1) * 16;
}

function LazyMount({ children, estimate }: { children: React.ReactNode; estimate: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show || !ref.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShow(true), { rootMargin: "900px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show]);
  return <div ref={ref}>{show ? children : <div className="card animate-pulse opacity-40" style={{ minHeight: estimate }} />}</div>;
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    const onScroll = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}
