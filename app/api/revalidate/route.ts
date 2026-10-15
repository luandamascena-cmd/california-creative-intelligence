// Webhook chamado pelo Google Apps Script quando a planilha é editada.
// Invalida o cache para que a próxima sincronização dos navegadores traga os dados novos.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { invalidateCache } from "@/lib/data-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET ?? "";
  const given = req.headers.get("x-webhook-secret") ?? "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (secret.length < 16 || !timingSafeEqual(h(given), h(secret))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  invalidateCache();
  return NextResponse.json({ ok: true, invalidatedAt: new Date().toISOString() });
}
