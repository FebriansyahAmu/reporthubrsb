import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { eventsQuerySchema } from "@/server/modules/audit-rme/audit.schema";
import { listEvents } from "@/server/modules/audit-rme/audit.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/events — timeline aktivitas RME + login (keyset). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = eventsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await listEvents(q));
});
