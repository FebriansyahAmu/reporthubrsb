import { getKategoriOptions } from "@/server/modules/farmasi/farmasi.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/farmasi-obat/kategori
 * Opsi kategori (daun, JENIS=3) untuk filter multi-pilih. Read-only SIMGOS.
 */
export async function GET() {
  try {
    await authorize("laporan", "view");
    const data = await getKategoriOptions();
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
