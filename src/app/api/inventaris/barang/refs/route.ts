import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getFormRefs } from "@/server/modules/inventaris/barang.service";

export const runtime = "nodejs";

/** GET /api/inventaris/barang/refs — referensi aktif untuk form (dropdown). */
export const GET = withPermission("inventaris.barang", "view", async () => {
  return ok(await getFormRefs());
});
