import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { klaimUpdateSchema } from "@/server/modules/rekap-klaim/klaim.schema";
import { deleteKlaim, getKlaim, updateKlaim } from "@/server/modules/rekap-klaim/klaim.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rekap-klaim/klaim/[id] — detail klaim. */
export const GET = withPermission<{ id: string }>("rekap-klaim.data", "view", async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  return ok(await getKlaim(id));
});

/** PATCH /api/rekap-klaim/klaim/[id] — perbarui klaim. */
export const PATCH = withPermission<{ id: string }>(
  "rekap-klaim.data",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = klaimUpdateSchema.parse(await req.json());
    return ok(await updateKlaim(id, input, user));
  },
);

/** DELETE /api/rekap-klaim/klaim/[id] — hapus klaim. */
export const DELETE = withPermission<{ id: string }>(
  "rekap-klaim.data",
  "delete",
  async (_req, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    await deleteKlaim(id, user);
    return ok({ id });
  },
);
