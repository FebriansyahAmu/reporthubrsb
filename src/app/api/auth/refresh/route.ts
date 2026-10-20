import { NextRequest, NextResponse } from "next/server";
import { SesiBatasError, SesiIdleError, refresh, type IssuedTokens } from "@/server/modules/auth/auth.service";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  isSecureRequest,
  setAuthCookies,
} from "@/server/auth/cookies";
import { fail } from "@/server/lib/http";
import { AppError, ServiceUnavailableError, UnauthorizedError } from "@/server/lib/errors";
import { JALUR_BERANDA, jalurInternal } from "@/lib/jalur";

export const runtime = "nodejs";

function meta(req: NextRequest) {
  return {
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/** Callback hanya boleh path internal (cegah open-redirect, termasuk `/\host`). */
const callbackDari = (req: NextRequest) => jalurInternal(req.nextUrl.searchParams.get("callbackUrl"));
const keApi = (p: string) => p.startsWith("/api/");

/** Sisa waktu (ms) sampai batas mutlak — relatif, kebal jam PC yang melenceng. */
const infoSesi = (issued: IssuedTokens) => ({
  sisaMs: issued.batasSesi === null ? null : Math.max(0, issued.batasSesi - Date.now()),
});

/**
 * Gangguan sementara (DB tersendat, dsb.) bukan alasan mengakhiri sesi: cookie
 * dibiarkan dan jawabannya 503, sehingga penyegaran latar / permintaan berikutnya
 * bisa mencoba lagi. Hanya penolakan sesi (401) yang menghapus cookie.
 */
const ditolak = (err: unknown) => err instanceof UnauthorizedError;
const GANGGUAN = "Sesi tidak dapat diperbarui saat ini. Coba lagi sebentar.";

/**
 * Dipakai proxy saat access token habis: rotasi lalu alihkan balik ke tujuan.
 * 307 → browser mengulang metode & body asli (PATCH/POST/DELETE fetch API ikut
 * pulih, tidak lagi 405 / "berhasil" palsu). Sesi ditolak: tujuan API → 401 JSON
 * (klien tidak pernah menerima halaman login sebagai jawaban); tujuan halaman → login.
 */
async function rotasiLaluAlihkan(req: NextRequest, tujuan: string): Promise<NextResponse> {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new UnauthorizedError();
    const issued = await refresh(raw, meta(req));
    // Lapis kedua: tujuan yang sudah di-resolve wajib tetap di origin ini.
    const asal = new URL(req.url);
    const ke = new URL(tujuan, asal);
    const res = NextResponse.redirect(ke.origin === asal.origin ? ke : new URL(JALUR_BERANDA, asal), 307);
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[AUTH] rotasi refresh gagal", err);
    if (!ditolak(err)) {
      // Halaman: teks polos tanpa data apa pun; dialihkan ke mana pun akan berputar kembali ke sini.
      return keApi(tujuan)
        ? fail(new ServiceUnavailableError(GANGGUAN))
        : new NextResponse(`${GANGGUAN} Muat ulang halaman ini.`, {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "5" },
          });
    }
    let res: NextResponse;
    if (keApi(tujuan)) {
      res = fail(err);
    } else {
      const url = new URL("/", req.url);
      url.searchParams.set("callbackUrl", tujuan);
      if (err instanceof SesiIdleError) url.searchParams.set("alasan", "idle");
      else if (err instanceof SesiBatasError) url.searchParams.set("alasan", "batas");
      res = NextResponse.redirect(url);
    }
    clearAuthCookies(res);
    return res;
  }
}

/** GET: navigasi halaman / fetch GET yang dialihkan proxy. */
export async function GET(req: NextRequest) {
  return rotasiLaluAlihkan(req, callbackDari(req) ?? JALUR_BERANDA);
}

/**
 * POST dengan `callbackUrl`: fetch POST yang dialihkan proxy. Tanpa
 * `callbackUrl`: penyegaran latar dari klien (`PenjagaSesi`) — kembalikan JSON
 * berisi sisa waktu sampai batas mutlak sesi.
 */
export async function POST(req: NextRequest) {
  const tujuan = callbackDari(req);
  if (tujuan) return rotasiLaluAlihkan(req, tujuan);

  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new UnauthorizedError();
    const issued = await refresh(raw, meta(req));
    const res = NextResponse.json(
      { data: { user: issued.user, sesi: infoSesi(issued) } },
      { headers: { "Cache-Control": "no-store" } },
    );
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
    if (!ditolak(err)) {
      if (!(err instanceof AppError)) console.error("[AUTH] penyegaran sesi gagal", err);
      return fail(new ServiceUnavailableError(GANGGUAN));
    }
    const res = fail(err);
    clearAuthCookies(res);
    return res;
  }
}

/** PATCH/PUT/DELETE fetch API yang dialihkan proxy; tanpa tujuan sah → 405. */
async function metodeTulis(req: NextRequest) {
  const tujuan = callbackDari(req);
  if (!tujuan) return new NextResponse(null, { status: 405, headers: { Allow: "GET, POST" } });
  return rotasiLaluAlihkan(req, tujuan);
}
export const PATCH = metodeTulis;
export const PUT = metodeTulis;
export const DELETE = metodeTulis;
