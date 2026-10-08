import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { buatSementaraSchema } from "@/server/modules/form-rm/isian.schema";
import { buatIsianSementara } from "@/server/modules/form-rm/isian.tautan";
import { aktorDari, BATAS_BODY, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * POST — `{ kode, sementara }`: buat isian untuk pasien yang BELUM terdaftar di
 * SIMRS (mis. triase saat tiba) dengan identitas sementara; ditautkan ke NOPEN
 * kemudian. Hanya form ber-`tanpaPendaftaran`; hak create dicek per kategori.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "create");
    jagaTulis(req, user);
    const input = buatSementaraSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await buatIsianSementara(input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
