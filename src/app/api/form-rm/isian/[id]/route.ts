import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { simpanIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { bacaIsian, simpanIsian } from "@/server/modules/form-rm/isian.service";
import { simpanGabung } from "@/server/modules/form-rm/isian.gabung";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — isian (data + status + rev). Akses dicatat di audit; hak dicek per kategori form. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const id = idDariParam((await params).id);
    return tanpaCache(ok(await bacaIsian(id, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/**
 * PATCH — simpan draf. Mode lama `{ rev, data }` (semua form; rev usang → 409).
 * Mode gabung `{ revDasar, konteks, ubah, timpa }` (form berlanjut IGD → RI):
 * per kolom dalam transaksi berkunci; kolom yang sama bentrok → 409 berisi
 * isi terkini + kolom bentrok.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = simpanIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.simpan));
    const aktor = await aktorDari(user, req);
    return tanpaCache(ok("ubah" in input ? await simpanGabung(id, input, aktor) : await simpanIsian(id, input, aktor)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
