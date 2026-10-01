import { berkasResponse, fail } from "@/server/lib/http";
import { bacaPdfKomponen } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_LIHAT_PAKET } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { kunciKomponenSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/paket/[nopen]/komponen/[key] — pratinjau SATU komponen
 * (PDF segar dari report engine SIMGOS, READ-ONLY tanpa DOCUMENT_STORAGE).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ nopen: string; key: string }> }) {
  try {
    await authorizeAny(MODUL_LIHAT_PAKET, "view");
    const p = await params;
    const f = await bacaPdfKomponen(nopenSchema.parse(p.nopen), kunciKomponenSchema.parse(p.key));
    return berkasResponse(f.bytes, { mime: "application/pdf", nama: f.nama });
  } catch (err) {
    return fail(err);
  }
}
