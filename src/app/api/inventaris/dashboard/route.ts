import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getInvDashboard } from "@/server/modules/inventaris/dashboard.service";

export const runtime = "nodejs";

/** GET /api/inventaris/dashboard — ringkasan & tren analitik aset. */
export const GET = withPermission("inventaris", "view", async () => {
  return ok(await getInvDashboard());
});
