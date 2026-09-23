import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getStatusOverview } from "@/server/modules/rekap-klaim/status.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/status?tahun=… — alert status/deadline & pending belum cair. */
export const GET = withPermission("rekap-klaim.data", "view", async (req: NextRequest) => {
  const t = req.nextUrl.searchParams.get("tahun");
  const tahun = t && /^\d{4}$/.test(t) ? Number(t) : undefined;
  return ok(await getStatusOverview(tahun));
});
