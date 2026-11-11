import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { jagaPantauSign, tokenDariParam } from "@/server/modules/sign/sign.jaga";
import { pngKeDataUrlSign, signTtd } from "@/server/modules/sign/sign.store";

export const runtime = "nodejs";

/**
 * POST — PC PEMBUAT mengambil TTD dari HP: PNG ternormalisasi dikembalikan
 * SEKALI lalu dibuang dari memori. Pengguna lain / token salah → 404 seragam;
 * belum ada TTD / sudah diambil → 409.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    jagaPantauSign(req, user.id);
    const token = tokenDariParam((await params).token);
    const { png, sha256 } = signTtd.ambil(token, user.id);
    return tanpaCache(ok({ png: pngKeDataUrlSign(png), sha256 }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
