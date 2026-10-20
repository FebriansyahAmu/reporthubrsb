import "server-only";
import { cookies } from "next/headers";
import type { AturanSesi } from "@/lib/sesi";
import { verifyAccessToken, verifyRefreshToken, type AccessClaims } from "./tokens";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookies";
import { batasSesiSec, jedaSegarkanMs } from "./batas-sesi";
import { menitIdle } from "./idle";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: string;
};

/**
 * Ambil user dari access token (cookie httpOnly) untuk Server Component.
 * Mengembalikan null bila belum login / token invalid/kadaluarsa.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims: AccessClaims | null = await verifyAccessToken(token);
  if (!claims) return null;
  return { id: claims.sub, username: claims.username, name: claims.name, role: claims.role };
}

/**
 * Aturan sesi untuk `PenjagaSesi` di klien. Batas mutlak dikirim sebagai SISA
 * waktu (bukan jam dinding) agar jam PC yang melenceng tidak membuat pengguna
 * keluar terlalu cepat atau terlambat.
 */
export async function aturanSesiKlien(): Promise<AturanSesi> {
  const raw = (await cookies()).get(REFRESH_COOKIE)?.value;
  const claims = raw ? await verifyRefreshToken(raw) : null;
  const batas = claims ? batasSesiSec(claims.authTime) : null;
  return {
    menitIdle: menitIdle(),
    jedaSegarkanMs: jedaSegarkanMs(),
    sisaSesiMs: batas === null ? null : batas * 1000 - Date.now(),
  };
}
