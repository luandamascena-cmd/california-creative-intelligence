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
  if (cache && fresh && !force) return { ok: true, data: cache.data };

  try {
    g.__ciInflight ??= build().finally(() => (g.__ciInflight = null));
    const data = await g.__ciInflight;
    g.__ciCache = { data, fetchedAt: Date.now() };
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido ao ler a planilha.";
    console.error("[sync]", message);
    if (cache) return { ok: true, data: cache.data, stale: true, error: message };
    return { ok: false, error: message };
  }
}
