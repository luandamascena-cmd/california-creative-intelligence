// Orquestra leitura, normalização e cache. Uma única leitura da planilha atende todos os usuários.
import "server-only";
import { createHash } from "node:crypto";
import { env, sheetsAuthMode } from "./env";
import { fetchWorkbook } from "./google";
import { normalizeWorkbook } from "./normalize";
import type { Dataset, DataResponse } from "./types";
import snapshot from "@/data/demo-snapshot.json";

type Cache = { data: Dataset; fetchedAt: number } | null;

const g = globalThis as unknown as { __ciCache?: Cache; __ciInflight?: Promise<Dataset> | null };
g.__ciCache ??= null;
g.__ciInflight ??= null;

async function build(): Promise<Dataset> {
  const demo = env.dataSource === "demo";
  const wb = demo
    ? { title: snapshot.spreadsheetTitle, sheets: snapshot.sheets as { title: string; values: string[][] }[] }
    : await fetchWorkbook();
  const now = new Date();
  const result = normalizeWorkbook(wb.sheets, now);
  const version = createHash("sha1")
    .update(JSON.stringify([result.demands, result.tabs, result.issues.length]))
    .digest("hex")
    .slice(0, 16);
  return {
    version,
    syncedAt: now.toISOString(),
    source: demo ? "demo" : "google-sheets",
    sourceLabel: demo ? snapshot.label : "Google Sheets",
    spreadsheetTitle: wb.title,
    refreshSeconds: env.refreshSeconds,
    ...result,
  };
}

export function invalidateCache() {
  if (g.__ciCache) g.__ciCache.fetchedAt = 0;
}

const gx = globalThis as unknown as { __ciLastError?: { message: string; at: number } | null };
gx.__ciLastError ??= null;

/** Lê a planilha, guarda no cache e registra o resultado. Uma leitura por vez. */
function refresh(): Promise<Dataset> {
  if (!g.__ciInflight) {
    const t0 = Date.now();
    g.__ciInflight = build()
      .then((data) => {
        g.__ciCache = { data, fetchedAt: Date.now() };
        gx.__ciLastError = null;
        console.log(`[sync] ok em ${((Date.now() - t0) / 1000).toFixed(1)} s: ${data.demands.length} demandas, ${data.tabs.length} guias`);
        return data;
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Erro desconhecido ao ler a planilha.";
        gx.__ciLastError = { message, at: Date.now() };
        console.error(`[sync] falha após ${((Date.now() - t0) / 1000).toFixed(1)} s: ${message}`);
        throw e;
      })
      .finally(() => (g.__ciInflight = null));
  }
  return g.__ciInflight;
}

/**
 * Estratégia "mostra o que tem e atualiza por trás": quem abre a dashboard nunca espera
 * a planilha responder, exceto na primeira leitura do servidor ou num pedido manual.
 */
export async function getDataset(force = false): Promise<DataResponse> {
  if (env.dataSource !== "demo" && sheetsAuthMode() === "none") {
    return {
      ok: false,
      error:
        "Integração não configurada. Defina APPS_SCRIPT_URL e APPS_SCRIPT_TOKEN (ou as credenciais do Google Cloud). Para visualizar a interface sem credenciais, use DATA_SOURCE=demo.",
    };
  }
  const cache = g.__ciCache;
  const fresh = cache && Date.now() - cache.fetchedAt < env.cacheTtl * 1000;
  const staleInfo = () => {
    const err = gx.__ciLastError;
    // Só sinaliza problema se as falhas persistirem por mais de 3 minutos.
    return err && cache && err.at > cache.fetchedAt && Date.now() - cache.fetchedAt > 180_000
      ? { stale: true, error: err.message }
      : {};
  };

  if (cache && !force) {
    if (!fresh) refresh().catch(() => {});
    return { ok: true, data: cache.data, ...staleInfo() };
  }
  try {
    const data = await refresh();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao ler a planilha.";
    if (cache) return { ok: true, data: cache.data, ...staleInfo() };
    return { ok: false, error: message };
  }
}
