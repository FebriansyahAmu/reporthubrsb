import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
import { bacaTeksTerbatas, fail, ok, parseJson, tanpaCache } from "@/server/lib/http";
import { jagaKirimSign, jagaPantauSign, tokenDariParam } from "@/server/modules/sign/sign.jaga";
import { BATAS_BODY_SIGN, signSubmitSchema } from "@/server/modules/sign/sign.schema";
import { PNG_DATA_URL_PREFIX, signTtd } from "@/server/modules/sign/sign.store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET — status sesi untuk PC PEMBUATNYA saja (sesi login; proxy menjaga rute
 * ini seperti API lain). Tanpa PNG — PNG diambil lewat `POST …/ambil`.
 * Pengguna lain / token salah → 404 seragam.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    jagaPantauSign(req, user.id);
    const token = tokenDariParam((await params).token);
    return tanpaCache(ok({ status: signTtd.status(token, user.id) }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/**
 * POST `{ payload }` — HP mengirim TTD (PUBLIK; token di QR = hak mengirim,
 * BUKAN hak membaca). Asal-sama + laju per IP, body ≤ 512 KB dibaca sebelum
 * di-parse, PNG saja (disusun ulang server), sekali kirim (kedua → 409).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    jagaKirimSign(req);
    const token = tokenDariParam((await params).token);
    const { payload } = signSubmitSchema.parse(parseJson(await bacaTeksTerbatas(req, BATAS_BODY_SIGN.kirim)));
    signTtd.kirim(token, Buffer.from(payload.slice(PNG_DATA_URL_PREFIX.length), "base64"));
    return tanpaCache(ok({ status: "signed" as const }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
