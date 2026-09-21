import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getChecklistRefs } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan/checklist/refs — daftar ruangan untuk pemilih. */
export const GET = withPermission("inventaris.pemeliharaan", "view", async () => {
  return ok(await getChecklistRefs());
});
