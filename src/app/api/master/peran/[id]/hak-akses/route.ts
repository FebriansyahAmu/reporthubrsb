import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { setGrantsSchema } from "@/server/modules/master/master.schema";
import { setGrants } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/master/peran/[id]/hak-akses — set matriks izin (modul×aksi) peran. */
export const PUT = withPermission<{ id: string }>(
  "master.peran",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = setGrantsSchema.parse(await req.json());
    await setGrants(id, input, { id: user.id, name: user.name, ip: clientIp(req) });
    return ok({ ok: true });
  },
);
