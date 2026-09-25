import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { dashboardQuerySchema } from "@/server/modules/audit-rme/audit.schema";
import { getDashboard } from "@/server/modules/audit-rme/audit.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/dashboard — agregasi tren & kepatuhan (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = dashboardQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getDashboard(q));
});
