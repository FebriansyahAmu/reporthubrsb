import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getPemeliharaanRefs } from "@/server/modules/inventaris/pemeliharaan.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan/refs — kondisi & ruangan aktif (filter + form). */
export const GET = withPermission("inventaris.pemeliharaan", "view", async () => {
  return ok(await getPemeliharaanRefs());
});
