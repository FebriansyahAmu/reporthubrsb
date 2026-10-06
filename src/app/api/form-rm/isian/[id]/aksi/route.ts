import type { NextRequest } from "next/server";
import { authorize, hasModule } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { aksiIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { aksiIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * POST — transisi status `{ aksi, rev, alasan? }`: FINALKAN / BUKA_KOREKSI /
 * BATALKAN. Aksi atas isian FINAL butuh izin `form-rm.kelola`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorize("form-rm", "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = aksiIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    const bolehKelola = await hasModule(user, "form-rm.kelola", "update");
    return tanpaCache(ok(await aksiIsian(id, input, { ...aktorDari(user, req), bolehKelola })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
