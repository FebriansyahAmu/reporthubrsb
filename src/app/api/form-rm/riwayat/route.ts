import type { NextRequest } from "next/server";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { riwayatQuerySchema } from "@/server/modules/form-rm/form-rm.schema";
import { riwayatIsian } from "@/server/modules/form-rm/isian.riwayat";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/form-rm/riwayat?dari=YYYY-MM-DD&sampai=YYYY-MM-DD[&dasar&status&form&q&saya=1&halaman]
 * Riwayat Pengisian: isian form yang boleh dilihat dalam rentang tanggal WITA
 * (inklusif), terbaru dulu, 20 per halaman, + jumlah per status.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const input = riwayatQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return tanpaCache(ok(await riwayatIsian(input, { id: user.id, hak: await hakFormRm(user) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
