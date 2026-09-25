import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getRefs } from "@/server/modules/audit-rme/audit.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/refs — opsi filter (objek scope, pengguna, cakupan). */
export const GET = withPermission("audit-rme", "view", async () => {
  return ok(await getRefs());
});
