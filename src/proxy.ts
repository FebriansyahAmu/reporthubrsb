import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/server/auth/tokens";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/server/auth/cookie-names";

const LOGIN_PATH = "/";
const DEFAULT_HOME = "/kunjungan";

/**
 * Proteksi seluruh route (kecuali /api/auth & aset statis, lihat matcher).
 * Next.js 16: konvensi "middleware" diganti menjadi "proxy" (file `src/proxy.ts`,
 * export bernama `proxy`).
 *
 * - Access token valid → lolos.
 * - Access mati tapi ada refresh → alihkan ke /api/auth/refresh (rotasi, Node).
 * - Tidak ada apa-apa → alihkan ke halaman login (/).
 * Berjalan di edge: hanya verifikasi JWT (jose), TANPA akses DB.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const user = access ? await verifyAccessToken(access) : null;

  if (pathname === LOGIN_PATH) {
    if (user) return NextResponse.redirect(new URL(DEFAULT_HOME, req.url));
    return NextResponse.next();
  }

  if (user) return NextResponse.next();

  const target = pathname + search;
  if (req.cookies.get(REFRESH_COOKIE)?.value) {
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("callbackUrl", target);
    return NextResponse.redirect(url);
  }

  const url = new URL("/", req.url);
  url.searchParams.set("callbackUrl", target);
  return NextResponse.redirect(url);
}

export const config = {
  // Lindungi semua kecuali: API auth, aset _next, dan file statis.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|txt|woff|woff2)$).*)",
  ],
};
