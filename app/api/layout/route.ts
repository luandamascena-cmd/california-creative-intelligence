import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SESSION_COOKIE, sessionRole } from "@/lib/session";
import { DEFAULT_LAYOUT, sanitizeLayout } from "@/lib/layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arquivo do layout compartilhado. No Railway fica no volume montado em /data, que sobrevive a novos deploys. */
function layoutFile() {
  return process.env.LAYOUT_FILE || path.join(process.cwd(), ".data", "layout.json");
}

async function readLayout() {
  try {
    return sanitizeLayout(JSON.parse(await fs.readFile(layoutFile(), "utf8")));
  } catch {
    return DEFAULT_LAYOUT;
  }
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
  const layout = { ...sanitizeLayout(body), updatedAt: new Date().toISOString() };
  const file = layoutFile();
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(layout, null, 2));
    await fs.rename(tmp, file);
  } catch (e) {
    console.error("[layout] falha ao salvar", e);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar o layout no servidor." }, { status: 500 });
  }
  console.log(`[layout] salvo: ${layout.dashboard.length} gráficos na dashboard, ${layout.panorama.length} no Panorama`);
  return NextResponse.json({ ok: true, layout });
}
