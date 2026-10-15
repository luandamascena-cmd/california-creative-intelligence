// Leitura centralizada das variáveis de ambiente (somente no servidor).
import "server-only";

const num = (v: string | undefined, fallback: number, min: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
};

export const env = {
  spreadsheetId: process.env.GOOGLE_SHEETS_ID ?? "",
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  privateKey: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  apiKey: process.env.GOOGLE_API_KEY ?? "",
  /** URL do app da web publicado pelo Apps Script da própria planilha (dispensa Google Cloud). */
  appsScriptUrl: process.env.APPS_SCRIPT_URL ?? "",
  appsScriptToken: process.env.APPS_SCRIPT_TOKEN ?? "",
  dataSource: (process.env.DATA_SOURCE ?? "sheets").toLowerCase() as "sheets" | "demo",
  /** Tempo de vida do cache no servidor, em segundos. */
  cacheTtl: num(process.env.CACHE_TTL_SECONDS, 30, 10),
  /** Intervalo de atualização automática no navegador, em segundos. */
  refreshSeconds: num(process.env.REFRESH_SECONDS, 45, 15),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
};

export function sheetsAuthMode(): "apps-script" | "service-account" | "api-key" | "none" {
  if (env.appsScriptUrl && env.appsScriptToken) return "apps-script";
  if (env.serviceAccountEmail && env.privateKey) return "service-account";
  if (env.apiKey) return "api-key";
  return "none";
}
