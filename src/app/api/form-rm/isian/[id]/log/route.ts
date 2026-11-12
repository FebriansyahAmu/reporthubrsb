import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { logIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, idDariParam } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * GET — log perubahan per kolom (nilai sebelum → sesudah) + pemeriksaan segel.
 * Hak lihat kategori form (kategori lain → 404 seragam); pembacaan diaudit.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const id = idDariParam((await params).id);
    return tanpaCache(ok(await logIsian(id, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
