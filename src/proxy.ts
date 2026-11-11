import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/server/auth/tokens";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/server/auth/cookie-names";
import { buatPembatasLaju, kunciIpKlien } from "@/server/lib/rate-limit";
import { HEADER_PUBLIK, buatNonce, cspPublik } from "@/server/lib/security-headers";
import { RUTE_PUBLIK_RUANG } from "@/server/modules/inventaris/publik.schema";
import { cocokRuteTtdSiaga, diBawahTtdSiaga, RUTE_TTD_SIAGA } from "@/server/modules/ttd-siaga/rute";
import { JALUR_BERANDA } from "@/lib/jalur";

const LOGIN_PATH = "/";
/** Beranda memilih modul pertama yang diizinkan peran (proxy tak mengakses DB). */
const DEFAULT_HOME = JALUR_BERANDA;

/**
 * Rute publik (tanpa login) tanpa penjaga halaman: `/api/desktop` — manifest
 * pembaruan & installer aplikasi desktop (updater tak membawa cookie; tanpa
 * data pasien; paket diverifikasi tanda tangan di klien).
 */
const PUBLIC_PREFIXES = ["/api/desktop"];

/** Halaman TTD jarak jauh yang dibuka pasien/keluarga lewat QR di HP (`/sign/<token>`). */
const HALAMAN_SIGN = "/sign";

/**
 * Satu-satunya API "Via HP" yang publik: HP MENGIRIM TTD (`POST
 * /api/sign/<token>`; token di QR = hak mengirim, bukan membaca). Buat sesi,
 * status, dan ambil PNG milik sesi PC pembuat → dijaga proxy seperti API lain.
 */
const KIRIM_TTD_HP = /^\/api\/sign\/[A-Za-z0-9_-]{32}$/;

const cocokPrefiks = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`);

/**
 * Halaman publik bertoken — daftar barang ruangan (QR inventaris,
 * `/ruang/<token>`) dan TTD via HP (`/sign/<token>`, memuat nama pasien) —
 * tanpa login, jadi dijaga berlapis di sini sebelum halaman dirender:
 * hanya GET/HEAD, pembatas laju per IP + global (redam tebak token &
 * penyedotan data), CSP ber-nonce + header keamanan (noindex, no-referrer,
 * tanpa iframe, tanpa cache). Kuota laju per halaman terpisah.
 */
const lajuPublikPerIp = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });
const lajuSignPerIp = buatPembatasLaju({ batas: 60, jendelaMs: 60_000 });
const lajuPublikGlobal = buatPembatasLaju({ batas: 1200, jendelaMs: 60_000, maksKunci: 1 });

function tolakPublik(status: number, pesan: string, ekstra: Record<string, string> = {}): NextResponse {
  const res = new NextResponse(pesan, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...ekstra } });
  for (const [k, v] of Object.entries(HEADER_PUBLIK)) res.headers.set(k, v);
  res.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  return res;
}

function halamanPublik(req: NextRequest, lajuPerIp: typeof lajuPublikPerIp): NextResponse {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return tolakPublik(405, "Metode tidak diizinkan.", { Allow: "GET, HEAD" });
  }
  const laju = lajuPerIp(kunciIpKlien(req.headers));
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
 * Tablet TTD siaga (`/ttd-siaga`, `/api/ttd-siaga/*`, docs/PRD_TTD_Perangkat_Siaga.md
 * §7.4) — tanpa sesi PENGGUNA; route handler memeriksa kredensial PERANGKAT.
 * Di sini: daftar rute TERTUTUP (tak terdaftar → 404, metode lain → 405), laju
 * per IP per rute + global, CSP ber-nonce untuk halaman, header keamanan.
 */
const lajuTtdSiaga = new Map(
  RUTE_TTD_SIAGA.map((r) => [r.nama, buatPembatasLaju({ batas: r.lajuPerMenit, jendelaMs: 60_000 })] as const),
);
const lajuTtdSiagaGlobal = buatPembatasLaju({ batas: 3000, jendelaMs: 60_000, maksKunci: 1 });

