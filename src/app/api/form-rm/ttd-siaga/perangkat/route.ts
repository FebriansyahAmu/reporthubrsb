import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { daftarPerangkatPilih } from "@/server/modules/ttd-siaga/permintaan.service";

export const runtime = "nodejs";

/**
 * GET — perangkat siaga terpasang untuk pemilih "Kirim ke tablet" di slot TTD.
 * Hanya `{id, nama, lokasi, status}`: tanpa kredensial dan tanpa siapa yang
 * sedang memakai perangkat.
 */
export async function GET() {
  try {
    await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    return tanpaCache(ok(await daftarPerangkatPilih()));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}
