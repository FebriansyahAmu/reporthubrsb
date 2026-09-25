import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getEventDetail } from "@/server/modules/audit-rme/audit.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ logId: string }> };

/** GET /api/audit-rme/events/[logId] — detail + diff SEBELUM→SESUDAH (RME, scope). */
export const GET = withPermission<{ logId: string }>(
  "audit-rme",
  "view",
  async (_req: NextRequest, ctx: Ctx) => {
    const { logId } = await ctx.params;
    return ok(await getEventDetail(logId));
  },
);
