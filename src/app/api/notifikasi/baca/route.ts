import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/lib/errors";
import { ok, fail, readJson } from "@/server/lib/http";
import { bacaNotifikasiSchema } from "@/server/modules/notifikasi/notifikasi.schema";
import { bacaNotifikasi } from "@/server/modules/notifikasi/notifikasi.service";

export const runtime = "nodejs";

/** POST /api/notifikasi/baca — `{ ids }` atau `{ semua: true }`; hanya notifikasi milik penerima. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const input = bacaNotifikasiSchema.parse(await readJson(req));
    return ok(await bacaNotifikasi(user, input));
  } catch (err) {
    return fail(err);
  }
}
