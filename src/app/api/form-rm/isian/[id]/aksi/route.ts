import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { aksiIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { aksiIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * POST — transisi status `{ aksi, rev, alasan? }`: FINALKAN / BUKA_KOREKSI /
 * BATALKAN. Butuh update pada kategori form; aksi atas isian FINAL juga butuh
 * izin `form-rm.kelola`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = aksiIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await aksiIsian(id, input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
