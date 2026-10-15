import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/data-service";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const lastForce = new Map<string, number>();

export async function GET(req: NextRequest) {
  // Defesa em profundidade: o middleware já protege, mas a rota valida a sessão de novo.
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  }
  let force = req.nextUrl.searchParams.get("force") === "1";
  if (force) {
    // Evita que cliques repetidos esgotem a cota da API: no máximo uma leitura forçada a cada 10 s.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    const last = lastForce.get(ip) ?? 0;
    if (Date.now() - last < 10_000) force = false;
    else lastForce.set(ip, Date.now());
  }
  const since = req.nextUrl.searchParams.get("v");
  const res = await getDataset(force);
  if (res.ok && res.data && since && since === res.data.version) {
    return NextResponse.json(
      { ok: true, unchanged: true, version: res.data.version, syncedAt: res.data.syncedAt, stale: res.stale, error: res.error },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
