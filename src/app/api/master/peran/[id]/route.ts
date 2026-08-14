import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { updateRoleSchema } from "@/server/modules/master/master.schema";
import { deleteRole, updateRole } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/master/peran/[id] — ubah nama/deskripsi peran. */
export const PATCH = withPermission<{ id: string }>(
  "master.peran",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = updateRoleSchema.parse(await req.json());
    await updateRole(id, input, { id: user.id, name: user.name, ip: clientIp(req) });
    return ok({ ok: true });
  },
);

/** DELETE /api/master/peran/[id] — hapus peran non-sistem tanpa pengguna. */
export const DELETE = withPermission<{ id: string }>(
  "master.peran",
  "delete",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    await deleteRole(id, { id: user.id, name: user.name, ip: clientIp(req) });
    return ok({ ok: true });
  },
);
