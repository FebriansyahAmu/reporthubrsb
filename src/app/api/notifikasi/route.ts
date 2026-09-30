import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
import { ok, fail } from "@/server/lib/http";
import { daftarNotifikasiSchema } from "@/server/modules/notifikasi/notifikasi.schema";
import { getNotifikasi } from "@/server/modules/notifikasi/notifikasi.service";

export const runtime = "nodejs";

/**
 * GET /api/notifikasi[?limit] — notifikasi terbaru untuk pengguna yang login
 * (ditujukan ke dirinya, NIP-nya, ruangan aksesnya, atau perannya) + jumlah belum dibaca.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const { limit } = daftarNotifikasiSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await getNotifikasi(user, limit));
  } catch (err) {
    return fail(err);
  }
}
