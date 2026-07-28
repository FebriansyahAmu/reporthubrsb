import { NextRequest } from "next/server";
import { kunjunganPelayananQuerySchema } from "@/server/modules/pelayanan/pelayanan.schema";
import { getKunjunganPelayanan } from "@/server/modules/pelayanan/pelayanan.service";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/monitoring/pelayanan/kunjungan?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan=<id>]
 * Kunjungan pada rentang tanggal (MASUK) + lama rawat & status finalisasi.
 * `to` bersifat EKSKLUSIF (kirim tanggal akhir + 1 hari).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = kunjunganPelayananQuerySchema.parse(sp);
    const data = await getKunjunganPelayanan(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
