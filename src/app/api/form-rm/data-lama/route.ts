import type { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { pindahkanSemuaDataLama } from "@/server/modules/form-rm/isian.lama";
import { aktorDari, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * POST — pindahkan semua isian tabel lama `form_rm` yang tertunda menjadi isian
 * DRAF (sekali jalan setelah rilis; aman diulang). Khusus pengelola RM.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize("form-rm.kelola", "update");
    jagaTulis(req, user);
    return tanpaCache(ok(await pindahkanSemuaDataLama(await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
