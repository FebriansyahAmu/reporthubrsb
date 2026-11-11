import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { UnauthorizedError } from "@/server/lib/errors";
import { qrSvgDataUri } from "@/server/lib/qr";
import { jagaBuatSign } from "@/server/modules/sign/sign.jaga";
import { BATAS_BODY_SIGN, signCreateSchema } from "@/server/modules/sign/sign.schema";
import { signTtd } from "@/server/modules/sign/sign.store";

export const runtime = "nodejs";

/**
 * POST — buat sesi TTD jarak jauh (hanya petugas login; sesi terikat ke
 * pengguna ini — hanya dia yang bisa membaca status & mengambil PNG-nya).
 * Mengembalikan token, URL yang bisa dibuka HP (berbasis Host request → pakai
 * IP LAN bila PC diakses via IP), dan QR SVG data-URI dari URL itu.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    jagaBuatSign(req, user.id);

    const { label, context } = signCreateSchema.parse(await readJsonTerbatas(req, BATAS_BODY_SIGN.buat));
    const sesi = signTtd.buat(label, context, user.id);

    // Origin publik untuk QR. Override via SIGN_PUBLIC_ORIGIN (mis. IP LAN) agar
    // HP bisa membuka — kalau PC diakses via localhost, host request tak terjangkau.
    const configured = process.env.SIGN_PUBLIC_ORIGIN?.trim().replace(/\/+$/, "");
    const base =
      configured ||
      `${req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")}://${req.headers.get("host") ?? req.nextUrl.host}`;
    const url = `${base}/sign/${sesi.token}`;
    const qr = await qrSvgDataUri(url, 1);

    return tanpaCache(ok({ token: sesi.token, url, qr, expiresAt: sesi.sampai }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
