import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getRunDetail } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ runId: string }> };

/** GET /api/inventaris/pemeliharaan/checklist/riwayat/[runId] — detail satu pelaksanaan. */
export const GET = withPermission<{ runId: string }>(
  "inventaris.pemeliharaan",
  "view",
  async (_req: NextRequest, ctx: Ctx) => {
    const { runId } = await ctx.params;
    return ok(await getRunDetail(runId));
  },
);
