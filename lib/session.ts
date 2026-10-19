// Sessões assinadas (JWT HS256) em cookie httpOnly. Funciona no Edge (middleware) e no Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ci_session";
export const SESSION_HOURS = 12;

/** viewer: senha de acesso geral. admin: senha de administrador, pode salvar o layout compartilhado. */
export type Role = "viewer" | "admin";

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou com menos de 32 caracteres.");
  return new TextEncoder().encode(s);
}

export async function createSession(role: Role = "viewer"): Promise<string> {
  return new SignJWT({ scope: "dashboard", role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setIssuer("california-ci")
    .sign(secretKey());
}

/** Papel da sessão, ou null se o token for inválido ou estiver vencido. */
export async function sessionRole(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "california-ci", algorithms: ["HS256"] });
    return payload.role === "admin" ? "admin" : "viewer";
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  return (await sessionRole(token)) !== null;
}
