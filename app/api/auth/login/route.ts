import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { createSession, SESSION_COOKIE, SESSION_HOURS } from "@/lib/session";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; until: number }>();
const MAX = 8;
const WINDOW = 10 * 60_000;

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (expected.length < 8) {
    return NextResponse.json({ ok: false, error: "Senha de acesso não configurada no servidor." }, { status: 500 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const a = attempts.get(ip);
  if (a && a.count >= MAX && a.until > Date.now()) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const given = digest(String(body.password ?? ""));
  const admin = process.env.ADMIN_PASSWORD ?? "";
  const isAdmin = admin.length >= 8 && timingSafeEqual(given, digest(admin));
  const ok = isAdmin || timingSafeEqual(given, digest(expected));
  if (!ok) {
    const cur = a && a.until > Date.now() ? a : { count: 0, until: Date.now() + WINDOW };
    cur.count++;
    attempts.set(ip, cur);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(isAdmin ? "admin" : "viewer"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
