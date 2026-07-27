import "server-only";
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

/** Set cookie access + refresh (httpOnly, sameSite=lax, secure sesuai koneksi). */
export function setAuthCookies(
  res: NextResponse,
  tokens: { access: string; refresh: string },
  secure: boolean,
): void {
  const common = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  res.cookies.set(ACCESS_COOKIE, tokens.access, { ...common, maxAge: ACCESS_TTL_SEC });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...common, maxAge: REFRESH_TTL_SEC });
}

/** Hapus cookie auth (logout / sesi invalid). */
export function clearAuthCookies(res: NextResponse): void {
  const common = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set(ACCESS_COOKIE, "", common);
  res.cookies.set(REFRESH_COOKIE, "", common);
}
