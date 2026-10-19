"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Loader2, Minus, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { CHARTS } from "./charts/registry";
import { AltChart } from "./charts/alt";
import { PeriodScope } from "./PeriodScope";
import type { ChartCtx } from "./charts/types";
import type { PeriodKey } from "@/lib/period";
import { filterByPeriod } from "@/lib/period";
import type { Demand } from "@/lib/types";
import {
  CHART_KEYS,
  DEFAULT_LAYOUT,
  SPANS,
  SPAN_CLASS,
  SPAN_LABEL,
  VARIANTS,
  VARIANT_LABEL,
  type ChartKey,
  type SharedLayout,
  type Variant,
  type Widget,
} from "@/lib/layout";

/* ---------- Layout compartilhado ---------- */

export function useSharedLayout() {
  const [layout, setLayout] = useState<SharedLayout>(DEFAULT_LAYOUT);
  const [canEdit, setCanEdit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const editingRef = useRef(false);

  const load = useCallback(async () => {
    if (editingRef.current) return;
    try {
      const res = await fetch("/api/layout", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setLayout(json.layout);
        setCanEdit(!!json.canEdit);
      }
    } catch {
      /* sem layout salvo: segue o padrão */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    // Quem está com a dashboard aberta recebe o layout novo sem recarregar a página.
    const id = setInterval(load, 120_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const save = useCallback(async (next: SharedLayout) => {
    const res = await fetch("/api/layout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const json = await res.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor." }));
    if (!json.ok) throw new Error(json.error ?? "Não foi possível salvar.");
    setLayout(json.layout);
    return json.layout as SharedLayout;
  }, []);

  return { layout, canEdit, loaded, save, editingRef };
}

/* ---------- Desenho de um gráfico do layout ---------- */

interface Bases {
  base: Demand[];
  cross: Demand[];
  ctx: ChartCtx;
  global: PeriodKey | null;
}

export function ChartWidget({ widget, bases, className }: { widget: Widget; bases: Bases; className?: string }) {
  const def = CHARTS[widget.chart];
  const base = def.cross ? bases.cross : bases.base;
  const variant: Variant = def.alt && widget.variant ? widget.variant : "padrao";
  if (def.noPeriod) {
    const rows = filterByPeriod(base, bases.global, bases.ctx.today);
    return <def.Comp rows={rows} ctx={bases.ctx} className={className} />;
  }
  if (variant !== "padrao" && def.alt) {
    const spec = def.alt;
    return <PeriodScope base={base} ctx={bases.ctx} global={bases.global} render={(rows) => <AltChart rows={rows} ctx={bases.ctx} className={className} spec={spec} variant={variant} />} />;
  }
  return <PeriodScope Chart={def.Comp} base={base} ctx={bases.ctx} global={bases.global} className={className} />;
}

/* ---------- Grade com edição ---------- */

interface GridProps {
  widgets: Widget[];
  bases: Bases;
  editing: boolean;
  onChange: (next: Widget[]) => void;
}

export function WidgetGrid({ widgets, bases, editing, onChange }: GridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = widgets.findIndex((w) => w.id === e.active.id);
    const to = widgets.findIndex((w) => w.id === e.over!.id);
    onChange(arrayMove(widgets, from, to));
  };
  const patch = (id: string, p: Partial<Widget>) => onChange(widgets.map((w) => (w.id === id ? { ...w, ...p } : w)));

  if (!editing) {
    return (
      <div className="grid grid-cols-12 gap-4">
        {widgets.map((w) => (
          <ChartWidget key={w.id} widget={w} bases={bases} className={SPAN_CLASS[w.span]} />
        ))}
      </div>
    );
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="grid select-none grid-cols-12 gap-4">
          {widgets.map((w) => (
            <SortableWidget key={w.id} widget={w} bases={bases} onPatch={(p) => patch(w.id, p)} onRemove={() => onChange(widgets.filter((x) => x.id !== w.id))} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({ widget, bases, onPatch, onRemove }: { widget: Widget; bases: Bases; onPatch: (p: Partial<Widget>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const def = CHARTS[widget.chart];
  const i = SPANS.indexOf(widget.span);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 40 : undefined }}
      className={`${SPAN_CLASS[widget.span]} relative flex flex-col rounded-[22px] outline-dashed outline-1 outline-offset-4 ${isDragging ? "outline-clf-red/80 opacity-90" : "outline-white/25"}`}
    >
      <div className="glass-bar mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/15 bg-[#1c1c1f]/90 px-2 py-1.5 text-[12px] backdrop-blur-xl">
        <button
          {...attributes}
          {...listeners}
          className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-paper-mute hover:bg-white/[0.08] hover:text-paper active:cursor-grabbing"
          aria-label={`Arrastar ${def.label}`}
          title="Arrastar para reordenar"
        >
          <GripVertical size={15} />
        </button>
        <span className="min-w-0 flex-1 truncate font-medium text-paper">{def.label}</span>
        <div className="flex items-center rounded-md border border-white/[0.12] bg-white/[0.04]" title="Largura do gráfico">
          <button className="flex h-6 w-6 items-center justify-center text-paper-mute hover:text-paper disabled:opacity-30" disabled={i <= 0} onClick={() => onPatch({ span: SPANS[i - 1] })} aria-label="Diminuir largura">
            <Minus size={12} />
          </button>
          <span className="w-12 text-center text-[11px] tabular-nums text-paper-dim">{SPAN_LABEL[widget.span]}</span>
          <button className="flex h-6 w-6 items-center justify-center text-paper-mute hover:text-paper disabled:opacity-30" disabled={i >= SPANS.length - 1} onClick={() => onPatch({ span: SPANS[i + 1] })} aria-label="Aumentar largura">
            <Plus size={12} />
          </button>
        </div>
        {def.alt && (
          <select
            className="h-7 rounded-md border border-white/[0.12] bg-white/[0.04] px-2 text-[11.5px] text-paper-dim outline-none hover:border-white/25"
            value={widget.variant ?? "padrao"}
            onChange={(e) => onPatch({ variant: e.target.value as Variant })}
            aria-label="Tipo de gráfico"
            title="Tipo de gráfico"
          >
            {VARIANTS.map((v) => (
              <option key={v} value={v}>
                {VARIANT_LABEL[v]}
              </option>
            ))}
          </select>
        )}
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-paper-mute hover:bg-clf-red/20 hover:text-clf-red" onClick={onRemove} aria-label={`Remover ${def.label}`} title="Remover gráfico">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="pointer-events-none flex flex-1 flex-col opacity-80 [&>*]:flex-1">
        <ChartWidget widget={widget} bases={bases} />
      </div>
    </div>
  );
}

/* ---------- Barra de edição ---------- */

interface EditBarProps {
  canEdit: boolean;
  editing: boolean;
  dirty: boolean;
  scopeLabel: string;
  hint?: string;
  current: Widget[];
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
  onAdd: (chart: ChartKey) => void;
  onSave: () => Promise<void>;
  /** Posição fixa ao rolar (abaixo das barras fixas da página). */
  stickyTop?: string;
}

export function EditBar({ canEdit, editing, dirty, scopeLabel, hint, current, onStart, onCancel, onReset, onAdd, onSave, stickyTop = "top-[76px]" }: EditBarProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!canEdit) return null;
  const used = new Set(current.map((w) => w.chart));
  const available = CHART_KEYS.filter((k) => !used.has(k));

  if (!editing) {
    return (
      <div className="no-print flex justify-end">
        <button className="btn h-8 px-3 text-[12px]" onClick={onStart} title="Reorganizar, trocar o tipo ou remover gráficos. Vale para todos que acessam.">
          <SlidersHorizontal size={13} /> Personalizar {scopeLabel}
        </button>
      </div>
    );
  }
  return (
    <div className={`no-print sticky ${stickyTop} z-30 rounded-2xl border border-clf-red/40 bg-[#1a1214]/90 px-4 py-3 shadow-2xl backdrop-blur-xl`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <p className="text-[13px] font-semibold text-paper">Editando o layout {scopeLabel === "o Panorama" ? "do Panorama" : "da dashboard"}</p>
          <p className="text-[11.5px] text-paper-mute">{hint ?? "Arraste pela alça, ajuste a largura, troque o tipo ou remova. Ao salvar, todos passam a ver esta arrumação."}</p>
        </div>
        <div className="relative">
          <button className="btn h-8 px-3 text-[12px]" onClick={() => setAdding((a) => !a)} disabled={!available.length} aria-expanded={adding}>
            <Plus size={13} /> Adicionar gráfico
          </button>
          <AnimatePresence>
            {adding && available.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-10 z-50 max-h-[320px] w-[260px] overflow-y-auto rounded-xl border border-white/15 bg-[#1c1c1f]/95 p-1 shadow-2xl backdrop-blur-xl"
              >
                {available.map((k) => (
                  <li key={k}>
                    <button
                      className="w-full rounded-lg px-3 py-2 text-left text-[12.5px] text-paper-dim hover:bg-white/[0.08] hover:text-paper"
                      onClick={() => {
                        onAdd(k);
                        setAdding(false);
                      }}
                    >
                      {CHARTS[k].label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <button className="btn h-8 px-3 text-[12px]" onClick={onReset} title="Volta à arrumação original">
          <RotateCcw size={13} /> Restaurar padrão
        </button>
        <button className="btn h-8 px-3 text-[12px]" onClick={onCancel}>
          <X size={13} /> Cancelar
        </button>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-clf-red px-3 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          disabled={saving || !dirty}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSave();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar para todos
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-clf-coral">{error}</p>}
    </div>
  );
}

/** Estado de edição de uma lista do layout (dashboard ou Panorama). */
export function useLayoutEditor(key: "dashboard" | "panorama", shared: ReturnType<typeof useSharedLayout>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Widget[]>([]);
  const current = editing ? draft : shared.layout[key];
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(shared.layout[key]);

  const start = () => {
    setDraft(shared.layout[key]);
    setEditing(true);
    shared.editingRef.current = true;
  };
  const stop = () => {
    setEditing(false);
    shared.editingRef.current = false;
  };
  return {
    editing,
    current,
    dirty,
    setDraft,
    start,
    cancel: stop,
    reset: () => setDraft(DEFAULT_LAYOUT[key]),
    add: (chart: ChartKey) => {
      const id = draft.some((w) => w.id === chart) ? `${chart}-${Date.now().toString(36)}` : chart;
      setDraft([...draft, { id, chart, span: 6 }]);
    },
    save: async () => {
      await shared.save({ ...shared.layout, [key]: draft });
      stop();
    },
  };
}
