import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/server/auth/tokens";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/server/auth/cookie-names";
import { buatPembatasLaju, kunciIpKlien } from "@/server/lib/rate-limit";
import { HEADER_PUBLIK, buatNonce, cspPublik } from "@/server/lib/security-headers";
import { RUTE_PUBLIK_RUANG } from "@/server/modules/inventaris/publik.schema";

const LOGIN_PATH = "/";
const DEFAULT_HOME = "/dashboard";

/**
 * Rute publik (tanpa login): halaman TTD jarak jauh yang dibuka pasien/keluarga
 * lewat HP + endpoint token-nya. Kapabilitas dijaga oleh token acak, bukan sesi.
 * `POST /api/sign/create` tetap wajib login — dijaga di dalam handler-nya sendiri.
 */
const PUBLIC_PREFIXES = ["/sign", "/api/sign"];

const cocokPrefiks = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`);

/**
 * Halaman publik daftar barang ruangan (QR inventaris, `/ruang/<token>`) —
 * tanpa login, jadi dijaga berlapis di sini sebelum halaman dirender:
 * hanya GET/HEAD, pembatas laju per IP + global (redam tebak token &
 * penyedotan data), CSP ber-nonce + header keamanan (noindex, no-referrer,
 * tanpa iframe, tanpa cache).
 */
const lajuPublikPerIp = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });
const lajuPublikGlobal = buatPembatasLaju({ batas: 1200, jendelaMs: 60_000, maksKunci: 1 });

function tolakPublik(status: number, pesan: string, ekstra: Record<string, string> = {}): NextResponse {
  const res = new NextResponse(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...ekstra } });
  for (const [k, v] of Object.entries(HEADER_PUBLIK)) res.headers.set(k, v);
  res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  return res;
}

function halamanPublikInventaris(req: NextRequest): NextResponse {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return tolakPublik(405, "Metode tidak diizinkan.", { Allow: "GET, HEAD" });
  }
  const laju = lajuPublikPerIp(kunciIpKlien(req.headers));
  const hasil = laju.izin ? lajuPublikGlobal("*") : laju;
  if (!hasil.izin) {
    return tolakPublik(429, `Terlalu banyak permintaan. Coba lagi dalam ${hasil.ulangDetik} detik.`, {
      "Retry-After": String(hasil.ulangDetik),
    });
  }

  const csp = cspPublik(buatNonce(), {
    dev: process.env.NODE_ENV === "development",
    https: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
  });
  // Next membaca nonce dari header CSP *request* lalu menempelkannya ke skripnya.
  const headers = new Headers(req.headers);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(HEADER_PUBLIK)) res.headers.set(k, v);
  return res;
}

/**
 * Proteksi seluruh route (kecuali /api/auth & aset statis, lihat matcher).
 * Next.js 16: konvensi "middleware" diganti menjadi "proxy" (file `src/proxy.ts`,
 * export bernama `proxy`).
 *
 * - Access token valid → lolos.
 * - Access mati tapi ada refresh → alihkan ke /api/auth/refresh (rotasi, Node).
 * - Tidak ada apa-apa → alihkan ke halaman login (/).
 * Runtime Node.js (default proxy Next 16): hanya verifikasi JWT (jose), TANPA akses DB.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (cocokPrefiks(pathname, RUTE_PUBLIK_RUANG)) return halamanPublikInventaris(req);
  if (PUBLIC_PREFIXES.some((p) => cocokPrefiks(pathname, p))) return NextResponse.next();

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
