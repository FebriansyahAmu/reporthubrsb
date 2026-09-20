import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { NotFoundError } from "@/server/lib/errors";
import { ok } from "@/server/lib/http";
import {
  REF_SCHEMA,
  isRefEntity,
  type RefEntity,
  type RefInput,
} from "@/server/modules/inventaris/pengaturan.schema";
import { deleteRef, updateRef } from "@/server/modules/inventaris/pengaturan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entity: string; id: string }> };

async function resolve(ctx: Ctx): Promise<{ entity: RefEntity; id: string }> {
  const { entity, id } = await ctx.params;
  if (!isRefEntity(entity)) throw new NotFoundError("Entitas pengaturan tidak dikenal.");
  return { entity, id };
}

/** PATCH /api/inventaris/pengaturan/[entity]/[id] — perbarui referensi. */
export const PATCH = withPermission<{ entity: string; id: string }>(
  "inventaris.pengaturan",
  "update",
  async (req: NextRequest, ctx) => {
    const { entity, id } = await resolve(ctx);
    const input = REF_SCHEMA[entity].parse(await req.json()) as RefInput;
    const updated = await updateRef(entity, id, input);
    return ok(updated);
  },
);

/** DELETE /api/inventaris/pengaturan/[entity]/[id] — hapus (ditolak bila dipakai). */
export const DELETE = withPermission<{ entity: string; id: string }>(
  "inventaris.pengaturan",
  "update",
  async (_req, ctx) => {
    const { entity, id } = await resolve(ctx);
    await deleteRef(entity, id);
    return ok({ id });
  },
);
