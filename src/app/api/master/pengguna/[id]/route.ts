import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { updateUserSchema } from "@/server/modules/master/master.schema";
import { getUserDetail, updateUser } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/master/pengguna/[id] — detail akun (untuk form Edit). */
export const GET = withPermission<{ id: string }>(
  "master.pengguna",
  "view",
  async (_req, ctx: Ctx) => {
    const { id } = await ctx.params;
    return ok(await getUserDetail(id));
  },
);

/** PATCH /api/master/pengguna/[id] — ubah profil/peran/status akun. */
export const PATCH = withPermission<{ id: string }>(
  "master.pengguna",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = updateUserSchema.parse(await req.json());
    const updated = await updateUser(id, input, { id: user.id, name: user.name, ip: clientIp(req) });
    return ok(updated);
  },
);
