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
import { createRef, listRef } from "@/server/modules/inventaris/pengaturan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entity: string }> };

async function resolveEntity(ctx: Ctx): Promise<RefEntity> {
  const { entity } = await ctx.params;
  if (!isRefEntity(entity)) throw new NotFoundError("Entitas pengaturan tidak dikenal.");
  return entity;
}

/** GET /api/inventaris/pengaturan/[entity] — daftar referensi. */
export const GET = withPermission<{ entity: string }>("inventaris.pengaturan", "view", async (_req, ctx) => {
  const entity = await resolveEntity(ctx);
  const rows = await listRef(entity);
  return ok(rows);
});

/** POST /api/inventaris/pengaturan/[entity] — buat referensi baru. */
export const POST = withPermission<{ entity: string }>(
  "inventaris.pengaturan",
  "update",
  async (req: NextRequest, ctx) => {
    const entity = await resolveEntity(ctx);
    const input = REF_SCHEMA[entity].parse(await req.json()) as RefInput;
    const created = await createRef(entity, input);
    return ok(created);
  },
);
