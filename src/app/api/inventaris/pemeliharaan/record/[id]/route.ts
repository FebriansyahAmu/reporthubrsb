import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { pemeliharaanUpdateSchema } from "@/server/modules/inventaris/pemeliharaan.schema";
import { updatePemeliharaan } from "@/server/modules/inventaris/pemeliharaan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/inventaris/pemeliharaan/record/[id] — ubah catatan pemeliharaan. */
export const PATCH = withPermission<{ id: string }>(
  "inventaris.pemeliharaan",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const { id } = await ctx.params;
    const input = pemeliharaanUpdateSchema.parse(await req.json());
    return ok(await updatePemeliharaan(id, input, user));
  },
);
