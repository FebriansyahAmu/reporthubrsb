import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getKlaimDashboard } from "@/server/modules/rekap-klaim/dashboard.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/dashboard — ringkasan & tren analitik klaim BPJS. */
export const GET = withPermission("rekap-klaim", "view", async () => {
  return ok(await getKlaimDashboard());
});
