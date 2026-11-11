import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { lepasTautanEpisodeSchema } from "@/server/modules/form-rm/rantai.schema";
import { lepasTautan } from "@/server/modules/form-rm/rantai.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — lepas tautan episode (pengelola RM, alasan wajib). Baris tidak dihapus; isian tidak berubah. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const { alasan } = lepasTautanEpisodeSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    await lepasTautan(id, alasan, await aktorDari(user, req));
    return tanpaCache(ok({ dilepas: true }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
