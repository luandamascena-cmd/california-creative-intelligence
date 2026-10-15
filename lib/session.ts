// Sessões assinadas (JWT HS256) em cookie httpOnly. Funciona no Edge (middleware) e no Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ci_session";
export const SESSION_HOURS = 12;

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou com menos de 32 caracteres.");
  return new TextEncoder().encode(s);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ scope: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setIssuer("california-ci")
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { issuer: "california-ci", algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
