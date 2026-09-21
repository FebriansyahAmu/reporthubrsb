import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { pemeliharaanCreateSchema } from "@/server/modules/inventaris/pemeliharaan.schema";
import { createPemeliharaan, listRiwayat } from "@/server/modules/inventaris/pemeliharaan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ barangId: string }> };

/** GET /api/inventaris/pemeliharaan/[barangId] — riwayat pemeliharaan satu unit. */
export const GET = withPermission<{ barangId: string }>("inventaris.pemeliharaan", "view", async (_req, ctx: Ctx) => {
  const { barangId } = await ctx.params;
  return ok(await listRiwayat(barangId));
});

/** POST /api/inventaris/pemeliharaan/[barangId] — catat pemeliharaan baru. */
export const POST = withPermission<{ barangId: string }>(
  "inventaris.pemeliharaan",
  "create",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { barangId } = await ctx.params;
    const input = pemeliharaanCreateSchema.parse(await req.json());
    return ok(await createPemeliharaan(barangId, input, user));
  },
);
