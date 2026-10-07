import { NextRequest, NextResponse } from "next/server";
import { SesiIdleError, refresh } from "@/server/modules/auth/auth.service";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  isSecureRequest,
  setAuthCookies,
} from "@/server/auth/cookies";
import { fail } from "@/server/lib/http";
import { AppError, UnauthorizedError } from "@/server/lib/errors";
import { jalurInternal } from "@/lib/jalur";

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

/**
 * Dipakai proxy saat access token habis: rotasi lalu alihkan balik ke tujuan.
 * 307 → browser mengulang metode & body asli (PATCH/POST/DELETE fetch API ikut
 * pulih, tidak lagi 405 / "berhasil" palsu). Gagal: tujuan API → 401 JSON (klien
 * tidak pernah menerima halaman login sebagai jawaban); tujuan halaman → login.
 */
async function rotasiLaluAlihkan(req: NextRequest, tujuan: string): Promise<NextResponse> {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new UnauthorizedError();
    const issued = await refresh(raw, meta(req));
    // Lapis kedua: tujuan yang sudah di-resolve wajib tetap di origin ini.
    const asal = new URL(req.url);
    const ke = new URL(tujuan, asal);
    const res = NextResponse.redirect(ke.origin === asal.origin ? ke : new URL("/dashboard", asal), 307);
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[AUTH] rotasi refresh gagal", err);
    const idle = err instanceof SesiIdleError;
    let res: NextResponse;
    if (keApi(tujuan)) {
      res = fail(err instanceof UnauthorizedError ? err : new UnauthorizedError("Sesi berakhir. Silakan masuk kembali."));
    } else {
      const url = new URL("/", req.url);
      url.searchParams.set("callbackUrl", tujuan);
      if (idle) url.searchParams.set("alasan", "idle");
      res = NextResponse.redirect(url);
    }
    clearAuthCookies(res);
    return res;
  }
}

/** GET: navigasi halaman / fetch GET yang dialihkan proxy. */
export async function GET(req: NextRequest) {
  return rotasiLaluAlihkan(req, callbackDari(req) ?? "/dashboard");
}

/**
 * POST dengan `callbackUrl`: fetch POST yang dialihkan proxy. Tanpa
 * `callbackUrl`: silent refresh dari klien — kembalikan JSON.
 */
export async function POST(req: NextRequest) {
  const tujuan = callbackDari(req);
  if (tujuan) return rotasiLaluAlihkan(req, tujuan);

  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new UnauthorizedError();
    const issued = await refresh(raw, meta(req));
    const res = NextResponse.json({ data: { user: issued.user } });
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
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
