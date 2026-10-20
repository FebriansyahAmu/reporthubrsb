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

export const MENIT_REFRESH_BAWAAN = 60;
const MENIT_REFRESH_MAKS = 7 * 24 * 60;

/**
 * `AUTH_REFRESH_TTL_MIN` (masa refresh token, bergeser setiap rotasi): kosong/tak
 * sah → 60; dijepit 2× masa access … 7 hari. Selama tab aplikasi terbuka, sesi
 * disegarkan di latar (lihat `batas-sesi.ts`), jadi masa ini hanya terasa saat
 * browser/PC ditutup atau tidur. (`AUTH_REFRESH_TTL_DAYS` lama tidak dipakai lagi.)
 */
export function bacaMenitRefresh(raw: string | undefined, menitAkses = ACCESS_TTL_MIN): number {
  const n = Number(raw?.trim());
  if (!raw?.trim() || !Number.isInteger(n) || n <= 0) return Math.max(MENIT_REFRESH_BAWAAN, menitAkses * 2);
  return Math.min(Math.max(n, menitAkses * 2), MENIT_REFRESH_MAKS);
}

export const ACCESS_TTL_SEC = ACCESS_TTL_MIN * 60;
export const REFRESH_TTL_SEC = bacaMenitRefresh(process.env.AUTH_REFRESH_TTL_MIN) * 60;
export const REFRESH_TTL_MS = REFRESH_TTL_SEC * 1000;

/** `exp` = masa token, tetapi tak pernah melewati batas mutlak sesi (detik epoch; null = tanpa batas). */
function kedaluwarsa(sekarang: number, ttl: number, batasSec: number | null | undefined): number {
  return batasSec ? Math.min(sekarang + ttl, batasSec) : sekarang + ttl;
}

export type AccessClaims = {
  sub: string;
  username: string;
  name: string;
  role: string;
};

export async function signAccessToken(c: AccessClaims, batasSec?: number | null): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ username: c.username, name: c.name, role: c.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(c.sub)
    .setIssuedAt(now)
    .setExpirationTime(kedaluwarsa(now, ACCESS_TTL_SEC, batasSec))
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

/**
 * `auth_time` = saat pengguna memasukkan kata sandi (detik), dibawa utuh dari
 * rotasi ke rotasi → dasar batas mutlak sesi.
 */
export async function signRefreshToken(
  sub: string,
  jti: string,
  mulaiSec: number,
  batasSec?: number | null,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ auth_time: mulaiSec })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(kedaluwarsa(now, REFRESH_TTL_SEC, batasSec))
    .sign(refreshSecret());
}

export type RefreshClaims = { sub: string; jti: string; iat: number; authTime: number };

/**
 * `iat` = waktu terbit (detik) — ditandatangani, jadi aman dipakai untuk batas
 * idle sesi. Token lama tanpa `auth_time` → `iat` (sesinya dihitung sejak rotasi terakhir).
 */
export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    const iat = Number(payload.iat ?? 0);
    const authTime = Number(payload.auth_time);
    return {
      sub: String(payload.sub),
      jti: String(payload.jti ?? ""),
      iat,
      authTime: Number.isInteger(authTime) && authTime > 0 && authTime <= iat ? authTime : iat,
    };
  } catch {
    return null;
  }
}
