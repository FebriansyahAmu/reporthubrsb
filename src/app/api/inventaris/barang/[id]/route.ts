import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { barangUpdateSchema } from "@/server/modules/inventaris/barang.schema";
import { deleteBarang, getBarang, updateBarang } from "@/server/modules/inventaris/barang.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/inventaris/barang/[id] — detail unit aset. */
export const GET = withPermission<{ id: string }>("inventaris.barang", "view", async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  return ok(await getBarang(id));
});

/** PATCH /api/inventaris/barang/[id] — perbarui unit aset (kode tidak berubah). */
export const PATCH = withPermission<{ id: string }>(
  "inventaris.barang",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = barangUpdateSchema.parse(await req.json());
    return ok(await updateBarang(id, input, user));
  },
);

/** DELETE /api/inventaris/barang/[id] — hapus unit aset. */
export const DELETE = withPermission<{ id: string }>("inventaris.barang", "delete", async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await deleteBarang(id);
  return ok({ id });
});
