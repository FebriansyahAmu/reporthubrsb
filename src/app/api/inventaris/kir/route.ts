import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { listRuanganForKir } from "@/server/modules/inventaris/kir.service";

export const runtime = "nodejs";

/** GET /api/inventaris/kir — daftar ruangan + jumlah aset & nilai (pemilih KIR). */
export const GET = withPermission("inventaris.kir", "view", async () => {
  return ok(await listRuanganForKir());
});
