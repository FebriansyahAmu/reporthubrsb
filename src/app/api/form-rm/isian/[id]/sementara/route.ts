import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { identitasSementaraSchema } from "@/features/form-rm/sementara";
import { ubahIdentitasSementara } from "@/server/modules/form-rm/isian.tautan";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/** PATCH — perbaiki identitas sementara isian yang belum tertaut (draf, butuh update pada kategori form). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = identitasSementaraSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await ubahIdentitasSementara(id, input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
