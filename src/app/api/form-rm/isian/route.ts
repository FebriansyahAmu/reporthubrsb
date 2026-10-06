import type { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { buatIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { bukaAtauBuatIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/** POST — buka isian aktif (form, NOPEN) atau buat baru; isi otomatis SIMRS dijalankan server. */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize("form-rm", "create");
    jagaTulis(req, user);
    const input = buatIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await bukaAtauBuatIsian(input, aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
