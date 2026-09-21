import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { katalogUpdateSchema } from "@/server/modules/inventaris/katalog.schema";
import { deleteKatalog, updateKatalog } from "@/server/modules/inventaris/katalog.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/inventaris/barang/katalog/[id] — ubah item katalog (rename propagasi ke unit). */
export const PATCH = withPermission<{ id: string }>("inventaris.barang", "update", async (req: NextRequest, ctx: Ctx, user) => {
  const { id } = await ctx.params;
  const input = katalogUpdateSchema.parse(await req.json());
  return ok(await updateKatalog(id, input, user));
});

/** DELETE /api/inventaris/barang/katalog/[id] — hapus item (ditolak bila dipakai). */
export const DELETE = withPermission<{ id: string }>("inventaris.barang", "delete", async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteKatalog(id);
  return ok({ id });
});
