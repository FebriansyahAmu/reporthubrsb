import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { potonganUpdateSchema } from "@/server/modules/rekap-klaim/klaim.schema";
import { deletePotongan, updatePotongan } from "@/server/modules/rekap-klaim/potongan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/rekap-klaim/potongan/[id] — perbarui potongan. */
export const PATCH = withPermission<{ id: string }>(
  "rekap-klaim.data",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = potonganUpdateSchema.parse(await req.json());
    return ok(await updatePotongan(id, input, user));
  },
);

/** DELETE /api/rekap-klaim/potongan/[id] — hapus potongan. */
export const DELETE = withPermission<{ id: string }>(
  "rekap-klaim.data",
  "delete",
  async (_req, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    await deletePotongan(id, user);
    return ok({ id });
  },
);
