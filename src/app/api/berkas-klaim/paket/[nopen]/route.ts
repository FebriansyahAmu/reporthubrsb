import { getPaket } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_LIHAT_PAKET } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/paket/[nopen] — isi tab Paket Klaim: komponen report
 * SIMGOS (tersedia / alasan), sisipan aktif, paket gabungan terakhir (manifest,
 * hash, halaman) & izin. READ-ONLY SIMGOS (2 query).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorizeAny(MODUL_LIHAT_PAKET, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    return ok(await getPaket(nopen, user));
  } catch (err) {
    return fail(err);
  }
}
