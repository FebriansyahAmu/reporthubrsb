import { NextRequest } from "next/server";
import { MODUL_ANTREAN } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { antreanQuerySchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { getAntreanVerifikasi } from "@/server/modules/verifikasi-klaim/verifikasi.service";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/verifikasi?from&to[&cakupan&status&kategori&ruangan&masalah&lengkap&q&page&pageSize&segar=1]
 * Antrean verifikasi klaim per episode (tanggal pulang, maks 31 hari) + hasil cek
 * kelengkapan otomatis dari SIMGOS (READ-ONLY) + status verifikasi (reporthub).
 */
export async function GET(req: NextRequest) {
  try {
    await authorizeAny(MODUL_ANTREAN, "view");
    const input = antreanQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await getAntreanVerifikasi(input));
  } catch (err) {
    return fail(err);
  }
}
