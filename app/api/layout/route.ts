import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SESSION_COOKIE, sessionRole } from "@/lib/session";
import { DEFAULT_LAYOUT, sanitizeLayout, type SharedLayout } from "@/lib/layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arquivo do layout compartilhado. No Railway fica no volume montado em /data, que sobrevive a novos deploys. */
function layoutFile() {
  return process.env.LAYOUT_FILE || path.join(process.cwd(), ".data", "layout.json");
}

/**
 * Ajustes pedidos depois que o layout já tinha sido salvo. Cada um roda uma única vez sobre o arquivo
 * e fica registrado em `migrations`, então o que o administrador mudar depois é respeitado.
 */
const MIGRATIONS: { id: string; apply: (l: SharedLayout) => SharedLayout }[] = [
  {
    id: "2026-10-19-carga-por-colaborador-inteira",
    apply: (l) => ({ ...l, dashboard: l.dashboard.map((w) => (w.chart === "workload" ? { ...w, span: 12 } : w)) }),
  },
  {
    // O status subiu para a abertura da página, ao lado do número de projetos.
    id: "2026-10-19-status-na-abertura",
    apply: (l) => ({ ...l, dashboard: l.dashboard.filter((w) => w.chart !== "status") }),
  },
];

async function writeLayout(layout: SharedLayout) {
  const file = layoutFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(layout, null, 2));
  await fs.rename(tmp, file);
}

async function readLayout(): Promise<SharedLayout> {
  let raw: string;
  try {
    raw = await fs.readFile(layoutFile(), "utf8");
  } catch {
    return DEFAULT_LAYOUT;
  }
  let layout = sanitizeLayout(JSON.parse(raw));
  const pending = MIGRATIONS.filter((m) => !layout.migrations?.includes(m.id));
  if (pending.length) {
    pending.forEach((m) => (layout = m.apply(layout)));
    layout = { ...layout, migrations: [...(layout.migrations ?? []), ...pending.map((m) => m.id)] };
    await writeLayout(layout).catch((e) => console.error("[layout] falha ao aplicar ajuste", e));
    console.log(`[layout] ajustes aplicados: ${pending.map((m) => m.id).join(", ")}`);
  }
  return layout;
}

export async function GET(req: NextRequest) {
  const role = await sessionRole(req.cookies.get(SESSION_COOKIE)?.value);
  if (!role) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ ok: true, layout: await readLayout(), canEdit: role === "admin" }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const role = await sessionRole(req.cookies.get(SESSION_COOKIE)?.value);
  if (role !== "admin") return NextResponse.json({ ok: false, error: "Apenas o administrador pode alterar o layout." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Layout inválido." }, { status: 400 });
  // Um layout salvo agora já reflete todos os ajustes: nenhum deles deve rodar por cima depois.
  const layout = { ...sanitizeLayout(body), updatedAt: new Date().toISOString(), migrations: MIGRATIONS.map((m) => m.id) };
  try {
    await writeLayout(layout);
  } catch (e) {
    console.error("[layout] falha ao salvar", e);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar o layout no servidor." }, { status: 500 });
  }
  console.log(`[layout] salvo: ${layout.dashboard.length} gráficos na dashboard, ${layout.panorama.length} no Panorama`);
  return NextResponse.json({ ok: true, layout });
}
