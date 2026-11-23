import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getChecklistRefs } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan/checklist/refs — ruangan (+ ruangan saya) & kondisi untuk pemilih. */
export const GET = withPermission("inventaris.pemeliharaan", "view", async (_req, _ctx, user) => {
  return ok(await getChecklistRefs(user.id));
});