function jagaTtdSiaga(req: NextRequest): NextResponse {
  const hasil = cocokRuteTtdSiaga(req.nextUrl.pathname, req.method);
  if (hasil.jenis === "tak-ada") return tolakPublik(404, "Tidak ditemukan.");
  if (hasil.jenis === "metode") return tolakPublik(405, "Metode tidak diizinkan.", { Allow: hasil.rute.metode.join(", ") });

  const laju = lajuTtdSiaga.get(hasil.rute.nama)!(kunciIpKlien(req.headers));
  const lolos = laju.izin ? lajuTtdSiagaGlobal("*") : laju;
  if (!lolos.izin) {
    return tolakPublik(429, `Terlalu banyak permintaan. Coba lagi dalam ${lolos.ulangDetik} detik.`, {
      "Retry-After": String(lolos.ulangDetik),
    });
  }

  if (!hasil.rute.halaman) {
    // API/SSE: Cache-Control & Content-Type diatur route handler (aliran butuh `no-transform`).
    const res = NextResponse.next();
    for (const k of ["X-Robots-Tag", "Referrer-Policy", "X-Content-Type-Options", "Cross-Origin-Resource-Policy"]) {
      res.headers.set(k, HEADER_PUBLIK[k]);
    }
    return res;
  }

  const csp = cspPublik(buatNonce(), {
    dev: process.env.NODE_ENV === "development",
    https: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
  });
  const headers = new Headers(req.headers);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(HEADER_PUBLIK)) res.headers.set(k, v);
  // Layar siaga boleh menahan layar tetap menyala (Screen Wake Lock); izin lain tetap mati.
  res.headers.set("Permissions-Policy", `${HEADER_PUBLIK["Permissions-Policy"]}, screen-wake-lock=(self)`);
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

  if (cocokPrefiks(pathname, RUTE_PUBLIK_RUANG)) return halamanPublik(req, lajuPublikPerIp);
  if (cocokPrefiks(pathname, HALAMAN_SIGN)) return halamanPublik(req, lajuSignPerIp);
  if (diBawahTtdSiaga(pathname)) return jagaTtdSiaga(req);
  if (PUBLIC_PREFIXES.some((p) => cocokPrefiks(pathname, p))) return NextResponse.next();
  if (req.method === "POST" && KIRIM_TTD_HP.test(pathname)) return NextResponse.next();

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const user = access ? await verifyAccessToken(access) : null;

  if (pathname === LOGIN_PATH) {
    if (user) return NextResponse.redirect(new URL(DEFAULT_HOME, req.url));
    return NextResponse.next();
  }

  if (user) return NextResponse.next();

  const target = pathname + search;
  if (req.cookies.get(REFRESH_COOKIE)?.value) {
    // 307 untuk semua metode: route refresh merotasi lalu mengalihkan balik dengan
    // metode & body yang sama (PATCH/POST/DELETE fetch ikut pulih).
    const url = new URL("/api/auth/refresh", req.url);
    url.searchParams.set("callbackUrl", target);
    return NextResponse.redirect(url, 307);
  }

  // API tanpa sesi → 401 JSON. Dialihkan ke halaman login, fetch menerima HTML 200
  // dan klien mengira simpan/aksinya berhasil.
  if (cocokPrefiks(pathname, "/api")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi berakhir. Silakan masuk kembali." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL("/", req.url);
  url.searchParams.set("callbackUrl", target);
  return NextResponse.redirect(url);
}

export const config = {
  // Lindungi semua kecuali: API auth, aset _next, dan file statis — termasuk
  // manifest PWA (diambil browser TANPA cookie) & service worker `/sw.js`.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|txt|woff|woff2|webmanifest)$).*)",
  ],
};
