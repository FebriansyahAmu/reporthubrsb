import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { resetPasswordSchema } from "@/server/modules/master/master.schema";
import { resetPassword } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/master/pengguna/[id]/reset-password — setel sandi baru + cabut sesi. */
export const POST = withPermission<{ id: string }>(
  "master.pengguna",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = resetPasswordSchema.parse(await req.json());
    await resetPassword(id, input, { id: user.id, name: user.name, ip: clientIp(req) });
    return ok({ ok: true });
  },
);
