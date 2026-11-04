// Onde o layout compartilhado fica guardado.
//
// "apps-script" (padrão quando há APPS_SCRIPT_URL e não há LAYOUT_FILE): o layout vive nas propriedades
// do Apps Script da planilha. Serve para hospedagens sem disco permanente, como o Render grátis.
// "file": arquivo JSON (LAYOUT_FILE), para quem tem volume montado.
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";

type Mode = "apps-script" | "file";

export function layoutStoreMode(): Mode {
  const forced = (process.env.LAYOUT_STORE ?? "").toLowerCase();
  if (forced === "file" || forced === "apps-script") return forced;
  if (process.env.LAYOUT_FILE) return "file";
  return env.appsScriptUrl && env.appsScriptToken ? "apps-script" : "file";
}

function layoutFile() {
  return process.env.LAYOUT_FILE || path.join(process.cwd(), ".data", "layout.json");
}

// Cache curto em memória: evita uma ida ao Apps Script a cada abertura de página.
const g = globalThis as unknown as { __ciLayoutRaw?: { raw: string | null; at: number } };
const TTL = 60_000;

async function scriptGet(): Promise<string | null> {
  const url = new URL(env.appsScriptUrl);
  url.searchParams.set("token", env.appsScriptToken);
  url.searchParams.set("action", "layout");
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  const json = (await res.json()) as { ok?: boolean; layout?: string | null; error?: string };
  if (!json.ok) throw new Error(`Apps Script: ${json.error ?? res.status}`);
  return json.layout ?? null;
}

async function scriptPut(raw: string) {
  const res = await fetch(env.appsScriptUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: env.appsScriptToken, action: "saveLayout", layout: raw }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!json.ok) throw new Error(`Apps Script: ${json.error ?? `erro ${res.status}`}`);
}

/** Texto JSON do layout salvo, ou null quando ainda não há nenhum. */
export async function readLayoutRaw(): Promise<string | null> {
  if (layoutStoreMode() === "file") {
    try {
      return await fs.readFile(layoutFile(), "utf8");
    } catch {
      return null;
    }
  }
  const c = g.__ciLayoutRaw;
  if (c && Date.now() - c.at < TTL) return c.raw;
  try {
    const raw = await scriptGet();
    g.__ciLayoutRaw = { raw, at: Date.now() };
    return raw;
  } catch (e) {
    console.error("[layout] falha ao ler do Apps Script", e);
    return c?.raw ?? null;
  }
}

export async function writeLayoutRaw(raw: string) {
  if (layoutStoreMode() === "file") {
    const file = layoutFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, raw);
    await fs.rename(tmp, file);
    return;
  }
  await scriptPut(raw);
  g.__ciLayoutRaw = { raw, at: Date.now() };
}
