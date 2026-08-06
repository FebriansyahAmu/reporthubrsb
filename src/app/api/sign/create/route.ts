import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { ok, fail } from "@/server/lib/http";
import { UnauthorizedError } from "@/server/lib/errors";
import { qrSvgDataUri } from "@/server/lib/qr";
import { signCreateSchema } from "@/server/modules/sign/sign.schema";
import { createSignSession } from "@/server/modules/sign/sign.store";

export const runtime = "nodejs";

/**
 * POST — buat sesi TTD jarak jauh (hanya petugas login). Mengembalikan token,
 * URL yang bisa dibuka HP (berbasis Host request → pakai IP LAN bila PC diakses
 * via IP), dan QR SVG data-URI dari URL itu.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const { label, context } = signCreateSchema.parse(body);
    const session = createSignSession(label, context);

    // Origin publik untuk QR. Override via SIGN_PUBLIC_ORIGIN (mis. IP LAN) agar
    // HP bisa membuka — kalau PC diakses via localhost, host request tak terjangkau.
    const configured = process.env.SIGN_PUBLIC_ORIGIN?.trim().replace(/\/+$/, "");
    const base =
      configured ||
      `${req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")}://${req.headers.get("host") ?? req.nextUrl.host}`;
    const url = `${base}/sign/${session.token}`;
    const qr = await qrSvgDataUri(url, 1);

    return ok({ token: session.token, url, qr, expiresAt: session.expiresAt });
  } catch (err) {
    return fail(err);
  }
}
