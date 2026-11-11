import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { aktorDari, BATAS_BODY, jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { konfirmasiTautanSchema } from "@/server/modules/form-rm/rantai.schema";
import { konfirmasiTautan } from "@/server/modules/form-rm/rantai.service";

export const runtime = "nodejs";

/**
 * POST — konfirmasi petugas RI (PRD Berlanjut §5.2): lanjutkan isian episode IGD
 * asal, atau isian terpisah (`nopenAkar: null`). Akar diverifikasi ulang terhadap
 * kandidat SIMGOS; hak = boleh membuat salah satu form berlanjut.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "create");
    jagaTulis(req, user);
    const input = konfirmasiTautanSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await konfirmasiTautan(input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
