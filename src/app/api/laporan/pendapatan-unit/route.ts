import { NextRequest } from "next/server";
import { pendapatanQuerySchema } from "@/server/modules/pendapatan-unit/pendapatan.schema";
import { getPendapatanUnit } from "@/server/modules/pendapatan-unit/pendapatan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/pendapatan-unit?from&to[&layanan=rj|igd|ri|lab|rad|farmasi|lainnya|semua
 *     &status=final,belum,batal&caraBayar&ruangan]
 * Pendapatan per unit per layanan (port SP LaporanPendapatanPerUnit, semua status
 * tagihan). Read-only SIMGOS. Izin khusus data keuangan: `laporan.pendapatan`.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan.pendapatan", "view");
    const input = pendapatanQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await getPendapatanUnit(input));
  } catch (err) {
    return fail(err);
  }
}
