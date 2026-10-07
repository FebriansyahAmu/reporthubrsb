import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { buatIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { bukaAtauBuatIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * POST — buka isian aktif (form, NOPEN) atau buat baru; isi otomatis SIMRS
 * dijalankan server. Hak create dicek pada kategori form di service.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "create");
    jagaTulis(req, user);
    const input = buatIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await bukaAtauBuatIsian(input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
