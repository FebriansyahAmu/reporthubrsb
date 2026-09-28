import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { rekamParamSchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getRekamIsi } from "@/server/modules/audit-rme/jejak.service";

export const runtime = "nodejs";

type Params = { sumber: string; id: string };
type Ctx = { params: Promise<Params> };

/** GET /api/audit-rme/rekam/[sumber]/[id] — isi klinis satu record + riwayat log-nya (read-only, PHI). */
export const GET = withPermission<Params>("audit-rme", "view", async (_req: NextRequest, ctx: Ctx) => {
  const { sumber, id } = rekamParamSchema.parse(await ctx.params);
  return ok(await getRekamIsi(sumber, id));
});
