import { NextRequest, NextResponse } from "next/server";
import { changePasswordSchema } from "@/server/modules/auth/auth.schema";
import { changePassword } from "@/server/modules/auth/auth.service";
import { getCurrentUser } from "@/server/auth/session";
import { isSecureRequest, setAuthCookies } from "@/server/auth/cookies";
import { UnauthorizedError } from "@/server/lib/errors";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const input = changePasswordSchema.parse(body);

    const issued = await changePassword(me.id, input.currentPassword, input.newPassword, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    // Sesi saat ini dapat token baru (sesi lain sudah dicabut).
    const res = NextResponse.json({ data: { ok: true } });
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
    return fail(err);
  }
}
