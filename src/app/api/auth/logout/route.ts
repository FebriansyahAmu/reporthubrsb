import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/server/modules/auth/auth.service";
import { REFRESH_COOKIE, clearAuthCookies } from "@/server/auth/cookies";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  await logout(raw).catch(() => {});
  const res = NextResponse.json({ data: { ok: true } });
  clearAuthCookies(res);
  return res;
}
