import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { aktorDari, BATAS_BODY, jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { mintaTtdSchema } from "@/server/modules/ttd-siaga/permintaan.schema";
import { mintaTtd } from "@/server/modules/ttd-siaga/permintaan.service";

export const runtime = "nodejs";

/**
 * POST `{ perangkatId, isianId, slot }` — kirim permintaan TTD ke tablet siaga
 * (docs/PRD_TTD_Perangkat_Siaga.md §5.3, §7.4). Hak `update` atas kategori
 * isian, isian DRAF, perangkat terpasang + tersambung + bebas.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const input = mintaTtdSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await mintaTtd(input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
