// Leitura da planilha pela API oficial do Google Sheets (REST), somente leitura.
// Aceita conta de serviço (recomendado) ou chave de API para planilhas compartilhadas por link.
import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { env, sheetsAuthMode } from "./env";
import type { RawSheet } from "./normalize";
import { LISTS_TAB, OVERVIEW_TAB, PAUTA_TAB } from "./normalize";
import { normKey } from "./text";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const key = await importPKCS8(env.privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env.serviceAccountEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Falha na autenticação com o Google (${res.status}). Verifique a conta de serviço.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Tempo esgotado ao consultar o Google Sheets.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function call<T>(path: string, params: URLSearchParams): Promise<T> {
  const mode = sheetsAuthMode();
  if (mode === "none") throw new Error("Credenciais do Google não configuradas.");
  const headers: Record<string, string> = {};
  if (mode === "service-account") headers.Authorization = `Bearer ${await accessToken()}`;
  else params.set("key", env.apiKey);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.spreadsheetId)}${path}?${params}`;
  const res = await fetchWithTimeout(url, { headers });
  if (!res.ok) {
    const hint =
      res.status === 403
        ? " Compartilhe a planilha com o e-mail da conta de serviço (leitor) ou, se usar chave de API, deixe o link como leitor."
        : res.status === 404
          ? " Confira o GOOGLE_SHEETS_ID."
          : res.status === 429
            ? " Limite de leitura da API atingido; aumente CACHE_TTL_SECONDS."
            : "";
    throw new Error(`Google Sheets respondeu ${res.status}.${hint}`);
  }
  return (await res.json()) as T;
}

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

/**
 * Modo Apps Script: a própria planilha publica um app da web protegido por token
 * (apps-script/california-pauta.gs). Não exige projeto no Google Cloud.
 */
async function fetchViaAppsScript(): Promise<{ title: string; sheets: RawSheet[] }> {
  const url = new URL(env.appsScriptUrl);
  url.searchParams.set("token", env.appsScriptToken);
  const res = await fetchWithTimeout(url.toString(), { redirect: "follow" }, 25_000);
  const text = await res.text();
  let json: { ok?: boolean; error?: string; title?: string; sheets?: RawSheet[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `O Apps Script respondeu ${res.status} sem JSON. Confira se a implantação está como "Qualquer pessoa" e se a URL termina em /exec.`,
    );
  }
  if (!res.ok || !json.ok || !json.sheets) throw new Error(`Apps Script: ${json.error ?? `erro ${res.status}`}.`);
  return { title: json.title ?? "Planilha", sheets: json.sheets };
}

/** Lê o nome da planilha, descobre as guias e baixa todas as relevantes em uma única chamada. */
export async function fetchWorkbook(): Promise<{ title: string; sheets: RawSheet[] }> {
  if (sheetsAuthMode() === "apps-script") return fetchViaAppsScript();
  if (!env.spreadsheetId) throw new Error("GOOGLE_SHEETS_ID não configurado.");
  const meta = await call<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>(
    "",
    new URLSearchParams({ fields: "properties.title,sheets.properties.title" }),
  );
  const titles = meta.sheets
    .map((s) => s.properties.title)
    .filter((t) => PAUTA_TAB.test(t) || normKey(t) === LISTS_TAB || normKey(t) === OVERVIEW_TAB);

  const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  titles.forEach((t) => params.append("ranges", quote(t)));
  const batch = await call<{ valueRanges: { range: string; values?: string[][] }[] }>("/values:batchGet", params);
  const sheets: RawSheet[] = titles.map((title, i) => ({ title, values: batch.valueRanges[i]?.values ?? [] }));
  return { title: meta.properties.title, sheets };
}
