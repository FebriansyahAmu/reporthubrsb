import { NextRequest } from "next/server";
import { obatTerbanyakQuerySchema } from "@/server/modules/farmasi/farmasi.schema";
import { getObatTerbanyak } from "@/server/modules/farmasi/farmasi.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/farmasi-obat?from&to[&caraBayar&kategori&metric]
 * 10 obat terbanyak (kuantitas/nilai) pada periode + filter. Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = obatTerbanyakQuerySchema.parse(sp);
    const data = await getObatTerbanyak(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
