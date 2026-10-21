import { NextRequest } from "next/server";
import { domisiliQuerySchema } from "@/server/modules/domisili/domisili.schema";
import { getDomisili } from "@/server/modules/domisili/domisili.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/domisili?from&to
 * Klasifikasi kunjungan IGD / rawat jalan / rawat inap menurut domisili pasien
 * (dalam/luar Kab. Bolaang Mongondow Timur). Hanya angka agregat. Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = domisiliQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return tanpaCache(ok(await getDomisili(input)));
  } catch (err) {
    return fail(err);
  }
}
