import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { riwayatIsian } from "@/server/modules/form-rm/isian.service";
import { idDariParam } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/** GET — daftar revisi + hasil pemeriksaan segel integritas (hak lihat kategori form). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const id = idDariParam((await params).id);
    return tanpaCache(ok(await riwayatIsian(id, await hakFormRm(user))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
