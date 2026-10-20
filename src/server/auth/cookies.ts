import "server-only";
import { decodeJwt } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC } from "./tokens";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookie-names";

export { ACCESS_COOKIE, REFRESH_COOKIE };

/** Secure hanya bila koneksi HTTPS — supaya tetap jalan saat dev HTTP di LAN. */
export function isSecureRequest(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
}

/**
 * Umur cookie = sisa `exp` token (bisa lebih pendek dari masa token bila
 * dipotong batas mutlak sesi), sehingga browser membuang cookie bersamaan
 * dengan tokennya. Token yang baru ditandatangani selalu punya `exp`.
 */
function umurCookie(token: string, cadangan: number): number {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp === "number") return Math.max(0, exp - Math.floor(Date.now() / 1000));
  } catch {
    // Bukan JWT: pakai masa bawaan.
  }
  return cadangan;
}

/** Set cookie access + refresh (httpOnly, sameSite=lax, secure sesuai koneksi). */
export function setAuthCookies(
  res: NextResponse,
  tokens: { access: string; refresh: string },
  secure: boolean,
): void {
  const common = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  res.cookies.set(ACCESS_COOKIE, tokens.access, { ...common, maxAge: umurCookie(tokens.access, ACCESS_TTL_SEC) });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...common, maxAge: umurCookie(tokens.refresh, REFRESH_TTL_SEC) });
}

/** Hapus cookie auth (logout / sesi invalid). */
export function clearAuthCookies(res: NextResponse): void {
  const common = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set(ACCESS_COOKIE, "", common);
  res.cookies.set(REFRESH_COOKIE, "", common);
}
