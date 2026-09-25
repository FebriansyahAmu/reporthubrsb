import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getAuditStatus } from "@/server/modules/audit-rme/audit.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/status — status fondasi + ringkasan cakupan (read-only). */
export const GET = withPermission("audit-rme", "view", async () => {
  return ok(await getAuditStatus());
});
