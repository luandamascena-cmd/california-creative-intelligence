"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Dataset, IssueSeverity } from "@/lib/types";

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"
          >
            <header className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
              <h2 className="display text-[22px] tracking-[0.06em]">{title}</h2>
              <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-paper-mute hover:bg-ink-800 hover:text-paper">
                <X size={18} />
              </button>
            </header>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SEV: Record<IssueSeverity, { icon: typeof Info; color: string; label: string }> = {
  erro: { icon: XCircle, color: "#E7103D", label: "Erro" },
  alerta: { icon: AlertTriangle, color: "#c98500", label: "Alerta" },
  info: { icon: Info, color: "#8F8D88", label: "Informação" },
};

export function QualityModal({ data, open, onClose }: { data: Dataset; open: boolean; onClose: () => void }) {
  const order: IssueSeverity[] = ["erro", "alerta", "info"];
  const issues = [...data.issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const recon = data.reconciliation.filter((r) => r.sheet > 0 || r.dashboard > 0);
  return (
    <Modal open={open} title="Qualidade dos dados" onClose={onClose}>
      <section className="mb-6">
        <h3 className="eyebrow mb-3">Conferência com a guia Visão Geral</h3>
        {recon.length ? (
          <div className="overflow-hidden rounded-xl border border-ink-700">
            <table className="w-full text-[12.5px]">
              <thead className="bg-ink-800 text-left text-paper-mute">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Métrica</th>
                  <th className="px-3 py-2 text-right font-medium">Planilha</th>
                  <th className="px-3 py-2 text-right font-medium">Dashboard</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {recon.map((r) => (
                  <tr key={r.tab + r.metric} className="border-t border-ink-700">
                    <td className="px-3 py-1.5">{r.tab}</td>
                    <td className="px-3 py-1.5 text-paper-dim">{r.metric}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.sheet}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.dashboard}</td>
                    <td className="px-3 py-1.5 text-right">
                      {r.sheet === r.dashboard ? <CheckCircle2 size={15} className="inline text-[#199e70]" aria-label="Confere" /> : <AlertTriangle size={15} className="inline text-[#c98500]" aria-label="Diverge" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12.5px] text-paper-mute">A planilha não tem o quadro Por time na guia Visão Geral, ou ainda não há registros.</p>
        )}
        <p className="mt-2 text-[11.5px] text-paper-faint">Atrasadas e Em 7 dias dependem da data de hoje; a planilha recalcula ao abrir, a dashboard a cada sincronização.</p>
      </section>
      <section className="mb-6">
        <h3 className="eyebrow mb-3">Guias lidas</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.tabs.map((t) => (
            <div key={t.title} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-2 text-[12.5px]">
              <span>
                {t.title} <span className="text-paper-faint">· cabeçalho na linha {t.headerRow ?? "?"}</span>
              </span>
              <span className="tabular-nums text-paper-dim">{t.rows} registros</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="eyebrow mb-3">Inconsistências e limitações ({issues.length})</h3>
        <ul className="space-y-2">
          {issues.map((i, n) => {
            const s = SEV[i.severity];
            const Icon = s.icon;
            return (
              <li key={n} className="flex gap-3 rounded-lg border border-ink-700 px-3 py-2.5 text-[12.5px]">
                <Icon size={15} className="mt-0.5 shrink-0" style={{ color: s.color }} aria-label={s.label} />
                <span className="text-paper-dim">{i.message}</span>
              </li>
            );
          })}
          {!issues.length && <li className="text-[12.5px] text-paper-mute">Nenhuma inconsistência detectada.</li>}
        </ul>
      </section>
    </Modal>
  );
}

const TERMS: [string, string][] = [
  ["Demanda", "Uma linha de uma guia de pauta (um registro operacional de trabalho). É a unidade de todas as contagens, salvo quando o gráfico diz Projetos."],
  ["Projeto", "Iniciativa que agrupa uma ou mais demandas. Sem coluna PROJETO na planilha, é estimado: demandas do mesmo cliente com o mesmo nome de tarefa, ignorando prefixos entre colchetes, versões (V2, V3) e idioma (ENG, Inglês). Crie a coluna PROJETO para tornar a contagem exata; a dashboard passa a usá-la automaticamente."],
  ["Cliente", "Valor da coluna CLIENTE. Inclui marcas da própria casa (ex.: Originals, Content House) quando a planilha registra assim."],
  ["Business Unit (BU)", "Valor da coluna BUSINESS UNIT: a unidade de negócio a que a demanda pertence."],
  ["Time", "Time executor, lido do nome da guia (REGIONAL | TIME). Um time pode atender demandas de várias BUs."],
  ["Regional", "Primeira parte do nome da guia (SP, RJ, NO, NE)."],
  ["Abertas", "Demandas com status diferente de Finalizado (inclui Travado e Em Briefing)."],
  ["Atrasadas / vencidas", "Abertas com ENTREGA anterior à data de hoje (fuso de São Paulo)."],
  ["Entregam em 7 dias", "Abertas com ENTREGA entre hoje e daqui a 7 dias."],
  ["Colaboradores", "Pessoas citadas em PLANEJAMENTO ou DIRETOR DE ARTE. Uma demanda com várias pessoas conta para cada uma nos rankings individuais, mas uma única vez nos totais."],
  ["Entradas 30d", "Demandas com INÍCIO nos últimos 30 dias, comparadas com os 30 dias anteriores."],
  ["Prazo planejado mediano", "Mediana de dias entre INÍCIO e ENTREGA. Mede o prazo combinado, não o tempo de execução, que a planilha não registra."],
  ["Duplicatas", "Linhas idênticas em todas as colunas contam uma vez. Linhas com mesma tarefa, cliente e datas, mas algum campo diferente, são mantidas e sinalizadas em Qualidade dos dados."],
];

export function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Definições das métricas" onClose={onClose}>
      <dl className="space-y-4">
        {TERMS.map(([t, d]) => (
          <div key={t} className="grid gap-1 sm:grid-cols-[180px_1fr]">
            <dt className="display text-[16px] tracking-[0.04em] text-paper">{t}</dt>
            <dd className="text-[13px] leading-relaxed text-paper-dim">{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
