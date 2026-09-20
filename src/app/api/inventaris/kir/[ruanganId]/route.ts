import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getKirData } from "@/server/modules/inventaris/kir.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ruanganId: string }> };

/** GET /api/inventaris/kir/[ruanganId] — data KIR satu ruangan (pratinjau). */
export const GET = withPermission<{ ruanganId: string }>("inventaris.kir", "view", async (_req, ctx: Ctx) => {
  const { ruanganId } = await ctx.params;
  return ok(await getKirData(ruanganId));
});
