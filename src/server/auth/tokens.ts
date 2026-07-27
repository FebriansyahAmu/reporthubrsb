/**
 * JWT access & refresh token (jose). File ini **edge-safe** (hanya jose + env),
 * sehingga boleh dipakai di middleware. Jangan tambahkan impor Node-only di sini.
 */
import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function accessSecret(): Uint8Array {
  const s = process.env.AUTH_ACCESS_SECRET;
  if (!s) throw new Error("AUTH_ACCESS_SECRET belum di-set.");
  return encoder.encode(s);
}
function refreshSecret(): Uint8Array {
  const s = process.env.AUTH_REFRESH_SECRET;
  if (!s) throw new Error("AUTH_REFRESH_SECRET belum di-set.");
  return encoder.encode(s);
}

const ACCESS_TTL_MIN = Number(process.env.AUTH_ACCESS_TTL_MIN) || 15;
const REFRESH_TTL_DAYS = Number(process.env.AUTH_REFRESH_TTL_DAYS) || 7;

export const ACCESS_TTL_SEC = ACCESS_TTL_MIN * 60;
export const REFRESH_TTL_SEC = REFRESH_TTL_DAYS * 24 * 60 * 60;
export const REFRESH_TTL_MS = REFRESH_TTL_SEC * 1000;

export type AccessClaims = {
  sub: string;
  username: string;
  name: string;
  role: string;
};

export async function signAccessToken(c: AccessClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ username: c.username, name: c.name, role: c.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(c.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SEC)
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return {
      sub: String(payload.sub),
      username: String(payload.username ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "VIEWER"),
    };
  } catch {
    return null;
  }
}

export async function signRefreshToken(sub: string, jti: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SEC)
    .sign(refreshSecret());
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ sub: string; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return { sub: String(payload.sub), jti: String(payload.jti ?? "") };
  } catch {
    return null;
  }
}
