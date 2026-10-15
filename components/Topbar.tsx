"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Maximize2, Menu, Minimize2, Play, Pause, RefreshCw, Search } from "lucide-react";
import type { Dataset, Demand } from "@/lib/types";
import type { SyncState } from "./useDataset";
import { normKey } from "@/lib/text";

function ago(iso: string | undefined, now: number) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  data: Dataset | null;
  state: SyncState;
  error: string | null;
  context: string;
  presenting: boolean;
  rotating: boolean;
  onRefresh: () => void;
  onPresent: () => void;
  onRotate: () => void;
  onExportCsv: () => void;
  onMobileMenu: () => void;
  onSearchPick: (kind: "client" | "person" | "task", value: string, row?: Demand) => void;
}

export function Topbar(p: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const dot = { loading: "#8F8D88", ok: "#199e70", syncing: "#3987e5", stale: "#c98500", error: "#E7103D" }[p.state];
  const label = {
    loading: "Conectando",
    ok: "Sincronizado",
    syncing: "Sincronizando",
    stale: "Sem conexão com a planilha",
    error: "Falha na conexão",
  }[p.state];

  return (
    <header className="no-print sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-white/[0.08] bg-ink/85 px-4 backdrop-blur-md sm:px-6">
      <button className="rounded-md p-2 text-paper-mute hover:text-paper md:hidden" onClick={p.onMobileMenu} aria-label="Abrir navegação">
        <Menu size={18} />
      </button>
      <div className="min-w-0">
        <p className="eyebrow truncate">Pauta de criação · Ecossistema California</p>
        <h1 className="display truncate text-[22px] tracking-[0.06em] text-paper">{p.context}</h1>
      </div>

      {!p.presenting && <GlobalSearch rows={p.data?.demands ?? []} onPick={p.onSearchPick} />}

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg px-2 text-[12px] text-paper-mute lg:flex" title={p.error ?? undefined} aria-live="polite">
          <span className="relative flex h-2 w-2">
            {p.state === "syncing" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: dot }} />}
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: dot }} />
          </span>
          <span>
            {label}
            {p.data && <> · {ago(p.data.syncedAt, now)}</>}
          </span>
        </div>
        <button className="btn px-2.5" onClick={p.onRefresh} disabled={p.state === "syncing"} title="Sincronizar agora" aria-label="Sincronizar agora">
          <RefreshCw size={15} className={p.state === "syncing" ? "animate-spin" : ""} />
        </button>
        {!p.presenting && (
          <>
            <button className="btn hidden px-2.5 sm:inline-flex" onClick={p.onExportCsv} title="Exportar dados filtrados (CSV)">
              <Download size={15} /> <span className="hidden xl:inline">CSV</span>
            </button>
            <button className="btn hidden px-2.5 sm:inline-flex" onClick={() => window.print()} title="Exportar relatório em PDF">
              <FileText size={15} /> <span className="hidden xl:inline">PDF</span>
            </button>
          </>
        )}
        {p.presenting && (
          <button className="btn px-2.5" onClick={p.onRotate} title={p.rotating ? "Pausar rotação das regionais" : "Rodar entre as regionais automaticamente"}>
            {p.rotating ? <Pause size={15} /> : <Play size={15} />} <span className="hidden sm:inline">Rotação</span>
          </button>
        )}
        <button className="btn px-2.5" onClick={p.onPresent} title={p.presenting ? "Sair do modo apresentação" : "Modo apresentação (tela cheia)"}>
          {p.presenting ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          <span className="hidden xl:inline">{p.presenting ? "Sair" : "Apresentar"}</span>
        </button>
      </div>
    </header>
  );
}

function GlobalSearch({ rows, onPick }: { rows: Demand[]; onPick: Props["onSearchPick"] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const res = useMemo(() => {
    const k = normKey(q);
    if (k.length < 2) return null;
    const uniq = (xs: string[]) => [...new Set(xs)].filter((x) => normKey(x).includes(k)).slice(0, 5);
    return {
      clients: uniq(rows.map((d) => d.client)),
      people: uniq(rows.flatMap((d) => d.people)),
      tasks: rows.filter((d) => normKey(d.task).includes(k) || normKey(d.projectLabel).includes(k)).slice(0, 6),
    };
  }, [q, rows]);
  const pick = (...a: Parameters<Props["onSearchPick"]>) => {
    onPick(...a);
    setQ("");
    setOpen(false);
  };
  const empty = res && !res.clients.length && !res.people.length && !res.tasks.length;
  return (
    <div ref={box} className="relative ml-4 hidden w-full max-w-[380px] md:block">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-faint" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar cliente, projeto ou pessoa"
        aria-label="Busca global"
        className="h-9 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] pl-9 pr-12 text-[13px] text-paper outline-none placeholder:text-paper-faint focus:border-clf-red"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/[0.12] px-1.5 text-[10px] text-paper-faint">⌘K</kbd>
      {open && res && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[420px] overflow-y-auto rounded-xl border border-white/[0.12] bg-white/[0.03] p-2 shadow-2xl">
          {empty && <p className="px-3 py-4 text-[12.5px] text-paper-mute">Nada encontrado.</p>}
          {!!res.clients.length && <Group title="Clientes">{res.clients.map((c) => <Opt key={c} onClick={() => pick("client", c)}>{c}</Opt>)}</Group>}
          {!!res.people.length && <Group title="Colaboradores">{res.people.map((c) => <Opt key={c} onClick={() => pick("person", c)}>{c}</Opt>)}</Group>}
          {!!res.tasks.length && (
            <Group title="Demandas e projetos">
              {res.tasks.map((d) => (
                <Opt key={d.id} onClick={() => pick("task", d.task, d)}>
                  {d.task} <span className="text-paper-faint">· {d.client}</span>
                </Opt>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-1">
    <p className="eyebrow px-3 pb-1 pt-2">{title}</p>
    {children}
  </div>
);
const Opt = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="block w-full truncate rounded-md px-3 py-1.5 text-left text-[13px] text-paper-dim hover:bg-white/[0.06] hover:text-paper">
    {children}
  </button>
);
