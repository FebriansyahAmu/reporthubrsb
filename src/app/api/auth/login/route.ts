import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/server/modules/auth/auth.schema";
import { login } from "@/server/modules/auth/auth.service";
import { isSecureRequest, setAuthCookies } from "@/server/auth/cookies";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = loginSchema.parse(body);
    const issued = await login(input.username, input.password, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    const res = NextResponse.json({ data: { user: issued.user } });
    setAuthCookies(res, { access: issued.access, refresh: issued.refresh }, isSecureRequest(req));
    return res;
  } catch (err) {
    return fail(err);
  }
}
