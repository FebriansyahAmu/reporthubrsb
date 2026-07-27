import { NextRequest, NextResponse } from "next/server";
import { refresh } from "@/server/modules/auth/auth.service";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  isSecureRequest,
  setAuthCookies,
} from "@/server/auth/cookies";
import { fail } from "@/server/lib/http";
import { UnauthorizedError } from "@/server/lib/errors";

export const runtime = "nodejs";

/** Callback hanya boleh path relatif internal (cegah open-redirect). */
function safePath(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/kunjungan";
  return v;
}

function meta(req: NextRequest) {
  return {
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/** GET: dipakai middleware — rotasi lalu redirect balik ke callbackUrl. */
export async function GET(req: NextRequest) {
  const callbackUrl = safePath(req.nextUrl.searchParams.get("callbackUrl"));
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  try {
    if (!raw) throw new UnauthorizedError();
    const issued = await refresh(raw, meta(req));
    const res = NextResponse.redirect(new URL(callbackUrl, req.url));
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch {
    const url = new URL("/", req.url);
    url.searchParams.set("callbackUrl", callbackUrl);
    const res = NextResponse.redirect(url);
    clearAuthCookies(res);
    return res;
  }
}

/** POST: silent refresh dari klien — kembalikan JSON. */
export async function POST(req: NextRequest) {
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
