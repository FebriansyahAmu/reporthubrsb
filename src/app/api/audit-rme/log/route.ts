import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { logQuerySchema } from "@/server/modules/audit-rme/audit.schema";
import { getLogAktivitas } from "@/server/modules/audit-rme/log.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/log — log CRUD + login berpaginasi bernomor, dengan pasien & ruangan (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = logQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getLogAktivitas(q));
});
