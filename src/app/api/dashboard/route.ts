import { NextRequest } from "next/server";
import { dashboardQuerySchema } from "@/server/modules/dashboard/dashboard.schema";
import { getDashboard } from "@/server/modules/dashboard/dashboard.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard?period=7d|30d|90d|month
 * Statistik ringkas kunjungan (RJ/IGD/RI), tren, cara bayar, top ruangan, jam,
 * sensus RI. Read-only SIMGOS. Dijaga izin modul `dashboard:view`.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("dashboard", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const { period } = dashboardQuerySchema.parse(sp);
    const data = await getDashboard(period);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
