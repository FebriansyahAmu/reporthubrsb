import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { ForbiddenError, NotFoundError } from "@/server/lib/errors";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { definisiForm } from "@/features/form-rm/registry";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { daftarPasienForm } from "@/server/modules/form-rm/form-rm.pasien";
import { pasienFormQuerySchema } from "@/server/modules/form-rm/form-rm.schema";
import { jagaCari } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * GET /api/form-rm/f/[kode]/pasien?[q&ruangan&status&halaman] — pemilih pasien
 * satu form: pasien aktif sesuai sasaran form, atau hasil pencarian No.RM /
 * NIK / NOPEN / nama (≥ 3 karakter), beserta status isian form itu. Hak lihat
 * pada kategori form; pencarian ke SIMGOS dibatasi lajunya.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kode: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const def = definisiForm((await params).kode);
    if (!def) throw new NotFoundError("Form tidak dikenal");
    if (!(await hakFormRm(user)).boleh(def.kategori, "view")) throw new ForbiddenError();
    const input = pasienFormQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    if (input.q) jagaCari(user);
    return tanpaCache(
      ok(await daftarPasienForm(def, { q: input.q, ruanganId: input.ruangan, status: input.status, halaman: input.halaman })),
    );
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
