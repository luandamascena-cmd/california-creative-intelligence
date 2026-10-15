// Verificação de saúde pública: informa apenas se a leitura da planilha está funcionando.
import { NextResponse } from "next/server";
import { getDataset } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await getDataset();
  return NextResponse.json(
    { ok: r.ok && !r.stale, source: r.data?.source ?? null, syncedAt: r.data?.syncedAt ?? null },
    { status: r.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
